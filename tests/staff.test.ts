import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { buildApp } from "../server/src/app.js";
import { settings } from "../server/src/config.js";
import { Store } from "../server/src/db.js";
import { passwordHash } from "../server/src/staff.js";

test("property login, CSRF, community/role/attachment scope, work transitions and persistence", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-staff-"));
  const cfg = settings({
    DATA_MODE: "demo",
    DATABASE_PATH: path.join(dir, "test.sqlite"),
  });
  let app = await buildApp(cfg);
  const request = async (
    method: any,
    url: string,
    body?: any,
    credentials: { token?: string; cookie?: string } = {},
    extra: any = {},
  ) => {
    const res = await app.inject({
      method,
      url: "/api" + url,
      payload: body,
      headers: {
        ...(credentials.token
          ? { authorization: "Bearer " + credentials.token }
          : {}),
        ...(credentials.cookie ? { cookie: credentials.cookie } : {}),
        "x-anju-request": "1",
        origin: "http://127.0.0.1:3000",
        ...extra,
      },
    });
    return {
      status: res.statusCode,
      body: res.json(),
      cookie: String(res.headers["set-cookie"] || "").split(";")[0],
    };
  };
  try {
    const failed = await request("POST", "/staff/auth/login", {
      username: "property-demo",
      password: "incorrect",
    });
    assert.equal(failed.status, 401);
    assert.equal(failed.cookie, "");
    assert.equal(
      (
        await request(
          "POST",
          "/staff/auth/login",
          { username: "property-demo", password: cfg.demoStaffPassword },
          {},
          { origin: "https://attacker.invalid" },
        )
      ).status,
      403,
    );
    const csrf = await app.inject({
      method: "POST",
      url: "/api/staff/auth/login",
      payload: { username: "property-demo", password: cfg.demoStaffPassword },
    });
    assert.equal(csrf.statusCode, 403);
    const login = await request("POST", "/staff/auth/login", {
      username: "property-demo",
      password: cfg.demoStaffPassword,
    });
    assert.equal(login.status, 200);
    assert.ok(!login.body.data.token);
    assert.match(login.cookie, /^anju_staff_session=/);
    const manager = { cookie: login.cookie };
    assert.equal(
      (await request("GET", "/staff/me", undefined, manager)).body.data
        .communities[0].role,
      "manager",
    );
    const a = (
      await request("POST", "/auth/dev-login", {
        agreed: true,
        legalVersion: cfg.legalVersion,
        demoAccount: "resident-a",
      })
    ).body.data;
    const b = (
      await request("POST", "/auth/dev-login", {
        agreed: true,
        legalVersion: cfg.legalVersion,
        demoAccount: "resident-b",
      })
    ).body.data;
    assert.equal(
      (await request("GET", "/staff/me", undefined, { token: a.token })).status,
      401,
    );
    await request(
      "POST",
      "/bindings",
      { floorId: "floor-1-1-6", room: "601" },
      { token: a.token },
    );
    // Independent community and roles are fixtures only, never created by the public API.
    const store = new Store(cfg);
    store.seed({
      communities: [
        {
          id: "private-community",
          name: "隔离测试社区",
          meetingPoint: "测试集合点",
          buildings: [
            {
              id: "private-building",
              name: "隔离楼栋",
              units: [
                {
                  id: "private-unit",
                  name: "1单元",
                  floors: [
                    { id: "private-floor", number: 1, exitText: "测试出口" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    for (const [uid, username, community, role] of [
      ["viewer-user", "viewer", "community-demo", "viewer"],
      ["other-user", "other", "private-community", "manager"],
    ]) {
      store.run(
        "INSERT INTO users VALUES (?,?,?,?,?)",
        uid,
        "staff:" + username,
        username,
        new Date().toISOString(),
        cfg.legalVersion,
      );
      store.run(
        "INSERT INTO staff_accounts(user_id,username,password_hash,active,password_changed_at) VALUES (?,?,?,?,?)",
        uid,
        username,
        passwordHash("TestingOnly123!"),
        1,
        new Date().toISOString(),
      );
      store.run(
        "INSERT INTO staff_memberships VALUES (?,?,?)",
        uid,
        community,
        role,
      );
    }
    store.close();
    const viewer = {
      cookie: (
        await request("POST", "/staff/auth/login", {
          username: "viewer",
          password: "TestingOnly123!",
        })
      ).cookie,
    };
    const outsider = {
      cookie: (
        await request("POST", "/staff/auth/login", {
          username: "other",
          password: "TestingOnly123!",
        })
      ).cookie,
    };
    for (const resource of [
      "overview",
      "members",
      "reports",
      "residents",
      "devices",
      "drills",
      "events",
      "duties",
      "inspections",
    ])
      assert.equal(
        (
          await request(
            "GET",
            `/staff/${resource}?communityId=private-community`,
            undefined,
            manager,
          )
        ).status,
        403,
        resource,
      );

    const png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#225566" },
    })
      .png()
      .toBuffer();
    const boundary = "staff-test";
    const uploaded = await app.inject({
      method: "POST",
      url: "/api/attachments",
      headers: {
        authorization: "Bearer " + a.token,
        "content-type": "multipart/form-data; boundary=" + boundary,
      },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`,
        ),
        png,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
    assert.equal(uploaded.statusCode, 200);
    const attachmentId = uploaded.json().data.id;
    assert.equal(
      (await request("GET", "/attachments/" + attachmentId, undefined, manager))
        .status,
      404,
      "unlinked images stay private",
    );
    const payload = {
      idempotencyKey: "staff-flow-report",
      floorId: "floor-1-1-6",
      type: "obstruction",
      location: "6层公共走廊",
      description: "楼道堆放纸箱，请安排清理。",
      contact: "13800000000",
      attachmentIds: [attachmentId],
    };
    const report = (
      await request("POST", "/reports", payload, { token: a.token })
    ).body.data;
    const rid = report.id;
    const image = await app.inject({
      url: "/api/attachments/" + attachmentId,
      headers: { cookie: manager.cookie },
    });
    assert.equal(image.statusCode, 200);
    assert.match(String(image.headers["content-type"]), /image\/jpeg/);
    assert.equal(
      (
        await request(
          "GET",
          "/attachments/" + attachmentId,
          undefined,
          outsider,
        )
      ).status,
      404,
    );
    assert.equal(
      (await request("GET", "/reports/" + rid, undefined, { token: b.token }))
        .status,
      404,
    );
    const publicDetail = (await request("GET", "/reports/public/" + rid)).body
      .data;
    for (const key of [
      "contact",
      "location",
      "description",
      "userId",
      "floorId",
    ])
      assert.ok(!(key in publicDetail));
    assert.equal(publicDetail.attachmentIds.length, 0);
    assert.equal(
      (await request("GET", "/staff/reports/" + rid, undefined, outsider))
        .status,
      403,
    );
    const start = {
      idempotencyKey: "staff-action-001",
      expectedVersion: 0,
      status: "processing",
      message: "已联系现场工作人员",
    };
    assert.equal(
      (await request("POST", `/staff/reports/${rid}/actions`, start, viewer))
        .status,
      403,
    );
    assert.equal(
      (
        await request(
          "POST",
          `/staff/reports/${rid}/actions`,
          { ...start, status: "completed" },
          manager,
        )
      ).status,
      409,
    );
    const started = await request(
      "POST",
      `/staff/reports/${rid}/actions`,
      start,
      manager,
    );
    assert.equal(started.status, 200);
    assert.equal(started.body.data.version, 1);
    assert.equal(
      (await request("POST", `/staff/reports/${rid}/actions`, start, manager))
        .body.data.version,
      1,
    );
    assert.equal(
      (
        await request(
          "POST",
          `/staff/reports/${rid}/actions`,
          { ...start, idempotencyKey: "another-staff-key" },
          manager,
        )
      ).status,
      409,
      "stale concurrent edit",
    );
    assert.equal(
      (
        await request(
          "POST",
          `/staff/reports/${rid}/actions`,
          { ...start, message: "changed" },
          manager,
        )
      ).status,
      409,
      "same key different body",
    );
    const finish = {
      ...start,
      idempotencyKey: "staff-action-002",
      expectedVersion: 1,
      status: "completed",
      message: "测试纸箱已清理，完成现场复核",
    };
    assert.equal(
      (await request("POST", `/staff/reports/${rid}/actions`, finish, manager))
        .status,
      200,
    );
    assert.equal(
      (await request("POST", `/staff/reports/${rid}/actions`, finish, manager))
        .body.data.events.length,
      3,
    );
    const resident = (
      await request("GET", "/reports/" + rid, undefined, { token: a.token })
    ).body.data;
    assert.equal(resident.status, "completed");
    assert.equal(resident.events.length, 3);
    assert.equal(
      (await request("GET", "/reports/stats", undefined, { token: a.token }))
        .body.data.completed,
      1,
    );
    const people = (
      await request(
        "GET",
        "/staff/residents?communityId=community-demo",
        undefined,
        manager,
      )
    ).body.data.items;
    assert.equal(people[0].verification, "pending");
    assert.equal(
      (
        await request(
          "PATCH",
          "/staff/bindings/" + people[0].id,
          { verification: "verified", reason: "测试资料已核对" },
          viewer,
        )
      ).status,
      403,
    );
    await request(
      "PATCH",
      "/staff/bindings/" + people[0].id,
      { verification: "verified", reason: "测试资料已核对" },
      manager,
    );
    assert.equal(
      (await request("GET", "/me", undefined, { token: a.token })).body.data
        .bindings[0].verification,
      "verified",
    );
    const inspection = {
      communityId: "community-demo",
      floorId: "floor-1-1-6",
      location: "东侧通道",
      result: "issue",
      description: "测试巡查发现纸箱",
      idempotencyKey: "inspection-001",
    };
    const i = await request("POST", "/staff/inspections", inspection, manager);
    assert.equal(i.status, 200);
    assert.equal(
      (await request("POST", "/staff/inspections", inspection, manager)).body
        .data.id,
      i.body.data.id,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/staff/inspections",
          {
            ...inspection,
            floorId: "private-floor",
            idempotencyKey: "inspection-002",
          },
          manager,
        )
      ).status,
      403,
    );
    const notice = {
      communityId: "community-demo",
      title: "本地联调公告",
      body: "保持楼道畅通，联调记录。",
      idempotencyKey: "notice-001",
    };
    assert.equal(
      (await request("POST", "/staff/announcements", notice, viewer)).status,
      403,
    );
    assert.equal(
      (await request("POST", "/staff/announcements", notice, manager)).status,
      200,
    );
    assert.ok(
      (
        await request("GET", "/announcements?communityId=community-demo")
      ).body.data.items.some((n: any) => n.title === notice.title),
    );
    const duty = {
      communityId: "community-demo",
      title: "本地值班",
      assigneeId: login.body.data.user.id,
      startsAt: "2026-09-29T01:00:00.000Z",
      endsAt: "2026-09-29T09:00:00.000Z",
      note: "测试排班",
      idempotencyKey: "duty-001",
    };
    assert.equal(
      (
        await request(
          "POST",
          "/staff/duties",
          { ...duty, endsAt: duty.startsAt },
          manager,
        )
      ).status,
      400,
    );
    assert.equal(
      (await request("POST", "/staff/duties", duty, manager)).status,
      200,
    );
    const review = {
      idempotencyKey: "review-001",
      expectedVersion: 0,
      status: "false_positive",
      note: "仅本地测试人工误报记录",
    };
    assert.equal(
      (
        await request(
          "POST",
          "/staff/events/event-demo-1/review",
          review,
          manager,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/staff/events/event-demo-1/review",
          review,
          manager,
        )
      ).body.data.version,
      1,
    );
    assert.equal(
      (
        await request("GET", "/devices/device-smoke-1", undefined, {
          token: a.token,
        })
      ).body.data.eventStatus,
      "alarm",
      "review never clears hardware state",
    );
    await app.close();
    app = await buildApp(cfg);
    assert.equal(
      (await request("GET", "/staff/reports/" + rid, undefined, manager)).body
        .data.status,
      "completed",
    );
    assert.equal(
      (
        await request(
          "GET",
          "/staff/inspections?communityId=community-demo",
          undefined,
          manager,
        )
      ).body.data.total,
      1,
    );
    assert.equal(
      (
        await request(
          "GET",
          "/staff/duties?communityId=community-demo",
          undefined,
          manager,
        )
      ).body.data.total,
      1,
    );
    assert.equal((await app.inject({ url: "/" })).headers.location, "/index.html");
    assert.equal((await app.inject({ url: "/login.html" })).statusCode, 200);
    assert.equal((await app.inject({ url: "/server/.env" })).statusCode, 404);
    assert.equal(
      (await request("POST", "/staff/auth/logout", {}, manager)).status,
      200,
    );
    assert.equal(
      (await request("GET", "/staff/me", undefined, manager)).status,
      401,
    );
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("staff sessions are isolated, manageable, and support property field reports", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-staff-security-"));
  const cfg = settings({
    DATA_MODE: "demo",
    DATABASE_PATH: path.join(dir, "test.sqlite"),
  });
  const app = await buildApp(cfg);
  const call = async (method: any, url: string, body?: any, cookie = "") => {
    const response = await app.inject({
      method: method as any,
      url: "/api" + url,
      payload: body,
      headers: {
        ...(cookie ? { cookie } : {}),
        "x-anju-request": "1",
        origin: "http://127.0.0.1:3000",
      },
    });
    return {
      status: response.statusCode,
      data: response.json().data,
      cookie: String(response.headers["set-cookie"] || "").split(";")[0],
    };
  };
  try {
    const first = await call("POST", "/staff/auth/login", {
      username: "property-demo",
      password: cfg.demoStaffPassword,
      remember: true,
    });
    const second = await call("POST", "/staff/auth/login", {
      username: "property-demo",
      password: cfg.demoStaffPassword,
      remember: false,
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const sessions = await call(
      "GET",
      "/staff/auth/sessions",
      undefined,
      second.cookie,
    );
    assert.equal(sessions.data.length, 2);
    assert.equal(sessions.data.filter((item: any) => item.current).length, 1);

    const report = await call(
      "POST",
      "/reports",
      {
        idempotencyKey: "property-field-report-001",
        floorId: "floor-1-1-6",
        type: "obstruction",
        location: "六层公共走廊",
        description: "物业巡查发现纸箱堆放影响通行。",
        contact: "13800000000",
        attachmentIds: [],
      },
      second.cookie,
    );
    assert.equal(report.status, 200);
    assert.match(report.data.number, /^AJ\d{8}-[A-F0-9]{8}$/);
    assert.equal(
      (
        await call(
          "GET",
          "/reports/submission/property-field-report-001",
          undefined,
          second.cookie,
        )
      ).data.id,
      report.data.id,
    );
    assert.equal(
      (
        await call(
          "POST",
          "/bindings",
          { floorId: "floor-1-1-6", room: "601" },
          second.cookie,
        )
      ).status,
      401,
      "staff cookies must not become resident sessions",
    );

    const changed = await call(
      "POST",
      "/staff/auth/change-password",
      {
        currentPassword: cfg.demoStaffPassword,
        newPassword: "ChangedForTest123!",
      },
      second.cookie,
    );
    assert.equal(changed.status, 200);
    assert.equal(
      (await call("GET", "/staff/me", undefined, first.cookie)).status,
      401,
      "password change revokes other staff sessions",
    );
    assert.equal(
      (
        await call("POST", "/staff/auth/login", {
          username: "property-demo",
          password: cfg.demoStaffPassword,
        })
      ).status,
      401,
    );
    const relogin = await call("POST", "/staff/auth/login", {
      username: "property-demo",
      password: "ChangedForTest123!",
    });
    assert.equal(relogin.status, 200);
    assert.equal(
      (
        await call(
          "POST",
          "/staff/auth/logout-all",
          {},
          relogin.cookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (await call("GET", "/staff/me", undefined, relogin.cookie)).status,
      401,
    );
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("staff login locks repeated failures and records authentication events", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-staff-lock-"));
  const cfg = settings({
    DATA_MODE: "demo",
    DATABASE_PATH: path.join(dir, "test.sqlite"),
    STAFF_LOCK_ATTEMPTS: "2",
    STAFF_LOCK_MINUTES: "1",
  });
  const app = await buildApp(cfg);
  const login = (password: string) =>
    app.inject({
      method: "POST",
      url: "/api/staff/auth/login",
      payload: { username: "property-demo", password },
      headers: {
        "x-anju-request": "1",
        origin: "http://127.0.0.1:3000",
      },
    });
  try {
    assert.equal((await login("WrongPassword123!")).statusCode, 401);
    assert.equal((await login("WrongPassword123!")).statusCode, 401);
    const locked = await login(cfg.demoStaffPassword);
    assert.equal(locked.statusCode, 429);
    assert.equal(locked.json().error.code, "LOGIN_LOCKED");
    const store = new Store(cfg);
    assert.equal(
      store.one(
        "SELECT COUNT(*) n FROM staff_auth_events WHERE action='login_failed'",
      ).n,
      2,
    );
    assert.equal(
      store.one(
        "SELECT COUNT(*) n FROM staff_auth_events WHERE action='login_locked'",
      ).n,
      1,
    );
    store.close();
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("production never seeds property-demo or permits development login", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-prod-staff-"));
  const app = await buildApp(
    settings({
      NODE_ENV: "production",
      DATA_MODE: "production",
      DATABASE_PATH: path.join(dir, "prod.sqlite"),
    }),
  );
  try {
    const result = await app.inject({
      method: "POST",
      url: "/api/staff/auth/login",
      headers: { "x-anju-request": "1" },
      payload: { username: "property-demo", password: "AnjuLocal2026!" },
    });
    assert.equal(result.statusCode, 401);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/dev-login",
          payload: {},
        })
      ).statusCode,
      403,
    );
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("public demo blocks resident development login and protects staff cookies", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-public-demo-"));
  const cfg = settings({
    DATA_MODE: "demo",
    PUBLIC_DEMO: "true",
    DATABASE_PATH: path.join(dir, "demo.sqlite"),
    DEMO_STAFF_PASSWORD: "IsolatedPublicDemoPassword123!",
    WEB_ORIGINS: "https://xn--9kqy92aeqav77a.com",
  });
  const app = await buildApp(cfg);
  try {
    const config = await app.inject({ url: "/api/config" });
    assert.equal(config.json().data.publicDemo, true);
    assert.equal(config.json().data.developmentLogin, false);
    assert.equal(config.json().data.staffDemoLogin, false);
    const resident = await app.inject({
      method: "POST",
      url: "/api/auth/dev-login",
      payload: { agreed: true, legalVersion: cfg.legalVersion, demoAccount: "resident-a" },
    });
    assert.equal(resident.statusCode, 403);
    const staff = await app.inject({
      method: "POST",
      url: "/api/staff/auth/login",
      headers: { origin: "https://xn--9kqy92aeqav77a.com", "x-anju-request": "1" },
      payload: { username: "property-demo", password: cfg.demoStaffPassword },
    });
    assert.equal(staff.statusCode, 200);
    assert.match(String(staff.headers["set-cookie"]), /Secure/);
    assert.match(String(staff.headers["set-cookie"]), /HttpOnly/);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.throws(() => settings({ DATA_MODE: "production", PUBLIC_DEMO: "true" }));
  assert.throws(() => settings({ NODE_ENV: "production", DATA_MODE: "production", PUBLIC_DEMO: "true" }));
  assert.throws(() => settings({ DATA_MODE: "demo", PUBLIC_DEMO: "true" }));
});

test("explicit staff provisioning validates scope and never overwrites an existing account", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-provision-"));
  const env = {
    ...process.env,
    NODE_ENV: "development",
    DATA_MODE: "demo",
    DATABASE_PATH: path.join(dir, "test.sqlite"),
    STAFF_USERNAME: "local-operator",
    STAFF_PASSWORD: "LocalProvision123!",
    STAFF_NICKNAME: "本地操作员",
    STAFF_COMMUNITY_ID: "community-demo",
    STAFF_ROLE: "operator",
  };
  try {
    const first = spawnSync(
      process.execPath,
      ["--import", "tsx", "server/src/create-staff.ts"],
      { env, encoding: "utf8" },
    );
    assert.equal(first.status, 0, first.stderr);
    assert.ok(!first.stdout.includes(env.STAFF_PASSWORD));
    const duplicate = spawnSync(
      process.execPath,
      ["--import", "tsx", "server/src/create-staff.ts"],
      {
        env: { ...env, STAFF_PASSWORD: "ChangedSecret123!" },
        encoding: "utf8",
      },
    );
    assert.equal(duplicate.status, 1);
    const db = new Store(settings(env));
    assert.equal(
      db.one(
        "SELECT COUNT(*) n FROM staff_accounts WHERE username='local-operator'",
      ).n,
      1,
    );
    db.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
