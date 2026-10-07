import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildApp } from "../server/src/app.js";
import { settings } from "../server/src/config.js";

test("staff agent uses tools, drafts only, and does not write until confirm", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-agent-"));
  const cfg = settings({
    DATA_MODE: "demo",
    DATABASE_PATH: path.join(dir, "test.sqlite"),
    ZHIZENGZENG_API_KEY: "",
    LLM_API_KEY: "",
  });
  const app = await buildApp(cfg);
  const request = async (
    method: any,
    url: string,
    body?: any,
    cookie?: string,
  ) => {
    const res = await app.inject({
      method,
      url: "/api" + url,
      payload: body,
      headers: {
        ...(cookie ? { cookie } : {}),
        "x-anju-request": "1",
        origin: "http://127.0.0.1:3000",
      },
    });
    return { status: res.statusCode, body: res.json(), cookie: String(res.headers["set-cookie"] || "").split(";")[0] };
  };
  try {
    assert.equal(
      (
        await request("POST", "/staff/agent/chat", {
          messages: [{ role: "user", content: "待办工单有哪些" }],
        })
      ).status,
      401,
    );
    const login = await request("POST", "/staff/auth/login", {
      username: "property-demo",
      password: cfg.demoStaffPassword,
    });
    assert.equal(login.status, 200);
    const cookie = login.cookie;
    const resident = (
      await request("POST", "/auth/dev-login", {
        agreed: true,
        legalVersion: cfg.legalVersion,
        demoAccount: "resident-a",
      })
    ).body.data;
    await app.inject({
      method: "POST",
      url: "/api/bindings",
      payload: { floorId: "floor-1-1-6", room: "601" },
      headers: { authorization: "Bearer " + resident.token },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/reports",
      payload: {
        idempotencyKey: "agent-report-1",
        floorId: "floor-1-1-6",
        type: "obstruction",
        location: "6层公共走廊",
        description: "楼道堆放纸箱，请安排清理。",
        contact: "13800000000",
        attachmentIds: [],
      },
      headers: { authorization: "Bearer " + resident.token },
    });
    assert.equal(created.statusCode, 200);
    const reportId = created.json().data.id;
    const camera = await request(
      "POST",
      "/staff/agent/chat",
      {
        communityId: "community-demo",
        cameraId: "CAM-RPI-01",
        messages: [{ role: "user", content: "现在有没有疑似烟火？" }],
      },
      cookie,
    );
    assert.equal(camera.status, 200);
    assert.match(camera.body.data.reply, /摄像头|画面|复核/);
    assert.equal(camera.body.data.model.provider, "local-fallback");
    const listed = await request(
      "POST",
      "/staff/agent/chat",
      {
        messages: [{ role: "user", content: "待办工单有哪些？请起草受理说明。" }],
      },
      cookie,
    );
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.proposal.kind, "report_action");
    assert.equal(listed.body.data.proposal.reportId, reportId);
    assert.equal(listed.body.data.proposal.status, "processing");
    const still = await request(
      "GET",
      "/staff/reports/" + reportId + "?communityId=community-demo",
      undefined,
      cookie,
    );
    assert.equal(still.body.data.status, "pending");
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resident assist is owner-facing and does not require staff login", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-resident-agent-"));
  const cfg = settings({
    DATA_MODE: "demo",
    DATABASE_PATH: path.join(dir, "test.sqlite"),
    ZHIZENGZENG_API_KEY: "",
    LLM_API_KEY: "",
  });
  const app = await buildApp(cfg);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/dev-login",
    payload: {
      agreed: true,
      legalVersion: cfg.legalVersion,
      demoAccount: "resident-a",
    },
  });
  const token = login.json().data.token;
  const headers = { authorization: "Bearer " + token };
  try {
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/agent/resident-radar" }))
        .statusCode,
      401,
    );
    await app.inject({
      method: "POST",
      url: "/api/bindings",
      payload: { floorId: "floor-1-1-6", room: "601" },
      headers,
    });
    const radar = await app.inject({
      method: "GET",
      url: "/api/agent/resident-radar",
      headers,
    });
    assert.equal(radar.statusCode, 200);
    assert.match(radar.json().data.address, /云栖|1号楼|6层/);
    const assist = await app.inject({
      method: "POST",
      url: "/api/agent/resident-assist",
      payload: {
        role: "identify",
        messages: [{ role: "user", content: "走廊堆了纸箱挡住路" }],
      },
      headers,
    });
    assert.equal(assist.statusCode, 200);
    const card = assist.json().data.card;
    assert.equal(card.riskLevel, "high");
    assert.equal(card.reportDraft.type, "obstruction");
    assert.ok(card.nextSteps.some((step: any) => step.url === "/pages/report/report"));
    const staffBlocked = await app.inject({
      method: "POST",
      url: "/api/staff/agent/chat",
      payload: { messages: [{ role: "user", content: "待办工单" }] },
      headers,
    });
    assert.ok(
      staffBlocked.statusCode === 401 || staffBlocked.statusCode === 403,
    );
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
