const { app, BrowserWindow, ipcMain, net, protocol, safeStorage, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

let mainWindow;
const clientRoot = path.resolve(__dirname, "../../dist/client");
const vaultPath = () => path.join(app.getPath("userData"), "secure-session.json");
const validKey = (key) => typeof key === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(key);

function readVault() {
  try {
    return JSON.parse(fs.readFileSync(vaultPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeVault(value) {
  const target = vaultPath();
  const temp = target + ".tmp";
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(temp, JSON.stringify(value), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temp, target);
}

function requireEncryption() {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows 安全存储当前不可用");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 820,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#eaf3fa",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://xn--9kqy92aeqav77a.com/")) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("app://anju/")) event.preventDefault();
  });
  mainWindow.loadURL("app://anju/index.html");
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.anjuyunshu.judge");
  protocol.handle("app", (request) => {
    const parsed = new URL(request.url);
    let relative = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
    if (!relative) relative = "index.html";
    let target = path.resolve(clientRoot, relative);
    if (!target.startsWith(clientRoot + path.sep) || !fs.existsSync(target)) {
      target = path.join(clientRoot, "index.html");
    }
    return net.fetch(pathToFileURL(target).toString());
  });
  ipcMain.handle("secret:get", (_event, key) => {
    if (!validKey(key)) throw new Error("Invalid storage key");
    requireEncryption();
    const encrypted = readVault()[key];
    return encrypted
      ? safeStorage.decryptString(Buffer.from(encrypted, "base64"))
      : null;
  });
  ipcMain.handle("secret:set", (_event, key, value) => {
    if (!validKey(key) || typeof value !== "string" || value.length > 20000)
      throw new Error("Invalid secure storage value");
    requireEncryption();
    const vault = readVault();
    vault[key] = safeStorage.encryptString(value).toString("base64");
    writeVault(vault);
    return true;
  });
  ipcMain.handle("secret:remove", (_event, key) => {
    if (!validKey(key)) throw new Error("Invalid storage key");
    const vault = readVault();
    delete vault[key];
    writeVault(vault);
    return true;
  });
  createWindow();
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
app.on("window-all-closed", () => app.quit());
