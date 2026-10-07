import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { buildApp } from "../server/src/app.js";
import { settings } from "../server/src/config.js";

test("mini program API adapter: no fallback, upload retry, recoverable drill and private cache isolation", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-client-"));
  const cfg = settings({
    DATA_MODE: "demo",
    DEMO_EXPERIENCE: "true",
    DATABASE_PATH: path.join(dir, "test.sqlite"),
  });
  const app = await buildApp(cfg);
  const require = createRequire(path.resolve("tests/connected-client.test.ts"));
  const storage = new Map<string, any>();
  const calls: string[] = [];
  let failBefore = false,
    failMessage = "offline",
    dropResponse = "",
    uploads = 0;
  let fakeNow = Date.now();
  const originalNow = Date.now;
  const bytes = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "#442211" },
  })
    .png()
    .toBuffer();
  const wx: any = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: "develop" } }),
    getStorageSync: (key: string) => structuredClone(storage.get(key)),
    setStorageSync: (key: string, value: any) =>
      storage.set(key, structuredClone(value)),
    removeStorageSync: (key: string) => storage.delete(key),
    getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
    getFileSystemManager: () => ({ unlink: () => {} }),
    login: () => {
      throw new Error("Local mode must not call real WeChat login");
    },
    request: (options: any) => {
      const url = new URL(options.url);
      calls.push((options.method || "GET") + " " + url.pathname);
      if (failBefore) {
        options.fail({ errMsg: failMessage });
        return;
      }
      let requestUrl = url.pathname + url.search;
      if ((options.method || "GET") === "GET" && options.data)
        requestUrl += "?" + new URLSearchParams(options.data);
      void app
        .inject({
          method: options.method || "GET",
          url: requestUrl,
          headers: options.header,
          payload: options.method === "GET" ? undefined : options.data,
        })
        .then((res) => {
          if (dropResponse === url.pathname && options.method !== "GET") {
            dropResponse = "";
            options.fail({ errMsg: "response lost" });
          } else
            options.success({ statusCode: res.statusCode, data: res.json() });
        })
        .catch(options.fail);
    },
    uploadFile: (options: any) => {
      uploads++;
      const boundary = "client-upload";
      void app
        .inject({
          method: "POST",
          url: "/api/attachments",
          headers: {
            ...options.header,
            "content-type": "multipart/form-data; boundary=" + boundary,
          },
          payload: Buffer.concat([
            Buffer.from(
              `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n`,
            ),
            bytes,
            Buffer.from(`\r\n--${boundary}--\r\n`),
          ]),
        })
        .then((res) =>
          options.success({ statusCode: res.statusCode, data: res.body }),
        )
        .catch(options.fail);
    },
  };
  (globalThis as any).wx = wx;
  (globalThis as any).getCurrentPages = () => [];
  const config = require("../mobile/config/index.js");
  const originalConfig = { ...config };
  config.mode = "local";
  config.loginMode = "dev-login";
  config.transport = "direct";
  config.apiBaseUrl = "http://127.0.0.1:3000/api";
  const repo = require("../mobile/services/repository.js"),
    session = require("../mobile/services/session.js"),
    clock = require("../mobile/services/drill-clock.js");
  try {
    await assert.rejects(repo.login(false, cfg.legalVersion));
    assert.equal(calls.length, 0);
    failBefore = true;
    await assert.rejects(repo.login(true, cfg.legalVersion));
    assert.equal(session.get(), null);
    failBefore = false;
    await repo.login(true, cfg.legalVersion);
    assert.equal(
      (await repo.me()).bindings.length,
      0,
      "new user must not acquire example residence",
    );
    await repo.bind({ floorId: "floor-1-1-6", room: "601" });
    const form = {
      idempotencyKey: "client-report-retry",
      type: "obstruction",
      floorId: "floor-1-1-6",
      location: "东侧测试走廊",
      description: "上报现场发现测试纸箱堆积。",
      contact: "13800000000",
      photos: ["/tmp/client-image.png"],
    };
    dropResponse = "/api/reports";
    await assert.rejects(repo.createReport(form), /连接失败/);
    assert.equal(uploads, 1);
    const report = await repo.createReport(form);
    assert.equal(
      uploads,
      1,
      "retry resolves created report before another upload",
    );
    assert.equal((await repo.reportStats()).total, 1);
    assert.equal((await repo.report(report.id)).description, form.description);
    const publicReport = await repo.report(report.id, true);
    assert.equal(publicReport.contact, undefined);
    failBefore = true;
    await assert.rejects(repo.reports(true, {}), /连接失败/);
    failBefore = false;
    const first = await repo.createDrill({ floorId: "floor-1-1-6" });
    assert.equal(first.completedSteps.length, 0);
    Date.now = () => fakeNow;
    clock.start(first.id);
    fakeNow += 1500;
    clock.pause();
    assert.equal(clock.payload(first.id).durationMs, 1500);
    fakeNow += 60000;
    clock.start(first.id);
    fakeNow += 500;
    clock.pause();
    assert.equal(
      clock.payload(first.id).durationMs,
      2000,
      "background time excluded",
    );
    await repo.confirmStep(first.id, "exit");
    await repo.confirmStep(first.id, "assembly");
    dropResponse = `/api/drills/${first.id}/complete`;
    await assert.rejects(repo.complete(first.id));
    assert.equal(clock.load(first.id).pendingAction, "complete");
    const completed = await repo.complete(first.id);
    assert.equal(completed.status, "completed");
    assert.equal(completed.durationSeconds, 2);
    assert.equal(completed.completedSteps.length, 2);
    assert.equal((await repo.drillStats()).completedCount, 1);
    const second = await repo.createDrill({ floorId: "floor-1-1-6" });
    assert.notEqual(second.id, first.id);
    await repo.abort(second.id);
    assert.equal((await repo.drill(second.id)).status, "aborted");
    await assert.rejects(repo.complete(second.id), /已经结束/);
    const privateKey = session.privateKey("report-draft");
    wx.setStorageSync(privateKey, { contact: "private" });
    const oldToken = session.get().token;
    await repo.logout();
    assert.equal(session.get(), null);
    assert.equal(storage.has(privateKey), false);
    assert.equal(
      (
        await app.inject({
          url: "/api/me",
          headers: { authorization: "Bearer " + oldToken },
        })
      ).statusCode,
      401,
    );
    await repo.login(true, cfg.legalVersion);
    assert.equal(
      (await repo.reports(true, {})).total,
      1,
      "logout retains database records",
    );
    delete require.cache[require.resolve("../mobile/services/session.js")];
    assert.equal(
      require("../mobile/services/session.js").get().user.id,
      session.get().user.id,
      "business session restores from client storage",
    );
    await repo.logout();
    config.loginMode = "demo-session";
    const anonymous = await repo.login(true, cfg.legalVersion);
    assert.equal(anonymous.bindings.length, 1);
    assert.equal(anonymous.bindings[0].floorId, "floor-1-1-6");
    assert.match(
      storage.get("anju:wechat-demo-installation:v1"),
      /^[A-Za-z0-9_-]{32,128}$/,
    );
    assert.ok(calls.includes("POST /api/auth/demo-session"));
    const http = require("../mobile/services/http.js");
    wx.getAccountInfoSync = () => ({ miniProgram: { envVersion: "trial" } });
    failBefore = true;
    await assert.rejects(http.request("/config"), /连接失败/);
    failMessage = "request:fail url not in domain list";
    await assert.rejects(http.request("/config"), /request合法域名/);
    wx.getAccountInfoSync = () => ({ miniProgram: { envVersion: "release" } });
    await assert.rejects(http.request("/config"), /仅允许开发版和比赛体验版/);
    config.mode = "api";
    failMessage = "offline";
    await assert.rejects(http.request("/config"), /连接失败/);
  } finally {
    clock.reset();
    Date.now = originalNow;
    Object.assign(config, originalConfig);
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
