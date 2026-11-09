const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopInfo", {
  isDesktop: true,
  platform: process.platform,
  appName: "MyTodoApp",
});

// ========================================
// SHARE WITH OTHERS API
// ========================================

contextBridge.exposeInMainWorld("electronShare", {
  openApp: (app, text) =>
    ipcRenderer.invoke("share:open-app", {
      app,
      text,
    }),

  copyText: (text) => ipcRenderer.invoke("share:copy-text", text),
});
