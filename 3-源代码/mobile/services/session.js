const config = require("../config/index");
let current = null,
  restored = false;
const prefix = () => `anju:${config.mode}:${config.apiBaseUrl || "offline"}:`;
function get() {
  if (!restored) {
    restored = true;
    if (config.mode !== "showcase" && wx.getStorageSync)
      current = wx.getStorageSync(prefix() + "session") || null;
  }
  if (
    current &&
    current.expiresAt &&
    Date.parse(current.expiresAt) <= Date.now()
  )
    current.expired = true;
  return current;
}
function set(value) {
  current = value;
  restored = true;
  if (config.mode !== "showcase" && wx.setStorageSync)
    wx.setStorageSync(prefix() + "session", value);
}
function privateKey(name) {
  return prefix() + "private:" + (get()?.user?.id || "anonymous") + ":" + name;
}
function clear() {
  const ownerPrefix = privateKey("");
  if (wx.getStorageInfoSync && config.mode !== "showcase") {
    for (const key of wx.getStorageInfoSync().keys || []) {
      if (key.startsWith(ownerPrefix)) {
        if (key.endsWith(":images") && wx.getFileSystemManager)
          for (const file of wx.getStorageSync(key) || [])
            wx.getFileSystemManager().unlink({ filePath: file, fail() {} });
        wx.removeStorageSync(key);
      }
    }
    wx.removeStorageSync(prefix() + "session");
  }
  current = null;
  restored = true;
  if (typeof getCurrentPages === "function")
    getCurrentPages().forEach((p) => {
      if (p.resetPrivateView) p.resetPrivateView();
    });
}
module.exports = { get, set, clear, privateKey };
