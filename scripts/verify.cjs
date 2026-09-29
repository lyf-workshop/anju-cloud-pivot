const fs = require("node:fs"),
  { spawnSync } = require("node:child_process");
fs.mkdirSync("artifacts/showcase", { recursive: true });
const results = [];
for (const [name, script] of [
  ["static", "scripts/check-client.cjs"],
  ["flows", "scripts/check-demo.cjs"],
  ["wechat-compiler", "scripts/compile-wechat.cjs"],
]) {
  const r = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  fs.writeFileSync(
    "artifacts/showcase/" + name + ".txt",
    (r.stdout || "") + (r.stderr || ""),
  );
  results.push({ name, exitCode: r.status });
  console.log(name + ": " + (r.status === 0 ? "PASS" : "FAIL"));
  if (r.status !== 0) process.exitCode = 1;
}
if (fs.existsSync("artifacts/compiler/result.json"))
  fs.copyFileSync(
    "artifacts/compiler/result.json",
    "artifacts/showcase/compiler.json",
  );
fs.writeFileSync(
  "artifacts/showcase/results.json",
  JSON.stringify(
    {
      edition: "local-showcase",
      at: new Date().toISOString(),
      results,
      scope: 'Code/controller/offline compiler checks only; see artifacts/visual-v11/results.json for actual simulator evidence.',
      notVerifiedByThisScript: [
        "Figma original design comparison",
        "WeChat simulator rendering",
        "physical device rendering",
      ],
    },
    null,
    2,
  ) + "\n",
);
