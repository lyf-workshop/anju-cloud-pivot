import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildApp } from "../server/src/app.js";
import { settings } from "../server/src/config.js";

test("anonymous judge sessions restore one installation and isolate private records", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-judge-"));
  const cfg = settings({
    DATA_MODE: "demo",
    DEMO_EXPERIENCE: "true",
    DEMO_SESSION_TTL_HOURS: "2160",
    DATABASE_PATH: path.join(dir, "judge.sqlite"),
    CLIENT_ORIGINS: "app://anju,https://localhost",
  });
  let app = await buildApp(cfg);
  const call = async (
    method: any,
    url: string,
    body?: any,
    token?: string,
    origin = "app://anju",
  ) => {
    const res = await app.inject({
      method,
      url: "/api" + url,
      payload: body,
      headers: {
        origin,
        ...(token ? { authorization: "Bearer " + token } : {}),
      },
    });
    return { status: res.statusCode, body: res.json(), headers: res.headers };
  };
  const issue = (key: string, platform: "windows" | "android" = "windows") =>
    call("POST", "/auth/demo-session", {
      installationKey: key,
      platform,
      clientVersion: "1.0.0-test",
    });
  const keyA = "a".repeat(43);
  const keyB = "b".repeat(43);
  try {
    const first = await issue(keyA);
    assert.equal(first.status, 200);
    assert.equal(first.headers["access-control-allow-origin"], "app://anju");
    assert.equal(first.body.data.user.bindings.length, 1);
    assert.equal(first.body.data.user.bindings[0].floorId, "floor-1-1-6");
    assert.ok(Date.parse(first.body.data.expiresAt) - Date.now() > 80 * 86400000);

    const second = await issue(keyB, "android");
    assert.notEqual(second.body.data.user.id, first.body.data.user.id);
    const tokenA = first.body.data.token;
    const tokenB = second.body.data.token;
    const reportBody = {
      idempotencyKey: "judge-report-key-a",
      floorId: "floor-1-1-6",
      type: "obstruction",
      location: "六层公共走廊东侧",
      description: "评委匿名会话持久化隔离测试记录",
      contact: "13800000000",
      attachmentIds: [],
    };
    const report = await call("POST", "/reports", reportBody, tokenA);
    assert.equal(report.status, 200);
    assert.equal(
      (await call("GET", "/reports/mine", undefined, tokenB)).body.data.total,
      0,
    );
    assert.equal(
      (await call("GET", "/reports/" + report.body.data.id, undefined, tokenB))
        .status,
      404,
    );

    const drill = await call(
      "POST",
      "/drills",
      { floorId: "floor-1-1-6", idempotencyKey: "judge-drill-key-a" },
      tokenA,
    );
    assert.equal(drill.status, 200);
    const finished = await call(
      "POST",
      `/drills/${drill.body.data.id}/complete`,
      { durationMs: 0, completedSteps: ["exit", "assembly"] },
      tokenA,
    );
    assert.equal(finished.body.data.status, "completed");

    const bootstrap = await call(
      "GET",
      "/app/bootstrap?communityId=community-demo",
      undefined,
      tokenA,
    );
    assert.equal(bootstrap.status, 200);
    assert.equal(bootstrap.body.data.user.id, first.body.data.user.id);
    assert.equal(bootstrap.body.data.home.community.id, "community-demo");
    assert.equal(bootstrap.body.data.reportStats.total, 1);
    assert.equal(bootstrap.body.data.drillStats.completedCount, 1);
    assert.equal(bootstrap.body.data.mode, "demo");
    assert.ok(Date.parse(bootstrap.body.data.serverTime));
    assert.equal(
      (await call("GET", "/app/bootstrap?communityId=community-demo")).status,
      401,
    );

    const restored = await issue(keyA);
    assert.equal(restored.body.data.user.id, first.body.data.user.id);
    assert.equal(
      (await call("GET", "/reports/mine", undefined, restored.body.data.token))
        .body.data.total,
      1,
    );
    assert.equal(
      (await call("GET", "/drills", undefined, restored.body.data.token)).body
        .data.total,
      1,
    );
    assert.equal(
      (await issue("c".repeat(43), "windows")).status,
      200,
      "multiple judges behind one address are not forced to share an account",
    );
    assert.equal(
      (await call("POST", "/auth/demo-session", {
        installationKey: "d".repeat(43),
        platform: "web",
        clientVersion: "test",
      }, undefined, "https://untrusted.example")).headers[
        "access-control-allow-origin"
      ],
      undefined,
    );

    await app.close();
    app = await buildApp(cfg);
    const afterRestart = await issue(keyA);
    assert.equal(afterRestart.body.data.user.id, first.body.data.user.id);
    assert.equal(
      (await call("GET", "/reports/mine", undefined, afterRestart.body.data.token))
        .body.data.items[0].id,
      report.body.data.id,
    );
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("anonymous judge session endpoint is disabled outside demo experience", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-judge-off-"));
  const cfg = settings({
    DATA_MODE: "demo",
    DATABASE_PATH: path.join(dir, "off.sqlite"),
  });
  const app = await buildApp(cfg);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/demo-session",
      payload: {
        installationKey: "z".repeat(43),
        platform: "web",
        clientVersion: "test",
      },
    });
    assert.equal(response.statusCode, 403);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
