const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const projectFile = path.join(root, "project.config.json");
const localFile = path.join(root, "config", "appid.local.js");

function readLocalAppId() {
  if (!fs.existsSync(localFile)) return "";
  delete require.cache[require.resolve(localFile)];
  return String(require(localFile) || "").trim();
}

const appId = String(
  process.argv[2] || process.env.WECHAT_APP_ID || readLocalAppId(),
).trim();

if (!/^wx[0-9a-zA-Z]{16}$/.test(appId)) {
  throw new Error(
    "Provide a valid AppID: npm run wechat:appid -- wx1234567890abcdef, " +
      "or set WECHAT_APP_ID, or create config/appid.local.js.",
  );
}

const project = JSON.parse(fs.readFileSync(projectFile, "utf8"));
project.appid = appId;
fs.writeFileSync(projectFile, JSON.stringify(project, null, 2) + "\n", "utf8");
console.log(`Updated project.config.json AppID to ${appId}.`);
