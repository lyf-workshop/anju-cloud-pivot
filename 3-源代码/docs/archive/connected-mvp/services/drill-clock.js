// Elapsed time derives from wall-clock deltas while a drill page is visible.
// Checkpoints persist every second and at hide/unload; background time is never added.
const session = require("./session");
let activeId = "",
  anchor = 0,
  timer = null,
  owner = "";
const storageKey = (id) => session.privateKey("drill:" + id);
const load = (id) => wx.getStorageSync(storageKey(id)) || null;
function save(value) {
  wx.setStorageSync(storageKey(value.id), value);
  return value;
}
function capture() {
  if (!activeId || !anchor) return;
  const item = load(activeId);
  const t = Date.now();
  if (item) {
    item.durationMs += Math.max(0, t - anchor);
    save(item);
  }
  anchor = t;
}
function pause() {
  capture();
  anchor = 0;
  if (timer) clearInterval(timer);
  timer = null;
}
function reset() {
  pause();
  activeId = "";
  owner = "";
}
function start(id) {
  pause();
  const item = load(id);
  if (!item || item.status !== "in_progress" || item.pendingAction) return;
  activeId = id;
  owner = (session.get() || {}).user?.id || "";
  anchor = Date.now();
  timer = setInterval(capture, 1000);
}
function importRecord(record) {
  const old = load(record.id);
  if (old && old.status !== "in_progress" && record.status === "in_progress")
    return old;
  const merged = Object.assign({}, record, {
    completedSteps: record.completedSteps.map((s) => s.id || s),
  });
  if (old && record.status === "in_progress") {
    merged.durationMs = Math.max(old.durationMs, record.durationMs);
    merged.completedSteps = Array.from(
      new Set(old.completedSteps.concat(merged.completedSteps)),
    );
    merged.pendingAction = old.pendingAction || "";
  }
  return save(merged);
}
function payload(id) {
  capture();
  const r = load(id);
  return { durationMs: r.durationMs, completedSteps: r.completedSteps };
}
function confirm(id, step) {
  capture();
  const r = load(id);
  if (!r.completedSteps.includes(step)) r.completedSteps.push(step);
  save(r);
}
async function sync(id) {
  const requestOwner = session.privateKey("drill:" + id);
  const repo = require("./repository"),
    item = load(id),
    action = item.pendingAction;
  const result = await (action === "complete"
    ? repo.complete(id, payload(id))
    : action === "abort"
      ? repo.abort(id, payload(id))
      : repo.progress(id, payload(id)));
  if (requestOwner !== session.privateKey("drill:" + id)) return result;
  return importRecord(result);
}
function pending(id, action) {
  pause();
  const item = load(id);
  item.pendingAction = action;
  save(item);
}
function resume() {
  const s = session.get();
  if (activeId && s && s.user.id === owner) start(activeId);
}
module.exports = {
  load,
  save,
  start,
  pause,
  reset,
  capture,
  importRecord,
  payload,
  confirm,
  sync,
  pending,
  resume,
};
