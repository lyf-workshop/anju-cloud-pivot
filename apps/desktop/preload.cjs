const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld(
  "anjuDesktop",
  Object.freeze({
    platform: "windows",
    role: "property",
    version: "1.5.0",
  }),
);
