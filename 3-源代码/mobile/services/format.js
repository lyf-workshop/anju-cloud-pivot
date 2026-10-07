const statusNames = {
  pending: "待处理",
  processing: "处理中",
  completed: "已完成",
  in_progress: "进行中",
  aborted: "已中止",
};
const types = [
  { id: "fire", name: "消防隐患" },
  { id: "obstruction", name: "通道堵塞" },
  { id: "equipment", name: "设备问题" },
  { id: "electrical", name: "用电安全" },
  { id: "other", name: "其他隐患" },
];
const defaultTitles = {
  obstruction: "消防通道堆放杂物",
  equipment: "公共设备需要检修",
  electrical: "公共用电设施隐患",
  fire: "消防设施安全隐患",
  other: "其他社区隐患",
};
const defaultCovers = {
  obstruction: "obstruction",
  equipment: "equipment",
  electrical: "electrical",
  fire: "fire",
};
function date(value) {
  if (!value) return "暂无记录";
  const d = new Date(value);
  const p = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    p(d.getMonth() + 1) +
    "-" +
    p(d.getDate()) +
    " " +
    p(d.getHours()) +
    ":" +
    p(d.getMinutes())
  );
}
function duration(seconds) {
  return (
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" +
    String(Math.floor(seconds % 60)).padStart(2, "0")
  );
}
function report(r) {
  let hazardTypes;
  try {
    hazardTypes = require("./hazard-types");
  } catch (_) {
    hazardTypes = null;
  }
  const hit =
    hazardTypes && r.hazardId ? hazardTypes.findItem(r.hazardId) : null;
  const title =
    r.title ||
    r.hazardName ||
    (hit && hit.item && hit.item.name) ||
    defaultTitles[r.type] ||
    "社区隐患";
  const exampleCover =
    (hit && hit.item && hit.item.image) ||
    "/assets/illustrations/" +
      (defaultCovers[r.type] || "obstruction") +
      ".png";
  return Object.assign({}, r, {
    title,
    cover: (r.photos || [])[0] || exampleCover,
    typeName:
      r.hazardName ||
      (hit && hit.item && hit.item.name) ||
      (types.find((t) => t.id === r.type) || {}).name ||
      r.type,
    categoryName:
      r.categoryName ||
      (hit && hit.category && hit.category.name) ||
      "",
    statusName: statusNames[r.status],
    contact: r.contact === "00000" ? "" : r.contact,
    timeText: date(r.createdAt),
    events: (r.events || []).map((e) =>
      Object.assign({}, e, { timeText: date(e.occurredAt) }),
    ),
  });
}
function drill(r) {
  return Object.assign({}, r, {
    statusName: statusNames[r.status],
    timeText: date(r.completedAt || r.startedAt),
    durationText: duration(r.durationSeconds),
    completedCount: r.completedSteps.length,
    steps: r.snapshot.steps.map((s) =>
      Object.assign({}, s, {
        confirmed: r.completedSteps.some((c) => (c.id || c) === s.id),
      }),
    ),
  });
}
function uid() {
  return (
    "client-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}
module.exports = { types, date, duration, report, drill, uid, statusNames };
