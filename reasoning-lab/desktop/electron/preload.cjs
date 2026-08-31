"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopLab", Object.freeze({
  getSystemInfo: () => ipcRenderer.invoke("system:info"),
  openExternal: (url) => ipcRenderer.invoke("external:open", url),
}));
