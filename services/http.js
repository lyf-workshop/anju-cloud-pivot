const config = require("../config/index");
const session = require("./session");
const cloud = require("./cloud-http");
function modeGuard() {
  const env = wx.getAccountInfoSync
    ? wx.getAccountInfoSync().miniProgram.envVersion
    : "develop";
  const remoteDemoTrial =
    config.loginMode === "demo-session" && env === "trial";
  if (config.mode === "local" && env !== "develop" && !remoteDemoTrial)
    throw new Error("当前演示配置仅允许开发版和比赛体验版");
  if (!["local", "api"].includes(config.mode))
    throw new Error("客户端数据模式配置无效");
}
function headers() {
  const s = session.get();
  return {
    Authorization: s ? "Bearer " + s.token : "",
    "X-Data-Mode": config.mode === "local" ? "demo" : "production",
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
function transportError(error, action) {
  const detail = String((error && error.errMsg) || error || "").trim();
  const normalized = detail.toLowerCase();
  let message;
  if (normalized.includes("url not in domain list")) {
    message =
      "服务器域名未加入当前小程序的" +
      (action === "连接"
        ? "request"
        : action === "上传"
          ? "uploadFile"
          : "downloadFile") +
      "合法域名，请检查对应 AppID 的服务器域名配置并重新打开体验版";
  } else if (
    normalized.includes("ssl") ||
    normalized.includes("certificate") ||
    normalized.includes("cert")
  ) {
    message = "服务器 HTTPS 证书校验失败，请检查证书链和域名";
  } else if (normalized.includes("timeout")) {
    message = "连接服务器超时，请检查手机网络或服务器状态";
  } else {
    message = action + "失败，请检查网络与后端服务后重试";
  }
  if (detail && !message.includes(detail)) message += "（" + detail + "）";
  const result = new Error(message);
  result.code = "WX_NETWORK_ERROR";
  result.detail = detail;
  return result;
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
    const success = (res) => {
      try {
        if (owner && owner !== (session.get() || {}).token)
          throw new Error("账户已切换，请重新加载");
        resolve(decode(res));
      } catch (e) {
        reject(e);
      }
    };
    const fail = (error) => reject(transportError(error, "连接"));
    if (cloud.enabled()) {
      cloud.request(path, method, data, headers()).then(success).catch(fail);
      return;
    }
    wx.request({
      url: config.apiBaseUrl + path,
      method: method || "GET",
      data,
      header: headers(),
      timeout: config.requestTimeout,
      success,
      fail,
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
    const success = (res) => {
      try {
        if (owner !== (session.get() || {}).token)
          throw new Error("账户已切换，请重新上传");
        resolve(decode(res));
      } catch (e) {
        reject(e);
      }
    };
    const fail = (error) => reject(transportError(error, "上传"));
    if (cloud.enabled()) {
      cloud.upload(filePath, headers()).then(success).catch(fail);
      return;
    }
    wx.uploadFile({
      url: config.apiBaseUrl + "/attachments",
      filePath,
      name: "file",
      header: headers(),
      timeout: config.requestTimeout,
      success,
      fail,
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
    const success = (res) => {
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
    };
    const fail = (error) => reject(transportError(error, "下载"));
    const path = "/attachments/" + encodeURIComponent(id);
    if (cloud.enabled()) {
      cloud.download(path, headers()).then(success).catch(fail);
      return;
    }
    wx.downloadFile({
      url: config.apiBaseUrl + path,
      header: headers(),
      success,
      fail,
    });
  });
}
module.exports = { request, upload, image, modeGuard };
