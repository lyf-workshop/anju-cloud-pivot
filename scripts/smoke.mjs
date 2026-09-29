import assert from "node:assert/strict";
const base = process.env.API_BASE_URL || "http://127.0.0.1:3000/api";
async function call(url, method = "GET", body, token) {
  const r = await fetch(base + url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok)
    throw new Error(`${r.status} ${j.error?.code}: ${j.error?.message}`);
  return j.data;
}
const cfg = await call("/config");
assert.equal(cfg.mode, "demo", "Smoke script only writes to demo mode");
const s = await call("/auth/dev-login", "POST", {
  agreed: true,
  legalVersion: cfg.legalVersion,
});
await call(
  "/bindings",
  "POST",
  { floorId: "floor-1-1-6", room: "601" },
  s.token,
);
const p = {
  idempotencyKey: crypto.randomUUID(),
  floorId: "floor-1-1-6",
  type: "obstruction",
  location: "联调示例：6层公共区域",
  description: "冒烟验证生成的隐患上报记录，非真实事件。",
  contact: "13800000000",
  attachmentIds: [],
};
const r = await call("/reports", "POST", p, s.token);
assert.equal((await call("/reports", "POST", p, s.token)).id, r.id);
const d = await call(
  "/drills",
  "POST",
  { floorId: p.floorId, idempotencyKey: crypto.randomUUID() },
  s.token,
);
await call(
  "/drills/" + d.id + "/progress",
  "PUT",
  { durationMs: 0, completedSteps: ["exit"] },
  s.token,
);
const end = await call(
  "/drills/" + d.id + "/complete",
  "POST",
  { durationMs: 0, completedSteps: ["exit", "assembly"] },
  s.token,
);
assert.equal(end.status, "completed");
assert.equal(
  (
    await call(
      "/drills/" + d.id + "/complete",
      "POST",
      { durationMs: 0, completedSteps: ["exit", "assembly"] },
      s.token,
    )
  ).completedAt,
  end.completedAt,
);
assert.equal((await call("/reports/" + r.id, "GET", null, s.token)).id, r.id);
assert.equal((await call("/drills/" + d.id, "GET", null, s.token)).id, d.id);
await call("/auth/logout", "POST", {}, s.token);
console.log(
  JSON.stringify(
    {
      result: "passed",
      reportId: r.id,
      reportNumber: r.number,
      drillSessionId: d.id,
      completedAt: end.completedAt,
      note: "Demo records persisted; no real calls, messages or hardware actions.",
    },
    null,
    2,
  ),
);
