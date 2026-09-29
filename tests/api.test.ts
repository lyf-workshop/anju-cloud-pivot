import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { DatabaseSync } from "node:sqlite";
import { buildApp } from "../server/src/app.js";
import { settings } from "../server/src/config.js";

test("persistent business flows, ownership, idempotency, validation, device ordering and drill state", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-api-"));
  const cfg = settings({
    DATA_MODE: "demo",
    DATABASE_PATH: path.join(dir, "demo.sqlite"),
    DEVICE_INGEST_KEY: "test-only-ingest-key",
  });
  let app = await buildApp(cfg);
  const call = async (method: any, url: string, body?: any, token?: string) => {
    const res = await app.inject({
      method,
      url: "/api" + url,
      payload: body,
      headers: token ? { authorization: "Bearer " + token } : {},
    });
    return { status: res.statusCode, body: res.json() };
  };
  try {
    const denied = await call("POST", "/auth/dev-login", {
      agreed: false,
      legalVersion: "draft-2026-09",
    });
    assert.equal(denied.status, 400);
    const login = async (account: string) =>
      (
        await call("POST", "/auth/dev-login", {
          agreed: true,
          legalVersion: "draft-2026-09",
          demoAccount: account,
        })
      ).body.data;
    const a = await login("resident-a"),
      b = await login("resident-b");
    assert.equal(
      a.user.bindings.length,
      0,
      "new user must not inherit a seed address",
    );
    assert.ok(!("session_key" in a));
    const binding = await call(
      "POST",
      "/bindings",
      { floorId: "floor-1-1-6", room: "601" },
      a.token,
    );
    assert.equal(binding.status, 200);
    assert.equal(binding.body.data[0].verification, "pending");
    const base = {
      idempotencyKey: "report-key-0001",
      floorId: "floor-1-1-6",
      type: "obstruction",
      location: "六层公共走廊东侧",
      description: "测试：走廊堆放物品影响通行",
      contact: "13800000000",
      attachmentIds: [],
    };
    assert.equal(
      (
        await call(
          "POST",
          "/reports",
          { ...base, floorId: "floor-2-1-6" },
          a.token,
        )
      ).status,
      403,
      "cross-building denied",
    );
    assert.equal(
      (await call("POST", "/reports", { ...base, userId: a.user.id }, b.token))
        .status,
      400,
      "client userId rejected",
    );
    const report = await call("POST", "/reports", base, a.token);
    assert.equal(report.status, 200);
    const rid = report.body.data.id;
    const duplicate = await call("POST", "/reports", base, a.token);
    assert.equal(duplicate.body.data.id, rid);
    assert.equal((await call('GET','/reports/submission/'+base.idempotencyKey,undefined,a.token)).body.data.id,rid);
    assert.equal((await call('GET','/reports/submission/'+base.idempotencyKey,undefined,b.token)).status,404);
    assert.equal(
      (
        await call(
          "POST",
          "/reports",
          { ...base, description: "不同内容会触发幂等冲突" },
          a.token,
        )
      ).status,
      409,
    );
    assert.equal(
      (await call("GET", "/reports/" + rid, undefined, b.token)).status,
      404,
    );
    const pub = (await call("GET", "/reports/community")).body.data.items[0];
    for (const field of [
      "contact",
      "description",
      "location",
      "attachmentIds",
      "userId",
      "floorId",
    ])
      assert.ok(!(field in pub), "public projection leaks " + field);
    assert.equal(
      (await call("GET", "/reports/stats", undefined, a.token)).body.data.total,
      1,
    );
    assert.equal(
      (await call("GET", "/reports/mine", undefined, a.token)).body.data.total,
      1,
    );
    const detail = (await call("GET", "/reports/" + rid, undefined, a.token))
      .body.data;
    assert.equal(detail.events.length, 1);
    assert.equal(detail.status, "pending");
    const image = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#cc6655" },
    })
      .png()
      .toBuffer();
    const upload = async (buf: Buffer, mime = "image/png") => {
      const boundary = "anjuTestBoundary";
      const payload = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="../../escape.png"\r\nContent-Type: ${mime}\r\n\r\n`,
        ),
        buf,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      return app.inject({
        method: "POST",
        url: "/api/attachments",
        headers: {
          authorization: "Bearer " + a.token,
          "content-type": "multipart/form-data; boundary=" + boundary,
        },
        payload,
      });
    };
    const uploaded = await upload(image);
    assert.equal(uploaded.statusCode, 200);
    const aid = uploaded.json().data.id;
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/attachments/" + aid,
          headers: { authorization: "Bearer " + b.token },
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/attachments/" + aid,
          headers: { authorization: "Bearer " + a.token },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await upload(Buffer.from("<html>not image</html>"))).statusCode,
      415,
    );
    assert.equal((await upload(image, "text/html")).statusCode, 415);
    assert.equal(
      (await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).statusCode,
      413,
    );
    await call(
      "POST",
      "/bindings",
      { floorId: "floor-1-1-6", room: "602" },
      b.token,
    );
    assert.equal(
      (
        await call(
          "POST",
          "/reports",
          { ...base, idempotencyKey: "b-report-attach", attachmentIds: [aid] },
          b.token,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "POST",
          "/reports",
          {
            ...base,
            idempotencyKey: "a-report-4-attach",
            attachmentIds: [aid, aid, aid, aid],
          },
          a.token,
        )
      ).status,
      400,
    );
    const withImage = await call(
      "POST",
      "/reports",
      { ...base, idempotencyKey: "a-report-image", attachmentIds: [aid] },
      a.token,
    );
    assert.equal(withImage.status, 200);
    assert.equal(
      (
        await call(
          "POST",
          "/reports",
          {
            ...base,
            idempotencyKey: "a-report-reuse-image",
            attachmentIds: [aid],
          },
          a.token,
        )
      ).status,
      403,
    );
    const create = await call(
      "POST",
      "/drills",
      { floorId: "floor-1-1-6", idempotencyKey: "drill-key-0001" },
      a.token,
    );
    assert.equal(create.status, 200);
    const did = create.body.data.id;
    assert.equal(
      (
        await call(
          "POST",
          "/drills",
          { floorId: "floor-1-1-6", idempotencyKey: "drill-key-0001" },
          a.token,
        )
      ).body.data.id,
      did,
    );
    assert.equal(
      (await call("GET", "/drills/" + did, undefined, b.token)).status,
      404,
    );
    assert.equal(
      (
        await call(
          "PUT",
          "/drills/" + did + "/progress",
          { durationMs: 0, completedSteps: ["assembly"] },
          a.token,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          "POST",
          "/drills/" + did + "/complete",
          { durationMs: 0, completedSteps: [] },
          a.token,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await call(
          "PUT",
          "/drills/" + did + "/progress",
          { durationMs: 900000, completedSteps: ["exit"] },
          a.token,
        )
      ).status,
      400,
    );
    const sql = new DatabaseSync(cfg.dbPath);
    sql
      .prepare("UPDATE drill_sessions SET started_at=? WHERE id=?")
      .run(new Date(Date.now() - 20000).toISOString(), did);
    const snap = create.body.data.snapshot;
    sql
      .prepare("UPDATE floors SET exit_text=? WHERE id=?")
      .run("后续修订的楼层资料", "floor-1-1-6");
    sql.close();
    assert.equal(
      (
        await call(
          "PUT",
          "/drills/" + did + "/progress",
          { durationMs: 3500, completedSteps: ["exit"] },
          a.token,
        )
      ).status,
      200,
    );
    const finish = await call(
      "POST",
      "/drills/" + did + "/complete",
      { durationMs: 5000, completedSteps: ["exit", "assembly"] },
      a.token,
    );
    assert.equal(finish.status, 200);
    assert.equal(finish.body.data.durationSeconds, 5);
    assert.equal(finish.body.data.completedSteps.length, 2);
    assert.equal(finish.body.data.snapshot.exitText, snap.exitText);
    const again = await call(
      "POST",
      "/drills/" + did + "/complete",
      { durationMs: 15000, completedSteps: ["exit", "assembly"] },
      a.token,
    );
    assert.equal(again.body.data.completedAt, finish.body.data.completedAt);
    assert.equal(again.body.data.durationSeconds, 5);
    assert.equal(
      (
        await call(
          "POST",
          "/drills/" + did + "/abort",
          { durationMs: 0, completedSteps: [] },
          a.token,
        )
      ).status,
      409,
    );
    const other = (
      await call(
        "POST",
        "/drills",
        { floorId: "floor-1-1-6", idempotencyKey: "drill-key-0002" },
        a.token,
      )
    ).body.data;
    assert.notEqual(other.id, did);
    const aborted = await call(
      "POST",
      "/drills/" + other.id + "/abort",
      { durationMs: 0, completedSteps: [] },
      a.token,
    );
    assert.equal(aborted.body.data.status, "aborted");
    assert.equal(
      (
        await call(
          "POST",
          "/drills/" + other.id + "/complete",
          { durationMs: 0, completedSteps: ["exit", "assembly"] },
          a.token,
        )
      ).status,
      409,
    );
    const stats = (await call("GET", "/drills/stats", undefined, a.token)).body
      .data;
    assert.deepEqual(stats, {
      completedCount: 1,
      durationMs: 5000,
      durationSeconds: 5,
      completedSteps: 2,
    });
    const ds = (
      await call("GET", "/devices?floorId=floor-1-1-6", undefined, a.token)
    ).body.data.items;
    const smoke = ds.find((d: any) => d.id === "device-smoke-1");
    assert.equal(smoke.connectionStatus, "offline");
    assert.equal(smoke.eventStatus, "alarm");
    assert.equal(smoke.reading.freshness, "stale");
    assert.equal(ds.find((d: any) => d.id === "device-temp-1").reading, null);
    const event = {
      eventId: "hardware-sample-1",
      deviceId: "device-smoke-1",
      occurredAt: new Date().toISOString(),
      eventType: "heartbeat",
      severity: "info",
      payload: {},
      source: "demo",
      isTest: true,
    };
    const ingest = async (p: any) =>
      app.inject({
        method: "POST",
        url: "/api/device-events",
        headers: { "x-device-key": cfg.ingestKey },
        payload: p,
      });
    assert.equal((await ingest(event)).json().data.duplicate, false);
    assert.equal((await ingest(event)).json().data.duplicate, true);
    assert.equal(
      (await ingest({ ...event, eventType: "clear" })).statusCode,
      409,
    );
    await ingest({
      ...event,
      eventId: "old-clear",
      occurredAt: "2026-09-20T00:00:00.000Z",
      eventType: "clear",
    });
    const after = (
      await call("GET", "/devices/device-smoke-1", undefined, a.token)
    ).body.data;
    assert.equal(
      after.eventStatus,
      "alarm",
      "heartbeat and out-of-order clear must not clear a later alarm",
    );
    assert.equal(after.connectionStatus, "online");
    await app.close();
    app = await buildApp(cfg);
    assert.equal(
      (await call("GET", "/reports/" + rid, undefined, a.token)).body.data.id,
      rid,
    );
    assert.equal(
      (await call("GET", "/drills/" + did, undefined, a.token)).body.data
        .completedAt,
      finish.body.data.completedAt,
    );
    assert.equal(
      (await call("GET", "/reports/stats", undefined, a.token)).body.data.total,
      2,
    );
    assert.equal(
      (await call("GET", "/drills", undefined, a.token)).body.data.total,
      2,
    );
    await call("POST", "/auth/logout", {}, a.token);
    assert.equal((await call("GET", "/me", undefined, a.token)).status, 401);
    assert.equal(
      (await call("GET", "/config", undefined, a.token)).status,
      200,
      "emergency config remains public",
    );
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("production forbids demo, keeps empty catalog, rejects mismatched client, and never creates fake login", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-prod-"));
  assert.throws(() => settings({ NODE_ENV: "production", DATA_MODE: "demo" }));
  const cfg = settings({
    NODE_ENV: "production",
    DATA_MODE: "production",
    DATABASE_PATH: path.join(dir, "prod.sqlite"),
  });
  const app = await buildApp(cfg);
  const realFetch=globalThis.fetch;
  try {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/dev-login",
      payload: { agreed: true, legalVersion: cfg.legalVersion },
    });
    assert.equal(r.statusCode, 403);
    assert.deepEqual((await app.inject("/api/communities")).json().data, []);
    assert.equal(
      (
        await app.inject({
          url: "/api/home",
          headers: { "x-data-mode": "demo" },
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: {
            agreed: true,
            legalVersion: cfg.legalVersion,
            code: "fake",
          },
        })
      ).statusCode,
      503,
    );
    const sql = new DatabaseSync(cfg.dbPath);
    assert.equal(
      (sql.prepare("SELECT COUNT(*) n FROM users").get() as any).n,
      0,
    );
    sql.close();
    cfg.legalApproved=true;
    const login=()=>app.inject({method:'POST',url:'/api/auth/login',payload:{agreed:true,legalVersion:cfg.legalVersion,code:'test-code'}});
    assert.equal((await login()).json().error.code,'WECHAT_NOT_CONFIGURED');
    cfg.appId='test-appid';cfg.appSecret='test-placeholder-only';
    globalThis.fetch=async()=>new Response(JSON.stringify({errcode:40029,errmsg:'invalid code'}));
    assert.equal((await login()).statusCode,401);
    globalThis.fetch=async()=>{throw new Error('network unavailable')};
    assert.equal((await login()).statusCode,502);
    globalThis.fetch=async()=>new Response(JSON.stringify({openid:'test-openid',session_key:'must-not-be-returned'}));
    const successful=await login();assert.equal(successful.statusCode,200);assert.ok(!successful.body.includes('must-not-be-returned'));assert.ok(successful.json().data.token);
  } finally {
    globalThis.fetch=realFetch;
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
