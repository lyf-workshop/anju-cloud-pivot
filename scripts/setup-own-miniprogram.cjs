const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appId = process.argv[2] || "";
const mode = process.argv[3] || "remote-demo";
const apiBaseUrl = process.argv[4] || "https://xn--9kqy92aeqav77a.com/api";
const cloudEnv = process.argv[5] || "";

if (!appId) {
  throw new Error(
    "Usage: npm run wechat:setup -- <AppID> [remote-demo|cloud-demo] [HTTPS API] [cloud environment ID]",
  );
}
if (!["remote-demo", "cloud-demo"].includes(mode)) {
  throw new Error("Mode must be remote-demo or cloud-demo");
}

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

run("scripts/sync-wechat-appid.cjs", [appId]);
run("scripts/client-mode.cjs", [mode, apiBaseUrl, cloudEnv]);
run("scripts/check-client.cjs", []);

console.log(
  "Mini Program setup is ready. Import this repository root in WeChat DevTools and compile it.",
);
