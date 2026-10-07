const cloud = require("wx-server-sdk");
const https = require("node:https");
const crypto = require("node:crypto");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const upstreamBase = String(
  process.env.UPSTREAM_BASE_URL || "https://xn--9kqy92aeqav77a.com/api",
).replace(/\/$/, "");
const timeoutMs = 25000;
const maxResponseBytes = 8 * 1024 * 1024;
const maxUploadBytes = 5 * 1024 * 1024;

function safePath(value) {
  const path = String(value || "");
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("://") ||
    path.includes("..") ||
    path.length > 1500
  )
    throw new Error("非法的中转路径");
  return path;
}

function safeMethod(value) {
  const method = String(value || "GET").toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method))
    throw new Error("不支持的请求方法");
  return method;
}

function forwardedHeaders(input) {
  const source = input && typeof input === "object" ? input : {};
  const result = { accept: "application/json" };
  if (typeof source.Authorization === "string" && source.Authorization)
    result.authorization = source.Authorization;
  if (typeof source["X-Data-Mode"] === "string")
    result["x-data-mode"] = source["X-Data-Mode"];
  return result;
}

function parseBody(buffer, contentType) {
  const text = buffer.toString("utf8");
  if (String(contentType || "").includes("application/json") || /^[\[{]/.test(text.trim())) {
    try {
      return JSON.parse(text);
    } catch (_) {}
  }
  return text;
}

function upstreamRequest(path, method, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(upstreamBase + safePath(path));
    const request = https.request(
      url,
      { method: safeMethod(method), headers, timeout: timeoutMs },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxResponseBytes) {
            request.destroy(new Error("上游响应超过云函数中转限制"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            statusCode: Number(response.statusCode || 502),
            headers: response.headers,
            buffer: Buffer.concat(chunks),
          }),
        );
      },
    );
    request.on("timeout", () => request.destroy(new Error("访问后端服务器超时")));
    request.on("error", reject);
    if (body && body.length) request.write(body);
    request.end();
  });
}

async function proxyRequest(event) {
  const method = safeMethod(event.method);
  const headers = forwardedHeaders(event.headers);
  let body;
  if (method !== "GET" && event.data !== undefined) {
    body = Buffer.from(JSON.stringify(event.data));
    headers["content-type"] = "application/json; charset=utf-8";
    headers["content-length"] = String(body.length);
  }
  const response = await upstreamRequest(event.path, method, headers, body);
  return {
    statusCode: response.statusCode,
    data: parseBody(response.buffer, response.headers["content-type"]),
  };
}

function mimeType(fileName) {
  const extension = String(fileName || "").toLowerCase().split(".").pop();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

function safeFileName(value) {
  const name = String(value || "photo.jpg").replace(/[^A-Za-z0-9._-]/g, "_");
  return name.slice(-100) || "photo.jpg";
}

async function proxyUpload(event) {
  if (
    typeof event.fileID !== "string" ||
    !event.fileID.includes("/api-proxy-uploads/")
  )
    throw new Error("非法的云存储上传文件");
  const downloaded = await cloud.downloadFile({ fileID: event.fileID });
  const file = downloaded.fileContent;
  if (!Buffer.isBuffer(file) || !file.length || file.length > maxUploadBytes)
    throw new Error("图片为空或超过5MB限制");
  const boundary = "----AnjuCloudProxy" + crypto.randomBytes(12).toString("hex");
  const name = safeFileName(event.fileName);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mimeType(name)}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, file, tail]);
  const headers = forwardedHeaders(event.headers);
  headers["content-type"] = "multipart/form-data; boundary=" + boundary;
  headers["content-length"] = String(body.length);
  const response = await upstreamRequest(event.path, "POST", headers, body);
  return {
    statusCode: response.statusCode,
    data: parseBody(response.buffer, response.headers["content-type"]),
  };
}

function downloadExtension(contentType) {
  const value = String(contentType || "").toLowerCase();
  if (value.includes("png")) return ".png";
  if (value.includes("webp")) return ".webp";
  return ".jpg";
}

async function proxyDownload(event, openid) {
  const response = await upstreamRequest(
    event.path,
    "GET",
    forwardedHeaders(event.headers),
  );
  if (response.statusCode !== 200)
    return {
      statusCode: response.statusCode,
      data: parseBody(response.buffer, response.headers["content-type"]),
    };
  const cloudPath =
    "api-proxy-downloads/" +
    openid +
    "/" +
    Date.now() +
    "-" +
    crypto.randomBytes(8).toString("hex") +
    downloadExtension(response.headers["content-type"]);
  const uploaded = await cloud.uploadFile({
    cloudPath,
    fileContent: response.buffer,
  });
  return { statusCode: 200, fileID: uploaded.fileID };
}

async function cleanup(event, openid) {
  const marker = "/api-proxy-downloads/" + openid + "/";
  if (typeof event.fileID !== "string" || !event.fileID.includes(marker))
    throw new Error("非法的临时文件清理请求");
  await cloud.deleteFile({ fileList: [event.fileID] });
  return { statusCode: 204 };
}

exports.main = async (event) => {
  try {
    const context = cloud.getWXContext();
    const openid = String(context.OPENID || "anonymous").replace(/[^A-Za-z0-9_-]/g, "_");
    if (event.operation === "request") return await proxyRequest(event);
    if (event.operation === "upload") return await proxyUpload(event);
    if (event.operation === "download") return await proxyDownload(event, openid);
    if (event.operation === "cleanup") return await cleanup(event, openid);
    throw new Error("未知的云函数中转操作");
  } catch (error) {
    console.error("api-proxy failed", error);
    return {
      proxyError: {
        code: error.code || "CLOUD_PROXY_ERROR",
        message: error.message || "云函数中转失败",
      },
    };
  }
};
