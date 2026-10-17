import { createSerialQueue, closeSerialPort, writeSerialPort } from './serial-lifecycle.js';
import { app, BrowserWindow, ipcMain, protocol, net } from "electron";
import { atomicWriteFile, loadProjectFile, saveProjectFile } from './project-files.js';
import { normalizeRecentProjects, recentProjectDescriptor } from '../shared/project-format.js';
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import fs from "node:fs";
import started from "electron-squirrel-startup";
import { createMockSerial } from "../shared/protocol/mock-serial.js";

if (started) {
  app.quit();
}

// --- Serial state ---
const serialQueue = createSerialQueue();
let activePort = null; // serialport instance or mock
let serialConnectGeneration = 0;
let mainWindow = null;
let activeFirmwareFlash = null;
let activeECUReset = false;
let firmwareOperationReserved = false;

const emitFirmwareStatus = (payload) => {
  mainWindow?.webContents.send("firmware:status", payload);
};

const closeActivePortForFlash = async () => {
  ++serialConnectGeneration;
  await serialQueue(async () => {
    await closeSerialPort(activePort);
    activePort = null;
    mainWindow?.webContents.send('serial:status', 'disconnected');
  });
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pulsePortResetLines = async (portInstance) => {
  if (!portInstance || typeof portInstance.set !== "function") {
    throw new Error("Selected serial transport does not support ECU reboot control");
  }

  await new Promise((resolve, reject) => {
    portInstance.set({ dtr: false, rts: true }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  await delay(120);

  await new Promise((resolve, reject) => {
    portInstance.set({ dtr: true, rts: false }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
};

const resolveAvrdudeTooling = () => {
  const binaryName = process.platform === "win32" ? "avrdude.exe" : "avrdude";
  const platformFolder =
    process.platform === "win32"
      ? "avrdude-windows"
      : process.platform === "darwin"
        ? "avrdude-darwin-x86_64"
        : process.arch === "x32"
          ? "avrdude-linux_i686"
          : process.arch === "arm"
            ? "avrdude-armhf"
            : process.arch === "arm64"
              ? "avrdude-aarch64"
              : "avrdude-linux_x86_64";
  const bundledBase = app.isPackaged
    ? path.join(process.resourcesPath, "bin", platformFolder)
    : path.join(app.getAppPath(), "bin", platformFolder);
  const bundledBinary = path.join(bundledBase, binaryName);
  const envBinary = process.env.SPEEDUINO_AVRDUDE_PATH;

  if (fs.existsSync(bundledBinary)) {
    const bundledConfig = path.join(bundledBase, "avrdude.conf");
    return {
      executable: bundledBinary,
      configPath: fs.existsSync(bundledConfig) ? bundledConfig : null,
      source: "bundled",
    };
  }

  if (envBinary && fs.existsSync(envBinary)) {
    const envDir = path.dirname(envBinary);
    const envConfig = path.join(envDir, "avrdude.conf");
    return {
      executable: envBinary,
      configPath: fs.existsSync(envConfig) ? envConfig : null,
      source: "environment",
    };
  }

  return {
    executable: "avrdude",
    configPath: null,
    source: "path",
  };
};

const pushFirmwareLog = (phase, chunk) => {
  const text = String(chunk ?? "");
  if (!text.trim()) return;

  emitFirmwareStatus({
    type: "log",
    phase,
    message: text,
  });
};

const EEPROM_SIZE_ATMEGA2560 = 4096;

const buildIntelHexRecord = (type, address, bytes = []) => {
  const data = Array.from(bytes);
  const length = data.length;
  const checksumBase =
    length +
    ((address >> 8) & 0xff) +
    (address & 0xff) +
    type +
    data.reduce((sum, value) => sum + value, 0);
  const checksum = ((~checksumBase + 1) & 0xff);
  const encodedData = data
    .map((value) => value.toString(16).padStart(2, "0").toUpperCase())
    .join("");

  return `:${length.toString(16).padStart(2, "0").toUpperCase()}${address
    .toString(16)
    .padStart(4, "0")
    .toUpperCase()}${type.toString(16).padStart(2, "0").toUpperCase()}${encodedData}${checksum
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()}`;
};

const createBlankEepromHex = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ryn-speeduino-eeprom-"));
  const filePath = path.join(tempDir, "blank-eeprom.hex");
  const lines = [];

  for (let offset = 0; offset < EEPROM_SIZE_ATMEGA2560; offset += 16) {
    const chunkLength = Math.min(16, EEPROM_SIZE_ATMEGA2560 - offset);
    const bytes = new Array(chunkLength).fill(0xff);
    lines.push(buildIntelHexRecord(0x00, offset, bytes));
  }

  lines.push(buildIntelHexRecord(0x01, 0x0000, []));
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");

  return {
    dirPath: tempDir,
    filePath,
  };
};

const runAvrdudeJob = async ({
  port,
  args,
  preflightMessage,
  startMessage,
  progressLabel,
  completionMessage,
  tempArtifacts = [],
}) => {
  emitFirmwareStatus({
    type: "state",
    phase: "preflight",
    message: preflightMessage,
  });

  return await new Promise((resolve) => {
    let stderrBuffer = "";
    let combinedLog = "";
    let burnStarted = false;
    let progressPercent = 0;
    let settled = false;

    const cleanupArtifacts = () => {
      tempArtifacts.forEach((artifact) => {
        if (!artifact?.dirPath) return;
        try {
          fs.rmSync(artifact.dirPath, { recursive: true, force: true });
        } catch (cleanupError) {
          console.warn("[main] Failed to remove temporary avrdude artifact", cleanupError);
        }
      });
    };

    const finalize = (result) => {
      if (settled) return;
      settled = true;
      cleanupArtifacts();
      resolve(result);
    };

    try {
      const child = spawn(resolveAvrdudeTooling().executable, args, {
        windowsHide: true,
      });

      activeFirmwareFlash = child;

      emitFirmwareStatus({
        type: "state",
        phase: "flashing",
        percent: 0,
        message: startMessage,
      });

      child.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        combinedLog += text;
        pushFirmwareLog("stdout", text);
      });

      child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        combinedLog += text;
        stderrBuffer += text;
        pushFirmwareLog("stderr", text);

        if (!burnStarted && stderrBuffer.includes("Writing |")) {
          burnStarted = true;
          emitFirmwareStatus({
            type: "state",
            phase: "flashing",
            percent: 0,
            message: progressLabel,
          });
        }

        if (burnStarted) {
          const hashes = (text.match(/#/g) || []).length;
          if (hashes > 0) {
            progressPercent = Math.min(100, progressPercent + hashes);
            emitFirmwareStatus({
              type: "progress",
              phase: "flashing",
              percent: progressPercent,
            });
          }
        }
      });

      child.on("error", (error) => {
        activeFirmwareFlash = null;
        const message =
          error.code === "ENOENT"
            ? "avrdude was not found. Install it or configure SPEEDUINO_AVRDUDE_PATH."
            : error.message;

        emitFirmwareStatus({
          type: "error",
          phase: "flashing",
          message,
        });
        finalize({ ok: false, error: message, log: combinedLog });
      });

      child.on("close", (code) => {
        activeFirmwareFlash = null;

        if (code === 0) {
          emitFirmwareStatus({
            type: "progress",
            phase: "flashing",
            percent: 100,
          });
          emitFirmwareStatus({
            type: "completed",
            phase: "flashing",
            percent: 100,
            message: completionMessage,
          });
          finalize({ ok: true, code: 0, log: combinedLog });
          return;
        }

        const errorMessage = stderrBuffer.trim() || `avrdude exited with code ${code}`;

        emitFirmwareStatus({
          type: "error",
          phase: "flashing",
          message: errorMessage,
          code,
        });
        finalize({ ok: false, error: errorMessage, code, log: combinedLog });
      });
    } catch (error) {
      activeFirmwareFlash = null;
      const message = error.message || "Firmware operation failed";
      emitFirmwareStatus({
        type: "error",
        phase: "flashing",
        message,
      });
      finalize({ ok: false, error: message, log: combinedLog });
    }
  });
};

// --- IPC Handlers ---

ipcMain.handle("serial:listPorts", async () => {
  try {
    const { SerialPort } = await import("serialport");
    const ports = await SerialPort.list();
    return [{ path: "MOCK", manufacturer: "Simulation" }, ...ports];
  } catch (error) {
    console.error('[Serial] Failed to enumerate physical ports', error);
    return [{ path: "MOCK", manufacturer: "Simulation" }];
  }
});

ipcMain.handle("serial:connect", async (_event, portPath, baud) => {
  if (firmwareOperationReserved) return { ok: false, error: 'Firmware/reset operation owns the serial port' };
  const generation = ++serialConnectGeneration;
  mainWindow?.webContents.send('serial:status', 'connecting');
  console.log("[main] serial:connect requested", { portPath, baud });
  return serialQueue(async () => {
    if (generation !== serialConnectGeneration) return { ok: false, error: 'Connection cancelled' };
    if (activeFirmwareFlash) return { ok: false, error: 'Firmware flash is running' };
    try { await closeSerialPort(activePort); }
    catch (error) { return { ok: false, error: error.message }; }
    activePort = null;

    if (portPath === "MOCK") {
      console.log("[main] Opening mock serial transport");
      activePort = createMockSerial((data) => {
        if (generation !== serialConnectGeneration) return;
        mainWindow?.webContents.send("serial:data", Array.from(data));
      });
      mainWindow?.webContents.send("serial:status", "connected");
      return { ok: true };
    }

    try {
      const { SerialPort } = await import("serialport");
      if (generation !== serialConnectGeneration) return { ok: false, error: 'Connection cancelled' };
      const port = new SerialPort({
        path: portPath,
        baudRate: baud || 115200,
        autoOpen: false,
      });

      port.on("data", (data) => {
        if (activePort !== port || generation !== serialConnectGeneration) return;
        mainWindow?.webContents.send("serial:data", Array.from(data));
      });

      port.on("error", (err) => {
        if (generation !== serialConnectGeneration) return;
        console.error("[main] Serial port error", {
          portPath,
          message: err.message,
        });
        mainWindow?.webContents.send("serial:status", "error:" + err.message);
      });

      port.on("close", () => {
        if (activePort !== port || generation !== serialConnectGeneration) return;
        console.log("[main] Serial port closed", { portPath });
        mainWindow?.webContents.send("serial:status", "disconnected");
        activePort = null;
      });

      await new Promise((resolve, reject) => {
        port.open((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (generation !== serialConnectGeneration) {
        await closeSerialPort(port);
        return { ok: false, error: 'Connection cancelled' };
      }
      activePort = port;
      console.log("[main] Serial port opened", { portPath, baud: baud || 115200 });
      mainWindow?.webContents.send("serial:status", "connected");
      return { ok: true };
    } catch (err) {
      console.error("[main] serial:connect failed", {
        portPath,
        baud,
        message: err.message,
      });
      return { ok: false, error: err.message };
    }
  });
});

ipcMain.handle('serial:disconnect', async () => {
  if (firmwareOperationReserved) throw new Error('Firmware/reset operation owns the serial port');
  ++serialConnectGeneration;
  return serialQueue(async () => {
    try {
      await closeSerialPort(activePort);
      activePort = null;
      mainWindow?.webContents.send('serial:status', 'disconnected');
      return { ok: true };
    } catch (error) {
      mainWindow?.webContents.send('serial:status', `error:${error.message}`);
      throw error;
    }
  });
});

ipcMain.handle('serial:sendCommand', async (_event, cmd) => {
  const generation = serialConnectGeneration;
  return serialQueue(async () => {
    try {
      if (firmwareOperationReserved || generation !== serialConnectGeneration) throw new Error('Connection changed or ECU reset is running');
      const buf = typeof cmd === 'string' ? Buffer.from(cmd, 'ascii') : Buffer.from(cmd);
      await writeSerialPort(activePort, buf);
      return { ok: true };
    } catch (error) { return { ok: false, error: error.message }; }
  });
});

ipcMain.handle('serial:flush', async () => {
  const generation = serialConnectGeneration;
  return serialQueue(async () => {
    try {
      if (firmwareOperationReserved || !activePort || generation !== serialConnectGeneration) throw new Error('Not connected or connection changed');
      if (typeof activePort.flush === 'function') await new Promise((resolve, reject) => {
        activePort.flush(error => error ? reject(error) : resolve());
      });
      return { ok: true };
    } catch (error) { return { ok: false, error: error.message }; }
  });
});

// --- Persistence ---
const CONFIG_FILE = path.join(app.getPath("userData"), "user_config.json");

const loadConfig = () => {
  const fs = require("node:fs");
  if (!fs.existsSync(CONFIG_FILE)) {
    return { recentProjects: [], settings: { theme: "neon" } };
  }
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return { ...config, recentProjects: normalizeRecentProjects(config.recentProjects) };
  } catch {
    return { recentProjects: [], settings: { theme: "neon" } };
  }
};

const saveConfig = (config) => {
  const fs = require("node:fs");
  atomicWriteFile(CONFIG_FILE, JSON.stringify({ ...config, recentProjects: normalizeRecentProjects(config.recentProjects) }, null, 2));
};

ipcMain.handle("config:get", async () => loadConfig());
ipcMain.handle("config:save-settings", async (event, settings) => {
  const config = loadConfig();
  config.settings = settings;
  saveConfig(config);
  return { ok: true };
});

ipcMain.handle("project:add-recent", async (event, project) => {
  const config = loadConfig();
  // Filter out the same project if it exists and add it to the top
  const descriptor = recentProjectDescriptor({ ...project, lastOpened: new Date().toISOString() });
  config.recentProjects = normalizeRecentProjects([descriptor, ...config.recentProjects]);
  saveConfig(config);
  return config.recentProjects;
});

ipcMain.handle("project:remove-recent", async (event, filePath) => {
  const config = loadConfig();
  config.recentProjects = config.recentProjects.filter(
    (p) => p.filePath !== filePath,
  );
  saveConfig(config);
  return config.recentProjects;
});

ipcMain.handle("project:pick-ini", async () => {
  const { dialog } = require("electron");
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Speeduino INI File",
    properties: ["openFile"],
    filters: [{ name: "Speeduino INI", extensions: ["ini"] }],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("project:pick-save", async (event, projectName) => {
  const { dialog } = require("electron");
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save Ryn Project",
    defaultPath: `${String(projectName || 'new_project').trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '_').replace(/[. ]+$/g, '') || 'new_project'}.rynproj`,
    filters: [{ name: "Ryn Project", extensions: ["rynproj"] }],
  });

  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle("project:pick-image", async () => {
  const { dialog } = require("electron");
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Background Image",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("firmware:pick-hex", async () => {
  const { dialog } = require("electron");
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Firmware HEX File",
    properties: ["openFile"],
    filters: [{ name: "Firmware HEX", extensions: ["hex"] }],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("firmware:flash", async (_event, payload = {}) => {
  const port = payload.port;
  const hexPath = payload.hexPath;
  const resetEeprom = payload.resetEeprom === true;

  if (activeFirmwareFlash || firmwareOperationReserved) {
    return { ok: false, error: "Firmware flashing is already in progress" };
  }

  if (!port) {
    return { ok: false, error: "Serial port is required" };
  }

  if (!hexPath) {
    return { ok: false, error: "HEX file is required" };
  }

  if (!fs.existsSync(hexPath)) {
    return { ok: false, error: "Selected HEX file does not exist" };
  }

  firmwareOperationReserved = true;
  try {
    await closeActivePortForFlash();

    const tooling = resolveAvrdudeTooling();
    const args = [];
    let tempEepromArtifact = null;
    if (tooling.configPath) {
      args.push("-C", tooling.configPath);
    }
    args.push(
      "-v",
      "-p",
      "atmega2560",
      "-c",
      "wiring",
      "-b",
      "115200",
      "-P",
      port,
      "-D",
      "-U",
      `flash:w:${hexPath}:i`,
    );

    if (resetEeprom) {
      tempEepromArtifact = createBlankEepromHex();
      args.push("-U", `eeprom:w:${tempEepromArtifact.filePath}:i`);
    }

    return await runAvrdudeJob({
      port,
      args,
      preflightMessage: resetEeprom
        ? `Launching avrdude via ${tooling.source} with EEPROM reset`
        : `Launching avrdude via ${tooling.source}`,
      startMessage: resetEeprom
        ? `Flashing ${path.basename(hexPath)} to ${port} with EEPROM reset`
        : `Flashing ${path.basename(hexPath)} to ${port}`,
      progressLabel: "Writing firmware to ECU",
      completionMessage: "Firmware flashing completed",
      tempArtifacts: tempEepromArtifact ? [tempEepromArtifact] : [],
    });
  } catch (error) {
    emitFirmwareStatus({ type: 'error', phase: 'preflight', message: error.message });
    return { ok: false, error: error.message };
  } finally {
    firmwareOperationReserved = false;
  }

});

ipcMain.handle("firmware:reset-eeprom", async (_event, payload = {}) => {
  const port = payload.port;

  if (activeFirmwareFlash || firmwareOperationReserved) {
    return { ok: false, error: "Firmware operation is already in progress" };
  }

  if (!port) {
    return { ok: false, error: "Serial port is required" };
  }

  firmwareOperationReserved = true;
  try {
    await closeActivePortForFlash();

    const tooling = resolveAvrdudeTooling();
    const args = [];
    const tempEepromArtifact = createBlankEepromHex();

    if (tooling.configPath) {
      args.push("-C", tooling.configPath);
    }

    args.push(
      "-v",
      "-p",
      "atmega2560",
      "-c",
      "wiring",
      "-b",
      "115200",
      "-P",
      port,
      "-D",
      "-U",
      `eeprom:w:${tempEepromArtifact.filePath}:i`,
    );

    return await runAvrdudeJob({
      port,
      args,
      preflightMessage: `Launching avrdude via ${tooling.source} for EEPROM reset`,
      startMessage: `Resetting EEPROM on ${port}`,
      progressLabel: "Writing blank EEPROM image",
      completionMessage: "EEPROM reset completed",
      tempArtifacts: [tempEepromArtifact],
    });
  } catch (error) {
    emitFirmwareStatus({ type: 'error', phase: 'preflight', message: error.message });
    return { ok: false, error: error.message };
  } finally {
    firmwareOperationReserved = false;
  }

});

ipcMain.handle("firmware:reboot", async (_event, payload = {}) => {
  const port = payload.port;
  const baud = payload.baud || 115200;
  if (activeFirmwareFlash || firmwareOperationReserved || activeECUReset) return { ok: false, error: 'Another firmware/reset operation is running' };
  if (!port || port === 'MOCK') return { ok: false, error: 'A physical serial port is required for USB reset' };
  // Reserve synchronously, before entering the queue, so another flash/reset
  // cannot slip between draining writes and acquiring the port.
  activeECUReset = true;
  firmwareOperationReserved = true;
  const reservation = { type: 'usb-reset' };
  activeFirmwareFlash = reservation;
  try {
    return await serialQueue(async () => {
      let portInstance = activePort;
      if (!portInstance || portInstance.isOpen === false || portInstance.path !== port) {
        throw new Error('Connect and verify the selected ECU port before USB reset');
      }
      // Renderer quiesces protocol traffic and checks fresh engine/burn/test
      // status before requesting this transport-only operation.
      ++serialConnectGeneration;
      activePort = null;
      mainWindow?.webContents.send('serial:status', 'disconnected');
      try {
        emitFirmwareStatus({ type: 'state', phase: 'rebooting', message: `Sending USB reset pulse on ${port}` });
        await pulsePortResetLines(portInstance);
        await delay(250);
      } finally {
        // Keep the handle reachable if Windows refuses to close it.
        try { await closeSerialPort(portInstance); }
        catch (error) { activePort = portInstance; throw error; }
      }
      emitFirmwareStatus({ type: 'state', phase: 'reconnecting', message: 'USB reset pulse sent; ECU recovery is not yet verified' });
      return { ok: true, pulseSent: true, baud };
    });
  } catch (error) {
    emitFirmwareStatus({ type: 'error', phase: 'rebooting', message: error.message });
    return { ok: false, error: error.message };
  } finally {
    activeECUReset = false;
    firmwareOperationReserved = false;
    if (activeFirmwareFlash === reservation) activeFirmwareFlash = null;
  }
});

ipcMain.handle("project:pick-directory", async () => {
  const { dialog } = require("electron");
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Folder for Logs",
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("project:pick-existing", async () => {
  const { dialog } = require("electron");
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Ryn Project",
    properties: ["openFile"],
    filters: [{ name: "Ryn Project", extensions: ["rynproj"] }],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("project:load-file", async (event, filePath) => {
  try {
    return loadProjectFile(filePath);
  } catch (e) {
    if ((e instanceof SyntaxError || e.message.includes('integrity check failed')) && fs.existsSync(`${filePath}.bak`)) {
      try {
        const recovered = loadProjectFile(`${filePath}.bak`);
        const { dialog } = require('electron');
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'warning', title: 'Recover project backup',
          message: 'This project file cannot be read. A backup is available.',
          detail: 'Open the backup as a recovered copy, then use Save As to choose a new project file.',
          buttons: ['Open recovered copy', 'Cancel'], defaultId: 0, cancelId: 1,
        });
        if (response === 0) return { ...recovered, filePath: '', fileRevision: undefined, recoveredFrom: `${filePath}.bak` };
      } catch (backupError) { console.warn('Project backup recovery failed:', backupError.message); }
    }
    return { error: e.message };
  }
});

ipcMain.handle("project:save-file", async (event, filePath, data, options) => {
  try {
    return saveProjectFile(filePath, data, options);
  } catch (e) {
    console.error('[main] Save failed:', e);
    return { error: e.message };
  }
});

ipcMain.handle('project:bundled-ini', async () => {
  const candidates = [path.join(app.getAppPath(), 'speeduino.ini'), path.join(process.resourcesPath, 'speeduino.ini')];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return { path: filePath, content: fs.readFileSync(filePath, 'utf8') };
  }
  return { error: 'Bundled INI is unavailable. Choose the INI that matches your firmware.' };
});

ipcMain.handle('project:confirm-transition', async (event, projectName) => {
  const { dialog } = require('electron');
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question', title: 'Unsaved project changes',
    message: `Save changes to ${projectName || 'this project'}?`,
    detail: 'Save includes pending local field and table edits. It saves the project file on this computer.',
    buttons: ['Save', 'Discard', 'Cancel'], defaultId: 0, cancelId: 2,
  });
  return ['save', 'discard', 'cancel'][response];
});

let pendingClose = null;
let closeRequestId = 0;
ipcMain.on('project:complete-close', (event, requestId, approved) => {
  if (pendingClose && requestId === closeRequestId && event.sender === mainWindow?.webContents) pendingClose(approved === true);
});

// --- Existing handlers remain but updated etc ---
ipcMain.handle("project:load-ini", async (event, filePath) => {
  const fs = require("node:fs");
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    return { error: e.message };
  }
});

// --- Window ---

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0d1117",
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open DevTools immediately
  mainWindow.webContents.openDevTools();

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  let closeApproved = false;
  mainWindow.on('close', event => {
    if (closeApproved) return;
    event.preventDefault();
    if (pendingClose) return;
    const requestedWindow = mainWindow;
    // A missing or unresponsive renderer never counts as approval to lose edits.
    const timeout = setTimeout(() => { pendingClose = null; }, 30000);
    pendingClose = approved => {
      clearTimeout(timeout);
      pendingClose = null;
      if (approved && !requestedWindow.isDestroyed()) { closeApproved = true; requestedWindow.close(); }
    };
    requestedWindow.webContents.send('project:request-close', ++closeRequestId);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  protocol.handle('atom', (request) => {
    try {
      const url = new URL(request.url);
      // Pathname will be /C:/Users/... or /home/user/...
      let decodedPath = decodeURIComponent(url.pathname);

      // On Windows, pathname usually starts with a leading slash like /C:/
      if (process.platform === 'win32' && decodedPath.startsWith('/') && decodedPath[2] === ':') {
        decodedPath = decodedPath.slice(1);
      }

      const fileUrl = pathToFileURL(decodedPath).toString();
      return net.fetch(fileUrl);
    } catch (err) {
      console.error('[protocol] Failed to handle atom:// request:', err);
      return new Response('Not Found', { status: 404 });
    }
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
