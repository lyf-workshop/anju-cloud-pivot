const config = require("../config/index");

function enabled() {
  return config.transport === "cloud";
}

function ensureCloud() {
  if (!wx.cloud || !wx.cloud.callFunction)
    throw new Error("当前微信基础库不支持云开发，请升级微信后重试");
  if (!config.cloudFunctionName)
    throw new Error("尚未配置云函数名称");
}

function invoke(data) {
  return new Promise((resolve, reject) => {
    try {
      ensureCloud();
    } catch (error) {
      reject(error);
      return;
    }
    wx.cloud.callFunction({
      name: config.cloudFunctionName,
      data,
      success: (response) => {
        const result = response && response.result;
        if (!result || typeof result !== "object") {
          reject(new Error("云函数未返回有效结果，请检查 api-proxy 部署日志"));
          return;
        }
        if (result.proxyError) {
          const error = new Error(result.proxyError.message || "云函数中转失败");
          error.code = result.proxyError.code || "CLOUD_PROXY_ERROR";
          reject(error);
          return;
        }
        resolve(result);
      },
      fail: reject,
    });
  });
}

function cloudPath(prefix, filePath) {
  const match = String(filePath || "").match(/\.([A-Za-z0-9]{1,8})(?:\?|$)/);
  const extension = match ? "." + match[1].toLowerCase() : ".jpg";
  return (
    prefix +
    "/" +
    Date.now() +
    "-" +
    Math.random().toString(36).slice(2, 12) +
    extension
  );
}

function uploadCloudFile(filePath) {
  return new Promise((resolve, reject) => {
    ensureCloud();
    wx.cloud.uploadFile({
      cloudPath: cloudPath("api-proxy-uploads", filePath),
      filePath,
      success: resolve,
      fail: reject,
    });
  });
}

function downloadCloudFile(fileID) {
  return new Promise((resolve, reject) => {
    ensureCloud();
    wx.cloud.downloadFile({ fileID, success: resolve, fail: reject });
  });
}

function deleteCloudFiles(fileList) {
  if (!wx.cloud || !wx.cloud.deleteFile || !fileList.length)
    return Promise.resolve();
  return new Promise((resolve) => {
    wx.cloud.deleteFile({ fileList, success: resolve, fail: resolve });
  });
}

function request(path, method, data, headers) {
  return invoke({
    operation: "request",
    path,
    method: method || "GET",
    data,
    headers,
  });
}

async function upload(filePath, headers) {
  const uploaded = await uploadCloudFile(filePath);
  const fileID = uploaded.fileID;
  try {
    return await invoke({
      operation: "upload",
      path: "/attachments",
      fileID,
      fileName: String(filePath || "photo.jpg").split(/[\\/]/).pop(),
      headers,
    });
  } finally {
    await deleteCloudFiles(fileID ? [fileID] : []);
  }
}

async function download(path, headers) {
  const response = await invoke({
    operation: "download",
    path,
    headers,
  });
  if (response.statusCode !== 200 || !response.fileID) return response;
  const fileID = response.fileID;
  try {
    const downloaded = await downloadCloudFile(fileID);
    return { statusCode: response.statusCode, tempFilePath: downloaded.tempFilePath };
  } finally {
    invoke({ operation: "cleanup", fileID }).catch(() => {});
  }
}

module.exports = { enabled, request, upload, download };
