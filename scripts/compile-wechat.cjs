// Uses the real WeChat DevTools WXML/WXSS compiler; this is NOT simulator acceptance.
const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const install =
  process.env.WECHAT_DEVTOOLS_PATH ||
  "D:/DevTools/wechat_devtools/微信web开发者工具";
const bin = path.join(
  install,
  "resources/app.asar.unpacked/node_modules/wcc-exec",
);
const files = [];
for (const dir of ["pages", "components"]) {
  for (const name of fs.readdirSync(dir)) {
    const root = path.join(dir, name);
    if (fs.statSync(root).isDirectory())
      for (const f of fs.readdirSync(root))
        files.push(path.join(root, f).replaceAll("\\", "/"));
  }
}
fs.mkdirSync("artifacts/compiler", { recursive: true });
const evidence = {
  at: new Date().toISOString(),
  toolDirectory: bin,
  scope:
    "WXML and WXSS compilation only; no simulator screenshots or phone validation",
  results: [],
};
for (const [tool, ext, list] of [
  ["wcc", ".wxml", files.filter((f) => f.endsWith(".wxml"))],
  ["wcsc", ".wxss", ["app.wxss", ...fs.readdirSync('styles').filter(f=>f.endsWith('.wxss')).map(f=>'styles/'+f), ...files.filter((f) => f.endsWith(".wxss"))]],
]) {
  const exe = path.join(bin, tool + ".exe");
  if (!fs.existsSync(exe))
    throw new Error(
      "Compiler missing; set WECHAT_DEVTOOLS_PATH to installation folder",
    );
  const output = "artifacts/compiler/" + tool + ".js";
  const r = spawnSync(exe, ["-o", output, ...list], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  evidence.results.push({
    tool,
    fileCount: list.length,
    exitCode: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
  });
  if (r.status !== 0) process.exitCode = 1;
  console.log(tool + ": " + list.length + " files, exit " + r.status);
  if (r.stderr) console.log(r.stderr);
}
fs.writeFileSync(
  "artifacts/compiler/result.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
