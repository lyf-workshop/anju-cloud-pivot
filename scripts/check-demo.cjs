// Small, offline smoke check of the real page controllers. This is not a simulator.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
// Check the retained offline edition without changing project files.
require("../config/index").mode = "showcase";
let definition,
  networkCalls = 0,
  phoneCalls = 0,
  privacyCalls = 0;
const pages = [],
  navigation = [],
  dialogs = [];
const forbidden = (name) => () => {
  networkCalls++;
  throw new Error("Showcase must not call " + name);
};
function navigate(options) {
  assert.ok(
    app.pages.includes(options.url.split("?")[0].replace(/^\//, "")),
    "Unknown route " + options.url,
  );
  navigation.push(options.url);
}
global.wx = {
  request: forbidden("request"),
  login: forbidden("login"),
  uploadFile: forbidden("uploadFile"),
  downloadFile: forbidden("downloadFile"),
  connectSocket: forbidden("connectSocket"),
  cloud: { callFunction: forbidden("cloud") },
  makePhoneCall: () => {
    phoneCalls++;
    throw new Error("No real phone calls");
  },
  requirePrivacyAuthorize: () => {
    privacyCalls++;
    throw new Error("No uploaded photos");
  },
  navigateTo: navigate,
  redirectTo: navigate,
  switchTab: (o) => {
    assert.ok(app.tabBar.list.some((t) => t.pagePath === o.url.slice(1)));
    navigate(o);
  },
  reLaunch: navigate,
  navigateBack() {
    navigation.push("back");
  },
  showModal: (o) => {
    dialogs.push(o);
    if (o.success) o.success({ confirm: true });
  },
  showToast() {},
  setNavigationBarTitle() {},
  stopPullDownRefresh() {},
  setClipboardData: (o) => o.success && o.success(),
  chooseMedia: (o) =>
    o.success({
      tempFiles: [{ tempFilePath: "/tmp/demo-photo.jpg", size: 2048 }],
    }),
  previewImage: (o) => assert.ok(o.urls.includes(o.current)),
};
global.Page = (spec) => {
  definition = spec;
};
global.getCurrentPages = () => pages;
function page(name, query = {}) {
  const file = require.resolve("../pages/" + name + "/" + name + ".js");
  delete require.cache[file];
  require(file);
  const p = { ...definition, data: structuredClone(definition.data) };
  p.setData = (patch) => {
    for (const [key, value] of Object.entries(patch)) {
      const parts = key.split(".");
      let target = p.data;
      parts.slice(0, -1).forEach((k) => {
        target = target[k] ??= {};
      });
      target[parts.at(-1)] = structuredClone(value);
    }
  };
  pages.push(p);
  p.onLoad && p.onLoad(query);
  const wxml = fs.readFileSync(file.replace(/\.js$/, ".wxml"), "utf8");
  for (const match of wxml.matchAll(/(?:bind:?\w+|catch:?\w+)="(\w+)"/g))
    assert.equal(
      typeof p[match[1]],
      "function",
      name + ": missing handler " + match[1],
    );
  return p;
}
async function settle() {
  for (let n = 0; n < 8; n++) await new Promise((r) => setImmediate(r));
  for (const p of pages) assert.ok(!p.data.error, p.data.error);
}
const event = (field, value) => ({
  currentTarget: { dataset: { field } },
  detail: { value },
});
async function main() {
  const repo = require("../services/repository"),
    session = require("../services/session"),
    data = require("../mock/data"),
    store = require("../mock/store");
  assert.equal(app.pages[0], "pages/login/login");
  assert.deepEqual(
    app.tabBar.list.map((t) => t.text),
    ["首页", "隐患", "楼栋", "我的"],
  );
  const login = page("login");
  await settle();
  assert.equal(login.data.agreed, false);
  login.submit();
  await settle();
  assert.equal(session.get(), null);
  const terms = page("legal", { type: "terms" });
  await settle();
  assert.ok(terms.data.text);
  assert.equal(login.data.agreed, false);
  login.toggleAgree();
  login.submit();
  await settle();
  assert.equal(navigation.at(-1), "/pages/register/register");
  const register = page("register");
  register.onShow();
  await settle();
  register.pickUnit({ detail: { value: 0 } });
  await settle();
  register.pickFloor({ detail: { value: 5 } });
  register.inputRoom({ detail: { value: "601" } });
  register.inputFamily({ detail: { value: "3" } });
  register.next();
  assert.equal(register.data.step, 2);
  register.skip();
  await settle();
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.equal(navigation.at(-1), "/pages/register-done/register-done");
  const registered = page("register-done");
  registered.goHome();
  assert.equal(navigation.at(-1), "/pages/index/index");
  const home = page("index");
  home.onShow();
  await settle();
  assert.equal(home.data.home.community.name, data.community.name);
  const hazards = page("hazards");
  hazards.onShow();
  await settle();
  assert.equal(hazards.data.items.length, 3);
  hazards.filter({ currentTarget: { dataset: { id: "processing" } } });
  await settle();
  assert.ok(hazards.data.items.every((r) => r.status === "processing"));
  const report = page("report");
  report.location({ detail: data.defaultSelection });
  report.input(event("location", "6层楼梯间"));
  report.input(event("description", "展示测试：楼道内有杂物需要清理"));
  report.pickCategory({ currentTarget: { dataset: { id: "passage" } } });
  report.pickHazard({ currentTarget: { dataset: { id: "exit-blocked" } } });
  await report.choose();
  report.preview({
    currentTarget: { dataset: { path: report.data.photos[0].path } },
  });
  assert.equal(report.data.photos.length, 1);
  await report.submit();
  await settle();
  const rid = navigation.at(-1).split("id=")[1];
  const result = page("report-result", { id: rid });
  result.onShow();
  const detail = page("report-detail", { id: rid });
  detail.onShow();
  const mine = page("my-reports");
  mine.onShow();
  await settle();
  assert.equal(result.data.record.id, detail.data.record.id);
  assert.equal(detail.data.record.description, report.data.form.description);
  assert.deepEqual(detail.data.images, ["/tmp/demo-photo.jpg"]);
  assert.equal(mine.data.items[0].id, rid);
  assert.equal(mine.data.stats.total, 4);
  const building = page("building");
  building.onShow();
  building.changed({ detail: data.defaultSelection });
  await settle();
  assert.equal(building.data.deviceTotal, 3);
  building.changed({
    detail: { ...data.defaultSelection, floorId: "floor-1-1-7" },
  });
  await settle();
  assert.equal(building.data.devices[1].connectionStatus, "offline");
  const devices = page("devices", { floorId: "floor-1-1-7" });
  devices.onShow();
  await settle();
  assert.equal(devices.data.items.length, 3);
  building.start();
  await settle();
  const did = navigation.at(-1).split("id=")[1];
  store.get().drills.find((d) => d.id === did).startedAt = new Date(
    Date.now() - 5500,
  ).toISOString();
  const exit = page("drill", { id: did });
  exit.onShow();
  await settle();
  await exit.confirm();
  assert.ok(navigation.at(-1).includes("/assembly/"));
  const assembly = page("assembly", { id: did });
  assembly.onShow();
  await settle();
  await assembly.confirm();
  const summary = page("drill-summary", { id: did });
  summary.onShow();
  await settle();
  assert.equal(summary.data.record.completedCount, 2);
  assert.ok(summary.data.record.durationSeconds >= 5);
  const history = page("drill-records");
  history.onShow();
  await settle();
  assert.equal(history.data.stats.completedCount, 3);
  assert.equal(history.data.items[0].id, did);
  const historic = page("drill-summary", { id: "drill-demo-2" });
  historic.onShow();
  await settle();
  assert.equal(historic.data.record.durationText, "01:48");
  await summary.again();
  assert.notEqual(navigation.at(-1).split("id=")[1], did);
  const emergency = page("emergency");
  emergency.onShow();
  await settle();
  emergency.call({ currentTarget: { dataset: { kind: "fire" } } });
  emergency.call({ currentTarget: { dataset: { kind: "property" } } });
  assert.ok(dialogs.slice(-2).every((d) => d.content.includes("不会实际拨打")));
  for (const name of ["addresses", "profile", "notices", "help"]) {
    const p = page(name);
    p.onShow && p.onShow();
    await settle();
  }
  const me = page("me");
  me.onShow();
  await settle();
  assert.equal(me.data.reportStats.total, 4);
  me.logout();
  await settle();
  assert.equal(navigation.at(-1), "/pages/login/login");
  assert.equal(session.get(), null);
  assert.equal((await repo.reportStats()).total, 3);
  // Ensure dormant HTTP / old sync modules are not loaded through the app pages.
  const loaded = Object.keys(require.cache).map((p) => p.replaceAll("\\", "/"));
  assert.ok(
    !loaded.some((p) => /\/services\/(http|drill-clock|privacy)\.js$/.test(p)),
  );
  assert.equal(networkCalls, 0);
  assert.equal(phoneCalls, 0);
  assert.equal(privacyCalls, 0);
  fs.mkdirSync("artifacts/showcase", { recursive: true });
  const evidence = {
    at: new Date().toISOString(),
    result: "passed",
    productPagesChecked: 22,
    networkCalls,
    phoneCalls,
    checks: [
      "consent, local login and two-step household registration",
      "all product page controllers and handlers",
      "four tab routes",
      "local filters",
      "selected photo preview",
      "new report/result/detail consistency",
      "floor/device switching",
      "drill steps/duration/summary/history/repeat",
      "emergency dialogs",
      "logout to login and reset",
    ],
    scope:
      "Node controller smoke with wx stubs; not WeChat UI or device verification",
  };
  fs.writeFileSync(
    "artifacts/showcase/flows.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(
    "Local showcase smoke passed: 22 product pages; 0 network requests; 0 phone calls.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
