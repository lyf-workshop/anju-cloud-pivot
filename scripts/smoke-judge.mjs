import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

const base = (process.env.API_BASE_URL || "https://xn--9kqy92aeqav77a.com/api").replace(/\/$/, "");
const call = async (method, path, body, token, origin = "app://anju") => {
  const response = await fetch(base + path, {
    method,
    headers: {
      Accept: "application/json",
      Origin: origin,
      "X-Data-Mode": "demo",
      "X-Anju-Client": "judge-smoke/1.0.0",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${payload.error?.code}`);
  assert.ok(Object.hasOwn(payload, "data"));
  return { data: payload.data, headers: response.headers };
};
const key = () => randomBytes(32).toString("base64url");
const installationKey = key();
const otherInstallationKey = key();
const startedAt = Date.now();

const issued = await call("POST", "/auth/demo-session", {
  installationKey,
  platform: "windows",
  clientVersion: "1.0.0-smoke",
});
assert.equal(issued.headers.get("access-control-allow-origin"), "app://anju");
assert.ok(issued.data.user.bindings.some((item) => item.floorId === "floor-1-1-6"));
const token = issued.data.token;
const devices = await call("GET", "/devices?floorId=floor-1-1-6", undefined, token);
assert.ok(devices.data.items.length >= 2);
assert.ok(devices.data.items.every((item) => item.source === "demo"));

const radar = await call("GET", "/agent/resident-radar", undefined, token);
assert.match(radar.data.address, /云栖|1号楼|6层/);
const assisted = await call("POST", "/agent/resident-assist", {
  role: "identify",
  messages: [{ role: "user", content: "走廊堆了纸箱挡住疏散通道" }],
}, token);
assert.equal(assisted.data.card.riskLevel, "high");
assert.equal(assisted.data.card.reportDraft.type, "obstruction");
assert.ok(assisted.data.card.nextSteps.some((step) => step.url === "/pages/report/report"));

const report = await call("POST", "/reports", {
  idempotencyKey: `judge-smoke-report-${randomUUID()}`,
  floorId: "floor-1-1-6",
  type: "obstruction",
  location: "1号楼6层自动验收位置",
  description: "Windows与安卓评委体验应用公网自动验收记录。",
  contact: "13800000000",
  attachmentIds: [],
}, token);
const mine = await call("GET", "/reports/mine?pageSize=50", undefined, token);
assert.ok(mine.data.items.some((item) => item.id === report.data.id));

const drill = await call("POST", "/drills", {
  floorId: "floor-1-1-6",
  idempotencyKey: `judge-smoke-drill-${randomUUID()}`,
}, token);
await call("PUT", `/drills/${drill.data.id}/progress`, {
  durationMs: 0,
  completedSteps: ["exit"],
}, token);
const summary = await call("POST", `/drills/${drill.data.id}/complete`, {
  durationMs: Math.min(1000, Date.now() - startedAt),
  completedSteps: ["exit", "assembly"],
}, token);
assert.equal(summary.data.status, "completed");

const restored = await call("POST", "/auth/demo-session", {
  installationKey,
  platform: "windows",
  clientVersion: "1.0.0-smoke-reopen",
});
assert.equal(restored.data.user.id, issued.data.user.id);
const afterReopen = await call("GET", "/reports/mine?pageSize=50", undefined, restored.data.token);
assert.ok(afterReopen.data.items.some((item) => item.id === report.data.id));

const isolated = await call("POST", "/auth/demo-session", {
  installationKey: otherInstallationKey,
  platform: "android",
  clientVersion: "1.0.0-smoke-isolation",
});
const isolatedMine = await call("GET", "/reports/mine", undefined, isolated.data.token);
assert.equal(isolatedMine.data.total, 0);

console.log(JSON.stringify({
  api: base,
  userRestored: true,
  isolatedUser: true,
  deviceCount: devices.data.total,
  assistantProvider: assisted.data.model.provider,
  assistantDraftType: assisted.data.card.reportDraft.type,
  reportId: report.data.id,
  reportNumber: report.data.number,
  drillId: drill.data.id,
  drillStatus: summary.data.status,
}, null, 2));
