const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const automator = require("../artifacts/devtools-runner/node_modules/miniprogram-automator");

const projectPath = path.resolve(__dirname, "..");
const output = path.join(
  projectPath,
  "artifacts",
  "member-merge-20260929-202510",
  "verification",
  "devtools",
);
fs.mkdirSync(output, { recursive: true });
const capture = fs.mkdtempSync(path.join(os.tmpdir(), "anju-member-merge-"));

const evidence = {
  at: new Date().toISOString(),
  environment: "微信开发者工具模拟器 / 本地持久化 API",
  scope: "成员版界面、路由、自定义底栏与页面控制器运行检查；不替代真机相机权限测试",
  checks: [],
  screenshots: [],
  exceptions: [],
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let mini;

async function current(name) {
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const page = await mini.currentPage();
    if (page && page.path === `pages/${name}/${name}`) return page;
  }
  const page = await mini.currentPage();
  throw new Error(`未进入 ${name}，当前页面为 ${page && page.path}`);
}

async function ready(page, field) {
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    const data = await page.data();
    if (!data.loading && !data.busy && (!field || data[field])) {
      assert.equal(data.error || "", "", `${page.path}: ${data.error}`);
      return data;
    }
  }
  throw new Error(`${page.path} 加载超时`);
}

async function shot(name) {
  const file = path.join(capture, name + ".png");
  await sleep(350);
  await mini.screenshot({ path: file });
  evidence.screenshots.push(file);
}

async function tab(name) {
  await mini.switchTab(`/pages/${name}/${name}`);
  const page = await current(name);
  await ready(page);
  return page;
}

async function run() {
  mini = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
  mini.on("exception", (error) => evidence.exceptions.push(String(error)));
  evidence.device = await mini.systemInfo();

  await mini.callWxMethod(
    "removeStorageSync",
    "anju:local:http://127.0.0.1:3000/api:session",
  );
  let page = await mini.reLaunch("/pages/login/login");
  await sleep(900);
  page = await mini.currentPage();
  if (page.path === "pages/index/index") {
    page = await tab("me");
    await mini.mockWxMethod("showModal", { confirm: true, cancel: false });
    await page.callMethod("logout");
    page = await current("login");
    await mini.restoreWxMethod("showModal");
  } else {
    page = await current("login");
  }
  await ready(page, "config");
  assert.equal(await page.data("agreed"), false);
  await shot("01-member-login");
  await page.callMethod("toggleAgree");
  assert.equal(await page.data("agreed"), true);
  await page.callMethod("submit");

  let active = await mini.currentPage();
  for (let i = 0; i < 40 && active.path === "pages/login/login"; i++) {
    await sleep(250);
    active = await mini.currentPage();
  }
  if (active.path === "pages/register/register") {
    await ready(active);
    evidence.checks.push("无住址会话正确进入成员版两步登记页");
    await shot("02-member-register");
    await active.callMethod("goHome");
  }
  page = await current("index");
  await ready(page, "home");
  await shot("03-member-home");
  evidence.checks.push("成员版登录入口与首页在真实模拟器中渲染");

  for (const [name, image] of [
    ["hazards", "04-member-hazards"],
    ["building", "05-member-building"],
    ["me", "06-member-me"],
  ]) {
    page = await tab(name);
    await shot(image);
  }
  evidence.checks.push("四个自定义底栏页面均可切换且控制器无报错");

  page = await mini.navigateTo("/pages/register/register?mode=edit");
  page = await current("register");
  await ready(page);
  await shot("07-member-register-edit");

  await mini.navigateBack();
  page = await tab("building");
  for (const [name, image] of [
    ["building-equipment", "08-member-building-equipment"],
    ["building-escape", "09-member-building-escape"],
    ["building-chat", "10-member-building-chat"],
  ]) {
    page = await mini.navigateTo(`/pages/${name}/${name}`);
    page = await current(name);
    await ready(page);
    await shot(image);
    await mini.navigateBack();
    await current("building");
  }
  evidence.checks.push("新增楼栋设备、逃生指南和演示互通页均可打开");

  page = await mini.navigateTo("/pages/report/report");
  page = await current("report");
  await ready(page);
  await page.callMethod("pickCategory", {
    currentTarget: { dataset: { id: "passage" } },
  });
  await page.callMethod("pickHazard", {
    currentTarget: { dataset: { id: "exit-blocked" } },
  });
  await page.callMethod("input", {
    currentTarget: { dataset: { field: "location" } },
    detail: { value: "6层东侧公共走廊" },
  });
  await page.callMethod("input", {
    currentTarget: { dataset: { field: "description" } },
    detail: { value: "成员版合并验证：楼道有演示杂物。" },
  });
  await page.setData({
    photos: [{ path: "/assets/illustrations/hazard-exit-blocked.png" }],
  });
  await shot("11-member-report-filled");
  evidence.checks.push("新版隐患分类、示例图、表单与照片预览完成渲染");

  assert.deepEqual(evidence.exceptions, [], "模拟器出现运行时异常");
  evidence.result = "passed";
}

run()
  .catch((error) => {
    evidence.result = "failed";
    evidence.failure = error.stack;
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (mini) mini.disconnect();
    evidence.screenshots = evidence.screenshots.map((file) => {
      const target = path.join(output, path.basename(file));
      fs.copyFileSync(file, target);
      return path.relative(projectPath, target).replaceAll("\\", "/");
    });
    fs.writeFileSync(
      path.join(output, "results.json"),
      JSON.stringify(evidence, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        result: evidence.result,
        checks: evidence.checks,
        screenshots: evidence.screenshots.length,
        failure: evidence.failure,
      }),
    );
  });
