const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("api", {
  status: "running",
});