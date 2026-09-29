const config = require("../config/index");
const session = require("./session");
function modeGuard() {
  const env = wx.getAccountInfoSync
    ? wx.getAccountInfoSync().miniProgram.envVersion
    : "develop";
  if (config.mode === "demo" && env !== "develop")
    throw new Error("体验版与正式版禁止演示模式，请配置真实 API");
  if (!["demo", "api"].includes(config.mode))
    throw new Error("客户端数据模式配置无效");
}
function headers() {
  const s = session.get();
  return {
    Authorization: s ? "Bearer " + s.token : "",
    "X-Data-Mode": config.mode === "demo" ? "demo" : "production",
  };
}
function decode(res) {
  let body = res.data;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }
  if (
    res.statusCode >= 200 &&
    res.statusCode < 300 &&
    body &&
    Object.prototype.hasOwnProperty.call(body, "data")
  )
    return body.data;
  const error = new Error(
    body && body.error ? body.error.message : "请求失败，请检查后端连接",
  );
  error.code = body && body.error ? body.error.code : "NETWORK_ERROR";
  error.status = res.statusCode;
  // Retain per-user recoverable work on expiry; it is never shown without the same authenticated user.
  if (res.statusCode === 401 && session.get()) {
    const s = session.get();
    s.expired = true;
    session.set(s);
  }
  throw error;
}
function request(path, method, data) {
  return new Promise((resolve, reject) => {
    const owner = (session.get() || {}).token;
    try {
      modeGuard();
    } catch (e) {
      reject(e);
      return;
    }
    wx.request({
      url: config.apiBaseUrl + path,
      method: method || "GET",
      data,
      header: headers(),
      timeout: config.requestTimeout,
      success: (res) => {
        try {
          if (owner && owner !== (session.get() || {}).token)
            throw new Error("账户已切换，请重新加载");
          resolve(decode(res));
        } catch (e) {
          reject(e);
        }
      },
      fail: () => reject(new Error("连接失败，请检查网络与后端服务后重试")),
    });
  });
}
function upload(filePath) {
  return new Promise((resolve, reject) => {
    const owner = (session.get() || {}).token;
    try {
      modeGuard();
    } catch (e) {
      reject(e);
      return;
    }
    wx.uploadFile({
      url: config.apiBaseUrl + "/attachments",
      filePath,
      name: "file",
      header: headers(),
      timeout: config.requestTimeout,
      success: (res) => {
        try {
          if (owner !== (session.get() || {}).token)
            throw new Error("账户已切换，请重新上传");
          resolve(decode(res));
        } catch (e) {
          reject(e);
        }
      },
      fail: () => reject(new Error("图片上传失败，请重试；填写内容已保留")),
    });
  });
}
function image(id) {
  return new Promise((resolve, reject) => {
    const owner = (session.get() || {}).token;
    try {
      modeGuard();
    } catch (e) {
      reject(e);
      return;
    }
    wx.downloadFile({
      url: config.apiBaseUrl + "/attachments/" + encodeURIComponent(id),
      header: headers(),
      success: (res) => {
        if (owner !== (session.get() || {}).token) {
          if (res.tempFilePath)
            wx.getFileSystemManager().unlink({
              filePath: res.tempFilePath,
              fail() {},
            });
          reject(new Error("账户已切换，请重新加载图片"));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error("图片加载失败或无访问权限"));
          return;
        }
        const k = session.privateKey("images");
        const files = wx.getStorageSync(k) || [];
        files.push(res.tempFilePath);
        wx.setStorageSync(k, files);
        resolve(res.tempFilePath);
      },
      fail: () => reject(new Error("图片加载失败，请重试")),
    });
  });
}
module.exports = { request, upload, image, modeGuard };
