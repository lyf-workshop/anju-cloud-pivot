const fs = require("node:fs");
const path = require("node:path");

function readEnvAppId() {
  const envPath = path.join("server", ".env");
  if (!fs.existsSync(envPath)) return "";
  const text = fs.readFileSync(envPath, "utf8");
  const match = text.match(/^WECHAT_APP_ID=(.*)$/m);
  if (!match) return "";
  const value = match[1].trim().replace(/^["']|["']$/g, "");
  return value && !value.startsWith("#") ? value : "";
}

function resolveAppId() {
  const arg = process.argv[2];
  if (arg && /^wx[a-f0-9]{16}$/i.test(arg)) return arg;
  const localFile = path.join("mobile", "config", "appid.local.js");
  if (fs.existsSync(localFile)) {
    delete require.cache[path.resolve(localFile)];
    const exported = require(path.resolve(localFile));
    if (typeof exported === "string") return exported;
    if (exported && typeof exported.appId === "string") return exported.appId;
  }
  const fromEnv = readEnvAppId();
  if (fromEnv && /^wx[a-f0-9]{16}$/i.test(fromEnv)) return fromEnv;
  throw new Error(
    "缺少小程序 AppID。任选其一：\n" +
      "  npm run wechat:appid -- wxYourAppId\n" +
      "  或在 mobile/config/appid.local.js 中 module.exports = \"wxYourAppId\";\n" +
      "  或在 server/.env 中设置 WECHAT_APP_ID=wxYourAppId",
  );
}

function patchAppId(file, appId) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) return;
  const json = JSON.parse(fs.readFileSync(absolute, "utf8"));
  json.appid = appId;
  fs.writeFileSync(absolute, JSON.stringify(json, null, 2) + "\n");
}

const appId = resolveAppId();
patchAppId("project.config.json", appId);
patchAppId(path.join("mobile", "project.config.json"), appId);
console.log("已写入 AppID " + appId + " 到 project.config.json 与 mobile/project.config.json");
