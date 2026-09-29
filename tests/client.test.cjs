const test = require("node:test"),
  assert = require("node:assert/strict");
const storage = new Map();
let requestCount = 0,
  loginCount = 0,
  nextResponse = null,
  networkFails = false,
  clockTime = 100000,
  intervalFn = null;
global.wx = {
  getStorageSync: (k) => storage.get(k),
  setStorageSync: (k, v) => storage.set(k, structuredClone(v)),
  removeStorageSync: (k) => storage.delete(k),
  getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
  getAccountInfoSync: () => ({ miniProgram: { envVersion: "develop" } }),
  request: (o) => {
    requestCount++;
    if (networkFails) o.fail({});
    else o.success(nextResponse);
  },
  login: (o) => {
    loginCount++;
    o.success({ code: "test" });
  },
};
const session = require("../services/session"),
  repo = require("../services/repository"),
  clock = require("../services/drill-clock"),
  config = require("../config/index");
test("consent, failed login, mode guards, no fake fallback and cache isolation", async () => {
  await assert.rejects(repo.login(false, "draft"));
  assert.equal(requestCount, 0);
  assert.equal(loginCount, 0);
  assert.equal(session.get(), null);
  nextResponse = {
    statusCode: 401,
    data: { error: { code: "FAILED", message: "登录失败" } },
  };
  await assert.rejects(repo.login(true, "draft"));
  assert.equal(session.get(), null);
  config.mode = "api";
  networkFails = true;
  await assert.rejects(repo.login(true, "draft"), /连接失败/);
  assert.equal(loginCount, 1);
  assert.equal(session.get(), null);
  config.mode = "demo";
  networkFails = false;
  wx.getAccountInfoSync = () => ({ miniProgram: { envVersion: "release" } });
  await assert.rejects(repo.login(true, "draft"), /禁止演示/);
  wx.getAccountInfoSync = () => ({ miniProgram: { envVersion: "develop" } });
  session.set({ token: "a", user: { id: "a" } });
  wx.setStorageSync(session.privateKey("report-draft"), { secret: "a" });
  session.clear();
  assert.equal(storage.size, 0);
});
test("foreground duration, hide/reopen, progress retry and terminal state", async () => {
  const realNow = Date.now,
    realSet = global.setInterval,
    realClear = global.clearInterval;
  Date.now = () => clockTime;
  global.setInterval = (fn) => {
    intervalFn = fn;
    return 1;
  };
  global.clearInterval = () => {
    intervalFn = null;
  };
  session.set({ token: "a", user: { id: "a" } });
  try {
    clock.importRecord({
      id: "d",
      status: "in_progress",
      durationMs: 0,
      completedSteps: [],
      snapshot: { steps: [] },
    });
    clock.start("d");
    clockTime += 2340;
    clock.pause();
    assert.equal(clock.load("d").durationMs, 2340);
    clockTime += 60000;
    clock.start("d");
    clockTime += 1200;
    intervalFn();
    clock.pause();
    assert.equal(clock.load("d").durationMs, 3540, "background must not count");
    clock.confirm("d", "exit");
    clock.confirm("d", "exit");
    assert.deepEqual(clock.load("d").completedSteps, ["exit"]);
    clock.confirm("d", "assembly");
    clock.pending("d", "complete");
    networkFails = true;
    await assert.rejects(clock.sync("d"));
    assert.equal(clock.load("d").pendingAction, "complete");
    assert.equal(clock.load("d").durationMs, 3540);
    networkFails = false;
    nextResponse = {
      statusCode: 200,
      data: {
        data: {
          id: "d",
          status: "completed",
          durationMs: 3540,
          completedSteps: [{ id: "exit" }, { id: "assembly" }],
          snapshot: { steps: [] },
        },
      },
    };
    await clock.sync("d");
    assert.equal(clock.load("d").status, "completed");
    assert.equal(clock.load("d").pendingAction, undefined);
    clockTime += 5000;
    clock.start("d");
    clockTime += 5000;
    clock.pause();
    assert.equal(clock.load("d").durationMs, 3540);
    clock.importRecord({
      id: "d",
      status: "in_progress",
      durationMs: 100,
      completedSteps: [],
      snapshot: { steps: [] },
    });
    assert.equal(
      clock.load("d").status,
      "completed",
      "late progress response must not regress terminal state",
    );
  } finally {
    clock.reset();
    session.clear();
    Date.now = realNow;
    global.setInterval = realSet;
    global.clearInterval = realClear;
    networkFails = false;
  }
});
