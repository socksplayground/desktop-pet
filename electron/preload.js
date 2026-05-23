const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPet", {
  getWorkArea: () => ipcRenderer.invoke("get-work-area"),
  movePetWindow: (x, y) => ipcRenderer.send("move-pet-window", x, y),
  setMousePassthrough: (ignore) => ipcRenderer.send("set-pet-mouse-passthrough", ignore),
  showControlPanel: () => ipcRenderer.send("show-control-panel"),
  hideControlPanel: () => ipcRenderer.send("hide-control-panel"),
  showPetMenu: (point) => ipcRenderer.send("show-pet-menu", point),
  sendCommand: (command) => ipcRenderer.send("pet-command", command),
  onCommand: (callback) => {
    ipcRenderer.on("pet-command", (_event, command) => callback(command));
  }
});
