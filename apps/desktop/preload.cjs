const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("anjuDesktop", {
  platform: "windows",
  version: "1.4.0",
  secret: Object.freeze({
    get: (key) => ipcRenderer.invoke("secret:get", key),
    set: (key, value) => ipcRenderer.invoke("secret:set", key, value),
    remove: (key) => ipcRenderer.invoke("secret:remove", key),
  }),
});
