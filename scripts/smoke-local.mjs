// Real HTTP smoke. Explicitly writes labelled records to the local demo database.
import assert from "node:assert/strict";
const base = process.env.API_BASE_URL || "http://127.0.0.1:3000/api";
const origin = new URL(base).origin;
async function call(path, body, credential = "") {
  const headers = {
    "content-type": "application/json",
    "x-anju-request": "1",
    origin,
  };
  if (credential.includes("=")) headers.cookie = credential;
  else if (credential) headers.authorization = "Bearer " + credential;
  const res = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  assert.ok(res.ok, `${path}: ${res.status} ${JSON.stringify(json.error)}`);
  return {
    data: json.data,
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}
const cfg = (await call("/config")).data;
assert.equal(cfg.mode, "demo", "Smoke refuses production data");
const resident = (
  await call("/auth/dev-login", {
    agreed: true,
    legalVersion: cfg.legalVersion,
    demoAccount: "resident-b",
  })
).data;
const staff = await call("/staff/auth/login", {
  username: "property-demo",
  password: process.env.DEMO_STAFF_PASSWORD || "AnjuLocal2026!",
});
await call(
  "/bindings",
  { floorId: "floor-1-1-6", room: "SMOKE-601" },
  resident.token,
);
const payload = {
  idempotencyKey: crypto.randomUUID(),
  floorId: "floor-1-1-6",
  type: "obstruction",
  location: "6层走廊（HTTP冒烟）",
  description: "本地双端联调：测试上报与物业处理。",
  contact: "13800000000",
  attachmentIds: [],
};
const record = (await call("/reports", payload, resident.token)).data;
assert.equal(
  (await call("/reports", payload, resident.token)).data.id,
  record.id,
);
for (const [version, status, message] of [
  [0, "processing", "本地冒烟：受理测试记录"],
  [1, "completed", "本地冒烟：完成处理验证"],
]) {
  const action = {
    idempotencyKey: crypto.randomUUID(),
    expectedVersion: version,
    status,
    message,
  };
  await call(`/staff/reports/${record.id}/actions`, action, staff.cookie);
  assert.equal(
    (await call(`/staff/reports/${record.id}/actions`, action, staff.cookie))
      .data.version,
    version + 1,
  );
}
assert.equal(
  (await call("/reports/" + record.id, undefined, resident.token)).data.status,
  "completed",
);
const drill = (
  await call(
    "/drills",
    { floorId: "floor-1-1-6", idempotencyKey: crypto.randomUUID() },
    resident.token,
  )
).data;
const progress = { durationMs: 0, completedSteps: ["exit", "assembly"] };
const completed = (
  await call(`/drills/${drill.id}/complete`, progress, resident.token)
).data;
assert.equal(completed.completedSteps.length, 2);
assert.equal(
  (await call(`/drills/${drill.id}/complete`, progress, resident.token)).data
    .id,
  drill.id,
);
assert.ok(
  (await call("/drills", undefined, resident.token)).data.items.some(
    (d) => d.id === drill.id,
  ),
);
await call("/staff/auth/logout", {}, staff.cookie);
await call("/auth/logout", {}, resident.token);
console.log(
  JSON.stringify(
    {
      result: "passed",
      transport: "real HTTP",
      reportId: record.id,
      reportNumber: record.number,
      drillId: drill.id,
      checks: [
        "resident login and binding",
        "property cookie login",
        "report idempotency",
        "property accept and complete",
        "resident reads updated state",
        "drill complete and history",
        "logout",
      ],
    },
    null,
    2,
  ),
);
