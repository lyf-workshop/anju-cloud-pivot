const config = require("../config/index");
const key = "aj:session:" + config.mode + ":" + config.apiBaseUrl;
function get() {
  return wx.getStorageSync(key) || null;
}
function clear() {
  wx.removeStorageSync(key);
  const keys = wx.getStorageInfoSync().keys || [];
  keys
    .filter((k) => k.indexOf("aj:private:") === 0)
    .forEach((k) => {
      if (k.indexOf(":images") >= 0 || k.indexOf(":report-draft") >= 0) {
        const item = wx.getStorageSync(k);
        const files = Array.isArray(item)
          ? item
          : ((item && item.photos) || []).map((p) => p.path);
        files.forEach((path) => {
          try {
            wx.getFileSystemManager().unlink({ filePath: path, fail() {} });
          } catch (_) {}
        });
      }
      wx.removeStorageSync(k);
    });
  // Clear retained page instances too, so back navigation after an account switch
  // cannot reveal a previous account's in-memory data.
  if (typeof getCurrentPages === "function")
    getCurrentPages().forEach((page) => {
      if (page.resetPrivateView) page.resetPrivateView();
    });
}
function privateKey(name) {
  const s = get();
  return (
    "aj:private:" +
    config.mode +
    ":" +
    (s ? s.user.id : "anonymous") +
    ":" +
    name
  );
}
module.exports = {
  get,
  clear,
  privateKey,
  set: (s) => wx.setStorageSync(key, s),
};
