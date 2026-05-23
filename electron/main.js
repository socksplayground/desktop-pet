const path = require("path");
const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen, session } = require("electron");

const TOOLBAR_SIZE = { width: 890, height: 505 };

let petWin;
let toolbarWin;
let tray;
let workArea;
let isQuitting = false;

app.setName("桌面寵物");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isUsableWindow(win) {
  return win && !win.isDestroyed();
}

function isSender(event, win) {
  return isUsableWindow(win) && event.sender === win.webContents;
}

function isTrustedSender(event) {
  return isSender(event, petWin) || isSender(event, toolbarWin);
}

function hardenWebContents(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });
}

function normalizePetCommand(command) {
  if (!command || typeof command !== "object") return null;
  const type = command.type;

  if (["call", "sit", "nap", "resetSprite"].includes(type)) return { type };

  if (type === "name") {
    const value = String(command.value || "狗狗").trim().slice(0, 32) || "狗狗";
    return { type, value };
  }

  if (type === "scale") {
    const value = Number(command.value);
    if (!Number.isFinite(value)) return null;
    return { type, value: clamp(value, 0.5, 2) };
  }

  if (type === "speed") {
    const value = Number(command.value);
    if (!Number.isFinite(value)) return null;
    return { type, value: clamp(value, 20, 320) };
  }

  if (type === "heartColor") {
    const value = String(command.value || "");
    if (!/^#[0-9a-f]{6}$/i.test(value)) return null;
    return { type, value };
  }

  if (type === "sitReminderMinutes") {
    const value = Number(command.value);
    if (!Number.isFinite(value)) return null;
    return { type, value: clamp(value, 0.1, 240) };
  }

  if (type === "sitReminderMessage") {
    const value = String(command.value || "記得喝水").trim().slice(0, 24) || "記得喝水";
    return { type, value };
  }

  if (type === "customSprite") {
    const payload = typeof command.value === "string" ? { src: command.value } : command.value;
    if (!payload || typeof payload !== "object") return null;
    const src = String(payload.src || "");
    if (!src.startsWith("data:image/png;base64,") || src.length > 20_000_000) return null;
    const frameCount = Math.trunc(clamp(Number(payload.frameCount || 0), 0, 8));
    const facing = payload.facing === "left" ? "left" : "right";
    return { type, value: { src, frameCount, facing } };
  }

  return null;
}

function hasValidWorkArea(area) {
  return (
    area &&
    Number.isFinite(area.x) &&
    Number.isFinite(area.y) &&
    Number.isFinite(area.width) &&
    Number.isFinite(area.height)
  );
}

function createTransparentWindow(options) {
  return new BrowserWindow({
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
    ...options
  });
}

function keepOnTop(win) {
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

function createWindows() {
  workArea = screen.getPrimaryDisplay().workArea;

  petWin = createTransparentWindow({
    width: Math.round(workArea.width),
    height: Math.round(workArea.height),
    x: Math.round(workArea.x),
    y: Math.round(workArea.y)
  });
  keepOnTop(petWin);
  petWin.setIgnoreMouseEvents(true, { forward: true });
  petWin.loadFile(path.join(__dirname, "..", "pet.html"));

  toolbarWin = new BrowserWindow({
    width: TOOLBAR_SIZE.width,
    height: TOOLBAR_SIZE.height,
    useContentSize: true,
    x: Math.round(workArea.x + 18),
    y: Math.round(workArea.y + 18),
    title: "桌面寵物",
    show: false,
    frame: true,
    transparent: false,
    resizable: false,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    minWidth: TOOLBAR_SIZE.width,
    minHeight: TOOLBAR_SIZE.height,
    hasShadow: true,
    backgroundColor: "#111827",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  });
  toolbarWin.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    toolbarWin.hide();
  });
  hardenWebContents(toolbarWin);
  toolbarWin.loadFile(path.join(__dirname, "..", "toolbar.html"));

  createTray();
}

function createTray() {
  const image = nativeImage.createFromPath(path.join(__dirname, "..", "build", "tray-dog.png"));
  image.setTemplateImage(false);
  const trayImage = image.resize({ width: 22, height: 22, quality: "best" });
  tray = new Tray(trayImage);
  tray.setTitle("");
  tray.setToolTip("桌面寵物");
  tray.setContextMenu(buildPetMenu());
  tray.on("click", () => {
    tray.popUpContextMenu(buildPetMenu());
  });
}

function buildPetMenu() {
  return Menu.buildFromTemplate([
    { label: "顯示控制面板", click: showControlPanel },
    { type: "separator" },
    { label: "叫牠過來", click: () => sendPetCommand({ type: "call" }) },
    { label: "坐下", click: () => sendPetCommand({ type: "sit" }) },
    { label: "趴下", click: () => sendPetCommand({ type: "nap" }) },
    { type: "separator" },
    { label: "關閉桌面寵物", click: () => app.quit() }
  ]);
}

function showControlPanel() {
  if (!isUsableWindow(toolbarWin)) return;
  toolbarWin.setFullScreen(false);
  toolbarWin.unmaximize();
  const x = Math.round(workArea.x + Math.max(18, (workArea.width - TOOLBAR_SIZE.width) / 2));
  const y = Math.round(workArea.y + 18);
  toolbarWin.setBounds({ x, y, width: TOOLBAR_SIZE.width, height: TOOLBAR_SIZE.height }, false);
  toolbarWin.show();
  toolbarWin.focus();
}

function hideControlPanel() {
  if (!isUsableWindow(toolbarWin)) return;
  toolbarWin.hide();
}

function sendPetCommand(command) {
  const safeCommand = normalizePetCommand(command);
  if (safeCommand && isUsableWindow(petWin)) petWin.webContents.send("pet-command", safeCommand);
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  createWindows();
  hardenWebContents(petWin);
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("get-work-area", (event) => {
  if (!isSender(event, petWin)) return null;
  return workArea;
});

ipcMain.on("move-pet-window", (event, nextX, nextY) => {
  if (!isSender(event, petWin)) return;
  if (!isUsableWindow(petWin) || !hasValidWorkArea(workArea)) return;
  const rawX = Number(nextX);
  const rawY = Number(nextY);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;
  const x = Math.trunc(clamp(rawX, workArea.x, workArea.x + workArea.width));
  const y = Math.trunc(clamp(rawY, workArea.y, workArea.y + workArea.height));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  petWin.setPosition(x, y, false);
});

ipcMain.on("set-pet-mouse-passthrough", (event, ignore) => {
  if (!isSender(event, petWin)) return;
  if (!isUsableWindow(petWin)) return;
  petWin.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
});

ipcMain.on("pet-command", (event, command) => {
  if (!isTrustedSender(event)) return;
  sendPetCommand(command);
});

ipcMain.on("show-control-panel", (event) => {
  if (!isTrustedSender(event)) return;
  showControlPanel();
});

ipcMain.on("hide-control-panel", (event) => {
  if (!isSender(event, toolbarWin)) return;
  hideControlPanel();
});

ipcMain.on("show-pet-menu", (event, point = {}) => {
  if (!isSender(event, petWin)) return;
  showControlPanel();
  const menu = buildPetMenu();
  const sourceWindow = BrowserWindow.fromWebContents(event.sender);
  const popupOptions = isUsableWindow(sourceWindow) ? { window: sourceWindow } : {};
  const x = Number(point.x);
  const y = Number(point.y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    popupOptions.x = Math.trunc(x);
    popupOptions.y = Math.trunc(y);
  }
  menu.popup(popupOptions);
});
