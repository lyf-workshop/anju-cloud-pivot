const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
assert.equal(app.tabBar.list.length, 4);
for (const page of app.pages)
  for (const ext of [".json", ".wxml", ".wxss", ".js"])
    assert.ok(fs.existsSync(page + ext), "Missing " + page + ext);
for (const file of Object.values(app.usingComponents))
  assert.ok(
    JSON.parse(fs.readFileSync("." + file + ".json", "utf8")).component,
  );
let checked = 0;
let assetsChecked = 0;
function asset(file) {
  assert.ok(
    fs.existsSync(file.replace(/^\//, "")),
    "Missing local asset " + file,
  );
  assetsChecked++;
}
for (const tab of app.tabBar.list) {
  asset(tab.iconPath);
  asset(tab.selectedIconPath);
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith(".js")) {
      const source = fs.readFileSync(p, "utf8");
      new vm.Script(source, { filename: p });
      for (const match of source.matchAll(/icon:\s*["']([\w-]+)["']/g))
        if (!["none", "success", "error", "loading"].includes(match[1]))
          asset("assets/icons/" + match[1] + ".png");
      checked++;
    } else if (p.endsWith(".json")) JSON.parse(fs.readFileSync(p, "utf8"));
    else if (p.endsWith(".wxml")) {
      const s = fs.readFileSync(p, "utf8");
      for (const match of s.matchAll(/<line-icon\s+name="([\w-]+)"/g))
        asset("assets/icons/" + match[1] + ".png");
      for (const match of s.matchAll(/src="(\/assets\/[^{}"]+)"/g))
        asset(match[1]);
      assert.ok(
        !/<(?:br|div|span|p)(?:\s|\/|>)/.test(s),
        "Unsupported HTML element in " + p,
      );
      assert.ok(
        !/\{\{[^}]*\r?\n[^}]*\}\}/.test(s),
        "Keep WXML expressions on one line: " + p,
      );
      assert.ok(
        !/\{\{[^}]*\.(?:map|filter|indexOf)\(/.test(s),
        "Unsupported WXML method in " + p,
      );
    }
  }
}
for (const dir of [
  "pages",
  "components",
  "services",
  "utils",
  "config",
  "mock",
])
  walk(dir);
console.log(
  "Client static checks passed: " +
    app.pages.length +
    " routes, " +
    checked +
    " JS files, " +
    assetsChecked +
    " local asset references. WXML runtime compilation requires WeChat DevTools.",
);
