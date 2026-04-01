import { app, BrowserWindow, ipcMain, protocol, net } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import fs from "node:fs";
import started from "electron-squirrel-startup";
import { createMockSerial } from "../shared/protocol/mock-serial.js";

if (started) {
  app.quit();
}

// --- Serial state ---
let activePort = null; // serialport instance or mock
let mainWindow = null;
let activeFirmwareFlash = null;

const emitFirmwareStatus = (payload) => {
  mainWindow?.webContents.send("firmware:status", payload);
};

const closeActivePortForFlash = async () => {
  if (!activePort) return;

  try {
    if (typeof activePort.close === "function") {
      await new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        try {
          activePort.close(() => finish());
          setTimeout(finish, 250);
        } catch {
          finish();
        }
      });
    }
  } catch (error) {
    console.warn("[main] Failed to close active port before flash", error);
  } finally {
    activePort = null;
    mainWindow?.webContents.send("serial:status", "disconnected");
  }
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

// --- IPC Handlers ---

ipcMain.handle("serial:listPorts", async () => {
  try {
    const { SerialPort } = await import("serialport");
    const ports = await SerialPort.list();
    return [{ path: "MOCK", manufacturer: "Simulation" }, ...ports];
  } catch {
    return [{ path: "MOCK", manufacturer: "Simulation" }];
  }
});

ipcMain.handle("serial:connect", async (_event, portPath, baud) => {
  console.log("[main] serial:connect requested", { portPath, baud });
  if (activePort) {
    try {
      activePort.close();
    } catch {}
    activePort = null;
  }

  if (portPath === "MOCK") {
    console.log("[main] Opening mock serial transport");
    activePort = createMockSerial((data) => {
      mainWindow?.webContents.send("serial:data", Array.from(data));
    });
    mainWindow?.webContents.send("serial:status", "connected");
    return { ok: true };
  }

  try {
    const { SerialPort } = await import("serialport");
    const port = new SerialPort({
      path: portPath,
      baudRate: baud || 115200,
      autoOpen: false,
    });

    port.on("data", (data) => {
      mainWindow?.webContents.send("serial:data", Array.from(data));
    });

    port.on("error", (err) => {
      console.error("[main] Serial port error", {
        portPath,
        message: err.message,
      });
      mainWindow?.webContents.send("serial:status", "error:" + err.message);
    });

    port.on("close", () => {
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

ipcMain.handle("serial:disconnect", async () => {
  if (!activePort) return { ok: true };
  try {
    activePort.close();
    activePort = null;
  } catch {}
  mainWindow?.webContents.send("serial:status", "disconnected");
  return { ok: true };
});

ipcMain.handle("serial:sendCommand", async (_event, cmd) => {
  if (!activePort) return { ok: false, error: "Not connected" };
  try {
    const buf =
      typeof cmd === "string" ? Buffer.from(cmd, "ascii") : Buffer.from(cmd);
    activePort.write(buf);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("serial:flush", async () => {
  if (!activePort) return { ok: false, error: "Not connected" };
  try {
    if (typeof activePort.flush === "function") {
      await new Promise((resolve, reject) => {
        activePort.flush((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// --- Persistence ---
const CONFIG_FILE = path.join(app.getPath("userData"), "user_config.json");

const loadConfig = () => {
  const fs = require("node:fs");
  if (!fs.existsSync(CONFIG_FILE)) {
    return { recentProjects: [], settings: { theme: "neon" } };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return { recentProjects: [], settings: { theme: "neon" } };
  }
};

const saveConfig = (config) => {
  const fs = require("node:fs");
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
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
  const recent = config.recentProjects.filter(
    (p) => p.filePath !== project.filePath,
  );
  // Migrate old data if it doesn't have a color
  recent.unshift({ 
    ...project, 
    lastOpened: new Date().toISOString(),
    color: project.color || 'cyan' 
  });
  config.recentProjects = recent.slice(0, 10); // Keep last 10
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
    defaultPath: `${projectName.toLowerCase().replace(/\s+/g, "_")}.rynproj`,
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

  if (activeFirmwareFlash) {
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

  await closeActivePortForFlash();

  const tooling = resolveAvrdudeTooling();
  const args = [];
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

  emitFirmwareStatus({
    type: "state",
    phase: "preflight",
    message: `Launching avrdude via ${tooling.source}`,
  });

  return await new Promise((resolve) => {
    let stderrBuffer = "";
    let combinedLog = "";
    let burnStarted = false;
    let progressPercent = 0;
    let settled = false;

    const finalize = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const child = spawn(tooling.executable, args, {
        windowsHide: true,
      });

      activeFirmwareFlash = child;

      emitFirmwareStatus({
        type: "state",
        phase: "flashing",
        percent: 0,
        message: `Flashing ${path.basename(hexPath)} to ${port}`,
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
            message: "Writing firmware to ECU",
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
            message: "Firmware flashing completed",
          });
          finalize({ ok: true, code: 0, log: combinedLog });
          return;
        }

        const errorMessage =
          stderrBuffer.trim() ||
          `avrdude exited with code ${code}`;

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
      const message = error.message || "Firmware flash failed";
      emitFirmwareStatus({
        type: "error",
        phase: "flashing",
        message,
      });
      finalize({ ok: false, error: message, log: combinedLog });
    }
  });
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
  const fs = require("node:fs");
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("project:save-file", async (event, filePath, data) => {
  const fs = require("node:fs");
  console.log('[main] Saving project to:', filePath);
  try {
    const json = JSON.stringify(data, null, 2);
    console.log('[main] JSON stringified, size:', json.length, 'bytes');
    fs.writeFileSync(filePath, json);
    console.log('[main] File written successfully');
    return { ok: true };
  } catch (e) {
    console.error('[main] Save failed:', e);
    return { error: e.message };
  }
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
      preload: path.join(__dirname, "preload.js"),
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
