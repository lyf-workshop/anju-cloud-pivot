const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEFAULT_PROPERTY_URL = "https://xn--9kqy92aeqav77a.com/";
const configuredUrl = new URL(process.env.ANJU_PROPERTY_URL || DEFAULT_PROPERTY_URL);
const isLocalDevelopment = ["127.0.0.1", "localhost"].includes(configuredUrl.hostname);
if (configuredUrl.protocol !== "https:" && !(isLocalDevelopment && configuredUrl.protocol === "http:")) {
  throw new Error("ANJU_PROPERTY_URL 必须使用 HTTPS（本机开发地址除外）");
}
const allowedOrigin = configuredUrl.origin;
const startUrl = new URL("/login.html?next=/index.html", configuredUrl).toString();
const offlinePath = path.join(__dirname, "offline.html");
const offlineUrl = pathToFileURL(offlinePath).toString();

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

let mainWindow;
let showingOfflinePage = false;

function isAllowedNavigation(value) {
  try {
    const url = new URL(value);
    return (
      url.origin === allowedOrigin ||
      (url.protocol === "file:" && url.href.split("?")[0] === offlineUrl)
    );
  } catch {
    return false;
  }
}

function loadOfflinePage() {
  if (!mainWindow || mainWindow.isDestroyed() || showingOfflinePage) return;
  showingOfflinePage = true;
  mainWindow.loadFile(offlinePath, {
    query: { retry: startUrl },
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#eaf3fa",
    title: "安居云枢物业工作台",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url) && new URL(url).origin === allowedOrigin) {
      mainWindow.loadURL(url);
    } else if (/^https?:/i.test(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.webContents.on("did-start-navigation", (_event, _url, _sameDocument, isMainFrame) => {
    if (isMainFrame) showingOfflinePage = false;
  });
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, _description, validatedUrl, isMainFrame) => {
      if (isMainFrame && errorCode !== -3 && validatedUrl.startsWith(allowedOrigin)) loadOfflinePage();
    },
  );
  mainWindow.webContents.on("render-process-gone", () => loadOfflinePage());
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(startUrl).catch(loadOfflinePage);
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.anjuyunshu.property");
  createWindow();
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on("window-all-closed", () => app.quit());
