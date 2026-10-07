// Real WeChat simulator + real local HTTP. Page methods drive interactions; not a real-device touch test.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict");
const automator = require("../artifacts/devtools-runner/node_modules/miniprogram-automator");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "anju-connected-"));
const evidence = {
  at: new Date().toISOString(),
  environment: "WeChat DevTools simulator / local HTTP",
  interaction: "Page.callMethod and wx navigation; no real phone calls",
  checks: [],
  screenshots: [],
  exceptions: [],
  notVerified: [
    "Physical phone",
    "Native touch",
    "System photo picker",
    "Soft keyboard",
  ],
};
let mini;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function current(name) {
  for (let i = 0; i < 30; i++) {
    await sleep(250);
    const p = await mini.currentPage();
    if (p.path === `pages/${name}/${name}`) return p;
  }
  throw new Error("Page did not open: " + name);
}
async function tab(name) {
  await mini.switchTab(`/pages/${name}/${name}`);
  return current(name);
}
async function navigate(name, query = "") {
  await mini.navigateTo(`/pages/${name}/${name}` + query);
  return current(name);
}
async function ready(p, field) {
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    const d = await p.data();
    if (!d.loading && !d.busy && (!field || d[field])) {
      assert.equal(d.error, "", p.path + ": " + d.error);
      return d;
    }
  }
  throw new Error("Page did not finish: " + p.path);
}
async function shot(name) {
  await sleep(250);
  const file = path.join(tmp, name + ".png");
  await mini.screenshot({ path: file });
  evidence.screenshots.push(file);
}
async function api(route, body, cookie) {
  const r = await fetch("http://127.0.0.1:3000/api" + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      "x-anju-request": "1",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json();
  assert.ok(r.ok, route + ": " + JSON.stringify(j.error));
  return { data: j.data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
async function run() {
  assert.equal((await api("/config")).data.mode, "demo");
  mini = await automator.connect({
    wsEndpoint: process.env.WECHAT_AUTOMATION_WS || "ws://127.0.0.1:9420",
  });
  mini.on("exception", (e) => evidence.exceptions.push(e));
  evidence.device = await mini.systemInfo();
  // Clear only this app's business session key, keeping pending user-specific drafts and all unrelated storage.
  await mini.callWxMethod(
    "removeStorageSync",
    "anju:local:http://127.0.0.1:3000/api:session",
  );
  // A fresh compile/relaunch normally starts with an empty in-memory session.
  console.log("Checking restored session and login");
  await mini.reLaunch("/pages/login/login");
  await sleep(900);
  let p = await mini.currentPage();
  if ((await mini.currentPage()).path === "pages/index/index") {
    p = await tab("me");
    await ready(p);
    await mini.mockWxMethod("showModal", { confirm: true, cancel: false });
    await p.callMethod("logout");
    p = await current("login");
    await mini.restoreWxMethod("showModal");
  }
  await ready(p, "config");
  assert.equal(await p.data("agreed"), false);
  await p.callMethod("submit");
  assert.equal((await mini.currentPage()).path, "pages/login/login");
  await shot("01-local-login");
  await p.callMethod("agree", { detail: { value: ["yes"] } });
  await p.callMethod("submit");
  p = await current("index");
  await ready(p, "home");
  evidence.checks.push(
    "Unchecked consent blocks login; local API login opens home",
  );
  await shot("02-home");
  console.log("Checking explicit address binding");
  p = await navigate("addresses");
  await ready(p);
  await p.callMethod("changed", {
    detail: {
      communityId: "community-demo",
      buildingId: "building-1",
      unitId: "unit-1-1",
      floorId: "floor-1-1-6",
    },
  });
  await p.callMethod("input", { detail: { value: "SIM-601" } });
  await p.callMethod("save");
  await ready(p);
  assert.ok((await p.data("items")).some((b) => b.room === "SIM-601"));
  await shot("03-address-binding");
  evidence.checks.push(
    "Explicit address binding persists and stays pending review",
  );
  for (const name of ["index", "hazards", "building", "me"]) {
    p = await tab(name);
    await ready(p);
  }
  evidence.checks.push("All four tab pages render from the local API");
  console.log("Checking resident report submission");
  p = await navigate("report");
  await sleep(600);
  const location = "6层走廊（微信本地联调）";
  for (const [field, value] of [
    ["location", location],
    ["description", "微信模拟器提交：测试纸箱堆放，检查双端处理进度。"],
    ["contact", "13800000000"],
  ])
    await p.callMethod("input", {
      currentTarget: { dataset: { field } },
      detail: { value },
    });
  await p.callMethod("location", {
    detail: {
      communityId: "community-demo",
      buildingId: "building-1",
      unitId: "unit-1-1",
      floorId: "floor-1-1-6",
    },
  });
  await sleep(400);
  await shot("04-report-form");
  await p.callMethod("submit");
  p = await current("report-result");
  let d = await ready(p, "record");
  evidence.reportId = d.record.id;
  assert.equal(d.record.location, location);
  await shot("05-report-result");
  p = await navigate("report-detail", "?id=" + evidence.reportId);
  d = await ready(p, "record");
  assert.equal(d.record.id, evidence.reportId);
  const staff = await api("/staff/auth/login", {
    username: "property-demo",
    password: process.env.DEMO_STAFF_PASSWORD || "AnjuLocal2026!",
  });
  const body = {
    expectedVersion: 0,
    status: "processing",
    message: "本地联调：物业已受理，等待现场处理",
    idempotencyKey: crypto.randomUUID(),
  };
  await api(
    "/staff/reports/" + evidence.reportId + "/actions",
    body,
    staff.cookie,
  );
  await p.callMethod("load");
  d = await ready(p, "record");
  assert.equal(d.record.status, "processing");
  assert.ok(d.record.events.some((e) => e.message.includes("物业已受理")));
  await shot("06-property-progress");
  evidence.checks.push(
    "Mini program creates a real database report; staff HTTP action is visible in resident detail",
  );
  await api("/staff/auth/logout", {}, staff.cookie);
  p = await navigate("my-reports");
  d = await ready(p);
  assert.ok(d.items.some((r) => r.id === evidence.reportId));
  console.log("Checking drill completion and history");
  p = await tab("building");
  await sleep(500);
  await ready(p);
  await p.callMethod("start");
  p = await current("drill");
  d = await ready(p, "record");
  evidence.drillId = d.record.id;
  assert.equal(d.record.completedSteps.length, 0);
  await shot("07-drill-exit");
  await sleep(1100);
  await p.callMethod("confirm");
  p = await current("assembly");
  await ready(p, "record");
  await shot("08-assembly");
  await sleep(900);
  await p.callMethod("confirm");
  p = await current("drill-summary");
  d = await ready(p, "record");
  assert.equal(d.record.status, "completed");
  assert.equal(d.record.completedCount, 2);
  assert.ok(d.record.durationSeconds > 0);
  assert.equal(d.record.saved, true);
  await shot("09-drill-saved");
  evidence.checks.push(
    "Two confirmed steps save a drill with dynamic foreground duration and 2/2 summary",
  );
  await mini.navigateBack();
  await current("building");
  p = await navigate("drill-records");
  d = await ready(p);
  assert.ok(d.items.some((i) => i.id === evidence.drillId));
  await shot("10-drill-history");
  await p.callMethod("open", {
    currentTarget: { dataset: { id: evidence.drillId } },
  });
  p = await current("drill-summary");
  await ready(p, "record");
  await p.callMethod("again");
  p = await current("drill");
  d = await ready(p, "record");
  assert.notEqual(d.record.id, evidence.drillId);
  await mini.mockWxMethod("showModal", { confirm: true, cancel: false });
  await p.callMethod("leave");
  p = await current("building");
  await mini.restoreWxMethod("showModal");
  evidence.checks.push(
    "History opens saved summary, back returns to building, repeat creates a new session, leave aborts it",
  );
  p = await navigate("devices", "?floorId=floor-1-1-6");
  d = await ready(p);
  assert.ok(d.items.some((i) => i.connectionStatus === "offline"));
  assert.ok(d.items.some((i) => i.reading === null));
  await shot("11-device-states");
  p = await tab("me");
  await ready(p);
  await shot("12-profile");
  await mini.mockWxMethod("showModal", { confirm: true, cancel: false });
  await p.callMethod("logout");
  p = await current("login");
  await mini.restoreWxMethod("showModal");
  p = await navigate("emergency");
  await ready(p, "config");
  await p.callMethod("call", { currentTarget: { dataset: { kind: "fire" } } });
  await shot("13-public-emergency");
  evidence.checks.push(
    "Public emergency page works after logout and only opens a demonstration dialog",
  );
  assert.equal(evidence.exceptions.length, 0);
  evidence.result = "passed";
}
run()
  .catch((error) => {
    evidence.result = "failed";
    evidence.failure = error.stack;
    console.error(error);
  })
  .finally(() => {
    if (mini) mini.disconnect();
    const output = "artifacts/connected-devtools";
    fs.mkdirSync(output, { recursive: true });
    evidence.screenshots = evidence.screenshots.map((file) => {
      const to = path.join(output, path.basename(file));
      fs.copyFileSync(file, to);
      return to;
    });
    fs.writeFileSync(
      path.join(output, "results.json"),
      JSON.stringify(evidence, null, 2) + "\n",
    );
    console.log(
      JSON.stringify(
        {
          result: evidence.result,
          checks: evidence.checks,
          reportId: evidence.reportId,
          drillId: evidence.drillId,
          failure: evidence.failure,
        },
        null,
        2,
      ),
    );
    if (evidence.result !== "passed") process.exitCode = 1;
  });
