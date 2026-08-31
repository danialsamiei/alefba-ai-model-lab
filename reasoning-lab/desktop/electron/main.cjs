"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const os = require("node:os");
const path = require("node:path");

const HTTPS_URL = /^https:\/\/[a-z0-9.-]+(?:\/[^\s]*)?$/i;

function createWindow() {
  const window = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#050806",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (HTTPS_URL.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  window.once("ready-to-show", () => window.show());
  void window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

ipcMain.handle("system:info", () => ({
  platform: process.platform,
  arch: process.arch,
  cpuModel: os.cpus()[0]?.model || "Unknown CPU",
  logicalCores: os.cpus().length,
  totalRamGiB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
  appVersion: app.getVersion(),
  packaged: app.isPackaged,
}));

ipcMain.handle("external:open", async (_event, url) => {
  if (typeof url !== "string" || !HTTPS_URL.test(url)) {
    throw new Error("Only validated HTTPS links may be opened externally.");
  }
  await shell.openExternal(url);
  return true;
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
