const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const privatePath = path.resolve("project.private.config.json");
const privateExample = {
  libVersion: "3.17.3",
  projectname: "Anju_CloudPivot",
  setting: {
    urlCheck: false,
    coverView: true,
    lazyloadPlaceholderEnable: false,
    skylineRenderEnable: false,
    preloadBackgroundData: false,
    autoAudits: false,
    showShadowRootInWxmlPanel: true,
    compileHotReLoad: true,
  },
};

const appIdArg = process.argv[2] || "";
execSync("node scripts/sync-wechat-appid.cjs" + (appIdArg ? " " + appIdArg : ""), {
  stdio: "inherit",
  cwd: process.cwd(),
});

const apiBase =
  process.env.ANJU_API_BASE_URL || "https://xn--9kqy92aeqav77a.com/api";
execSync(
  'node scripts/client-mode.cjs remote-demo "' + apiBase.replace(/"/g, "") + '"',
  { stdio: "inherit", cwd: process.cwd() },
);

if (!fs.existsSync(privatePath)) {
  fs.writeFileSync(privatePath, JSON.stringify(privateExample, null, 2) + "\n");
  console.log("已创建 project.private.config.json（关闭域名校验，仅本地开发）");
} else {
  const current = JSON.parse(fs.readFileSync(privatePath, "utf8"));
  current.setting = { ...privateExample.setting, ...(current.setting || {}) };
  current.setting.urlCheck = false;
  fs.writeFileSync(privatePath, JSON.stringify(current, null, 2) + "\n");
  console.log("已更新 project.private.config.json：urlCheck=false");
}

console.log(
  "\n下一步：微信开发者工具导入仓库根目录，AppID 与公众平台一致，后端选「不使用云服务」。\n" +
    "真机调试前请在 mp.weixin.qq.com → 开发管理 → 开发设置 → 服务器域名，\n" +
    "添加 request / uploadFile / downloadFile 合法域名（与 apiBaseUrl 主机名一致）。",
);
