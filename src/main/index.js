import { app, BrowserWindow, ipcMain, protocol, net } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import started from "electron-squirrel-startup";
import { createMockSerial } from "../shared/protocol/mock-serial.js";

if (started) {
  app.quit();
}

// --- Serial state ---
let activePort = null; // serialport instance or mock
let mainWindow = null;

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
  if (activePort) {
    try {
      activePort.close();
    } catch {}
    activePort = null;
  }

  if (portPath === "MOCK") {
    activePort = createMockSerial((data) => {
      mainWindow?.webContents.send("serial:data", Array.from(data));
    });
    mainWindow?.webContents.send("serial:status", "connected");
    return { ok: true };
  }

  try {
    const { SerialPort } = await import("serialport");
    const port = new SerialPort({ path: portPath, baudRate: baud || 115200 });

    port.on("data", (data) => {
      mainWindow?.webContents.send("serial:data", Array.from(data));
    });

    port.on("error", (err) => {
      mainWindow?.webContents.send("serial:status", "error:" + err.message);
    });

    port.on("close", () => {
      mainWindow?.webContents.send("serial:status", "disconnected");
      activePort = null;
    });

    activePort = port;
    mainWindow?.webContents.send("serial:status", "connected");
    return { ok: true };
  } catch (err) {
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
  recent.unshift({ ...project, lastOpened: new Date().toISOString() });
  config.recentProjects = recent.slice(0, 5); // Keep last 5
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
