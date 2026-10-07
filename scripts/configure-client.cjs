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
  login: "安居云枢",
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
  ["building", "楼栋", "cube"],
  ["me", "我的", "user"],
];
fs.writeFileSync(
  "app.json",
  JSON.stringify(
    {
      pages: [
        "login",
        ...Object.keys(routes).filter((name) => name !== "login"),
      ]
        .map((n) => "pages/" + n + "/" + n)
        .concat(["pages/logs/logs"]),
      window: {
        navigationBarTextStyle: "black",
        navigationBarTitleText: "安居云枢",
        navigationBarBackgroundColor: "#F4F6F9",
        backgroundColor: "#F4F6F9",
        backgroundTextStyle: "dark",
      },
      tabBar: {
        color: "#8893A3",
        selectedColor: "#D44730",
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
  ...(p.packOptions.ignore || []).filter(item => !["services/http.js", "services/drill-clock.js"].includes(item.value)),
  ...[
    "server",
    "安居云枢网页端(1)",
    "output",
    ".playwright-cli",
    ".git",
    "android",
    "apps",
    "build",
    "deploy",
    "edge",
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
    "config/local.js",
    "services/privacy.js",
    ".gitattributes",
    ".prettierignore",
    "anju-cloud-pivot-main.zip",
    "安居云枢网页端(2).zip",
    "capacitor.config.json",
    "electron-builder.yml",
    "assets/illustrations/fire-poster-1.jpg",
    "assets/illustrations/fire-poster-2.jpg",
    "assets/illustrations/fire-poster-3.jpg",
    "assets/illustrations/fire-poster-4.jpg",
    "assets/illustrations/fire-poster-5.jpg",
    "assets/illustrations/hero-slide-2.jpg",
    "assets/illustrations/hero-slide-3.jpg",
    "assets/illustrations/home-cover-bg.png",
  ].map((value) => ({ type: "file", value })),
];
p.packOptions.ignore = p.packOptions.ignore.filter(
  (item, index, list) =>
    list.findIndex(
      (other) => other.type === item.type && other.value === item.value,
    ) === index,
);
fs.writeFileSync("project.config.json", JSON.stringify(p, null, 2) + "\n");
