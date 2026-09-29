const fs = require("node:fs");
const routes = {
  index: "安居云枢",
  hazards: "社区隐患",
  building: "楼栋安全",
  me: "我的",
  report: "隐患上报",
  "report-result": "上报结果",
  "report-detail": "上报详情",
  drill: "线上疏散演练",
  emergency: "紧急求助",
  "my-reports": "我的上报",
  devices: "感知设备",
  assembly: "演练集合点",
  login: "登录",
  "drill-summary": "演练总结",
  "drill-records": "演练记录",
  addresses: "住址管理",
  profile: "个人资料",
  notices: "社区通知",
  help: "设置与帮助",
  legal: "用户协议",
};
const components = [
  "ui-button",
  "ui-card",
  "ui-state",
  "status-tag",
  "line-icon",
  "mode-banner",
  "location-picker",
];
for (const [name, title] of Object.entries(routes)) {
  fs.writeFileSync(
    "pages/" + name + "/" + name + ".json",
    JSON.stringify(
      {
        navigationBarTitleText: title,
        enablePullDownRefresh: ![
          "report",
          "drill",
          "assembly",
          "login",
          "addresses",
          "profile",
        ].includes(name),
      },
      null,
      2,
    ) + "\n",
  );
  const css = "pages/" + name + "/" + name + ".wxss";
  if (!fs.existsSync(css))
    fs.writeFileSync(css, "/* Uses shared app.wxss design tokens. */\n");
}
for (const name of components) {
  const file = "components/" + name + "/" + name;
  fs.writeFileSync(
    file + ".json",
    JSON.stringify(
      {
        component: true,
        usingComponents:
          name === "location-picker"
            ? { "ui-state": "/components/ui-state/ui-state" }
            : {},
      },
      null,
      2,
    ) + "\n",
  );
  if (!fs.existsSync(file + ".wxss")) fs.writeFileSync(file + ".wxss", "");
}
const usingComponents = Object.fromEntries(
  components.map((n) => [n, "/components/" + n + "/" + n]),
);
const tabs = [
  ["index", "首页", "home"],
  ["hazards", "隐患", "hazard"],
  ["building", "楼栋", "building"],
  ["me", "我的", "user"],
];
fs.writeFileSync(
  "app.json",
  JSON.stringify(
    {
      pages: Object.keys(routes)
        .map((n) => "pages/" + n + "/" + n)
        .concat(["pages/logs/logs"]),
      window: {
        navigationBarTextStyle: "black",
        navigationBarTitleText: "安居云枢",
        navigationBarBackgroundColor: "#F5F6F8",
        backgroundColor: "#F5F6F8",
        backgroundTextStyle: "dark",
      },
      tabBar: {
        color: "#8893A3",
        selectedColor: "#EC695E",
        backgroundColor: "#FFFFFF",
        borderStyle: "white",
        list: tabs.map(([name, text, icon]) => ({
          pagePath: "pages/" + name + "/" + name,
          text,
          iconPath: "assets/icons/" + icon + ".png",
          selectedIconPath: "assets/icons/" + icon + "-active.png",
        })),
      },
      usingComponents,
      style: "v2",
      componentFramework: "glass-easel",
      sitemapLocation: "sitemap.json",
      lazyCodeLoading: "requiredComponents",
    },
    null,
    2,
  ) + "\n",
);
const p = JSON.parse(fs.readFileSync("project.config.json", "utf8"));
p.miniprogramRoot = "./";
p.libVersion = "3.17.3";
p.projectname = "Anju_CloudPivot";
p.packOptions.ignore = [
  ...(p.packOptions.ignore || []),
  ...[
    "server",
    "dist",
    "node_modules",
    "tests",
    "scripts",
    "docs",
    "artifacts",
  ].map((value) => ({ type: "folder", value })),
  ...[
    "package.json",
    "package-lock.json",
    "README.md",
    ".gitignore",
    "config/local.example.js",
  ].map((value) => ({ type: "file", value })),
];
fs.writeFileSync("project.config.json", JSON.stringify(p, null, 2) + "\n");
