const fs = require("node:fs");
const { mobile } = require("./paths.cjs");
const selectedMode = process.argv[2];
if (!["showcase", "local", "remote-demo", "cloud-demo", "api"].includes(selectedMode))
  throw new Error(
    "Usage: node scripts/client-mode.cjs showcase|local|remote-demo|cloud-demo|api [API base URL] [cloud environment ID]",
  );
const remoteDemo = ["remote-demo", "cloud-demo"].includes(selectedMode);
const cloudDemo = selectedMode === "cloud-demo";
const mode = remoteDemo ? "local" : selectedMode;
const apiBaseUrl =
  process.argv[3] ||
  (remoteDemo
    ? "https://xn--9kqy92aeqav77a.com/api"
    : "http://127.0.0.1:3000/api");
const url = new URL(apiBaseUrl);
if ((mode === "api" || remoteDemo) && url.protocol !== "https:")
  throw new Error("Production and remote demo APIs require HTTPS");
fs.writeFileSync(
  mobile("config/index.js"),
  "// Non-sensitive client configuration. Do not put secrets here.\nmodule.exports = " +
    JSON.stringify(
      {
        mode,
        loginMode: remoteDemo
          ? "demo-session"
          : mode === "local"
            ? "dev-login"
            : mode === "api"
              ? "wechat"
              : "offline",
        transport: cloudDemo ? "cloud" : "direct",
        cloudEnv: cloudDemo ? process.argv[4] || "" : "",
        cloudFunctionName: "api-proxy",
        apiBaseUrl,
        requestTimeout: remoteDemo ? 25000 : 12000,
        demoAccount: "resident-a",
      },
      null,
      2,
    ) +
    ";\n",
);
console.log(
  "Client mode: " +
    selectedMode +
    "; API: " +
    apiBaseUrl +
    ". Recompile in WeChat DevTools.",
);
