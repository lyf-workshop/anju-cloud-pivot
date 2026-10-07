// Page-facing local data functions. Replace this module for a future API integration.
// Deliberately no HTTP client, authentication token, database, or network fallback.
const data = require("../mock/data");
const store = require("../mock/store");
const session = require("./session");
const copy = store.clone;
const find = (items, id, label) => {
  const item = items.find((x) => x.id === id);
  if (!item) throw new Error(`${label}不存在，请返回列表重新选择`);
  return item;
};
function list(items, q = {}) {
  const selected = q.status
    ? items.filter((x) => x.status === q.status)
    : items;
  const page = Number(q.page) || 1,
    pageSize = Number(q.pageSize) || 20;
  return copy({
    items: selected.slice((page - 1) * pageSize, page * pageSize),
    total: selected.length,
    page,
    pageSize,
  });
}
const updateSession = () => {
  if (session.get()) session.set({ user: copy(store.get().user) });
};
module.exports = {
  async config() {
    return copy(data.config);
  },
  async login(agreed) {
    if (!agreed) throw new Error("请先勾选并同意展示说明");
    session.set({ user: copy(store.get().user) });
    return copy(store.get().user);
  },
  async logout() {
    session.clear();
    store.reset();
    require("./selection").reset();
  },
  async me() {
    return copy(store.get().user);
  },
  async profile(nickname) {
    if (!nickname.trim()) throw new Error("请填写昵称");
    store.get().user.nickname = nickname.trim();
    updateSession();
    return copy(store.get().user);
  },
  async householdOptions() {
    return copy(data.householdOptions);
  },
  async saveHousehold(form) {
    const floorId = form.floorId;
    const room = String(form.room || "").trim();
    const familyCount = Number(form.familyCount);
    const elderly = Number(form.elderly || 0);
    const children = Number(form.children || 0);
    const pets = Number(form.pets || 0);
    if (!floorId) throw new Error("请选择单元和层数");
    if (!room) throw new Error("请填写房号");
    if (!Number.isFinite(familyCount) || familyCount < 1)
      throw new Error("请填写有效的家庭人数");
    if (elderly < 0 || children < 0 || pets < 0)
      throw new Error("人数不能为负数");
    // 第二步重点人群 / 特殊情况均为选填，不做人数合计校验
    const situations = Array.isArray(form.situations) ? form.situations : [];
    const s = data.scene(floorId);
    const roomLabel = /室$/.test(room) ? room : `${room}室`;
    const bindings = store.get().user.bindings;
    bindings.forEach((b) => {
      b.isCurrent = false;
    });
    const current = bindings.find(
      (b) => b.floorId === floorId && b.room === roomLabel,
    );
    if (current) {
      current.isCurrent = true;
      Object.assign(current, {
        ...s,
        room: roomLabel,
        address: `${s.communityName} ${s.buildingName} ${s.unitName} ${s.floorNumber}层 ${roomLabel}`,
      });
    } else {
      bindings.push({
        id: store.id("address"),
        ...s,
        room: roomLabel,
        isCurrent: true,
        verification: "demo",
        address: `${s.communityName} ${s.buildingName} ${s.unitName} ${s.floorNumber}层 ${roomLabel}`,
      });
    }
    store.get().user.household = {
      communityId: s.communityId,
      buildingId: s.buildingId,
      unitId: s.unitId,
      floorId: s.floorId,
      unitName: s.unitName,
      floorNumber: s.floorNumber,
      buildingName: s.buildingName,
      room: roomLabel,
      familyCount,
      elderly,
      children,
      pets,
      situations,
      address: `${s.communityName} ${s.buildingName} ${s.unitName} ${s.floorNumber}层 ${roomLabel}`,
      updatedAt: new Date().toISOString(),
    };
    updateSession();
    return copy(store.get().user.household);
  },
  async bindings() {
    return copy(store.get().user.bindings);
  },
  async bind({ floorId, room }) {
    const s = data.scene(floorId);
    if (!room.trim()) throw new Error("请填写示例房号");
    store.get().user.bindings.forEach((b) => {
      b.isCurrent = false;
    });
    const b = {
      id: store.id("address"),
      ...s,
      room: room.trim(),
      isCurrent: true,
      verification: "demo",
      address: `${s.communityName} ${s.buildingName} ${s.unitName} ${s.floorNumber}层 ${room.trim()}`,
    };
    store.get().user.bindings.push(b);
    updateSession();
    return copy(store.get().user.bindings);
  },
  async current(id) {
    const items = store.get().user.bindings;
    find(items, id, "住址");
    items.forEach((b) => {
      b.isCurrent = b.id === id;
    });
    updateSession();
    return copy(items);
  },
  async communities() {
    return [copy(data.community)];
  },
  async buildings(communityId) {
    return copy(
      data.buildings
        .filter((b) => b.communityId === communityId)
        .map(({ id, name, communityId }) => ({ id, name, communityId })),
    );
  },
  async building(id) {
    return copy(find(data.buildings, id, "楼栋"));
  },
  async home() {
    return copy({
      community: data.community,
      buildings: data.buildings.map(({ id, name }) => ({ id, name })),
      announcements: data.announcements,
      reportCount: store.get().reports.length,
      deviceCount: data.devices.length,
    });
  },
  async notices(q) {
    return list(data.announcements, q);
  },
  async createReport(form) {
    if (
      !form.floorId ||
      form.location.trim().length < 2 ||
      form.description.trim().length < 5
    )
      throw new Error("请选择楼层，并填写具体位置和至少5字描述");
    if (!(form.photos || []).length)
      throw new Error("请先拍摄或选择至少一张现场照片");
    if (!form.hazardId && !form.type)
      throw new Error("请选择隐患类型");
    const scene = data.scene(form.floorId),
      id = store.id("report"),
      createdAt = new Date().toISOString();
    const hazardName = (form.hazardName || form.title || "").trim();
    const record = {
      ...copy(form),
      id,
      number: `DEMO-${String(store.get().reports.length + 1).padStart(4, "0")}`,
      status: "pending",
      createdAt,
      buildingName: scene.buildingName,
      communityId: scene.communityId,
      photos: (form.photos || []).slice(0, 3),
      title: hazardName || form.title,
      hazardName,
      isExample: false,
      events: [
        {
          status: "pending",
          message: "已生成本地演示记录，未提交物业",
          occurredAt: createdAt,
        },
      ],
    };
    store.get().reports.unshift(record);
    return copy(record);
  },
  async report(id) {
    return copy(find(store.get().reports, id, "上报记录"));
  },
  async reports(mine, q) {
    return list(store.get().reports, q);
  },
  async reportStats() {
    const result = { total: 0, pending: 0, processing: 0, completed: 0 };
    store.get().reports.forEach((r) => {
      result.total++;
      result[r.status]++;
    });
    return result;
  },
  async devices(q = {}) {
    return list(
      data.devices.filter(
        (d) => d.floorId === (q.floorId || data.defaultSelection.floorId),
      ),
      q,
    );
  },
  async device(id) {
    return copy(find(data.devices, id, "设备"));
  },
  async createDrill({ floorId }) {
    const id = store.id("drill");
    const record = {
      id,
      drillSessionId: id,
      status: "in_progress",
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationSeconds: 0,
      completedSteps: [],
      totalSteps: 2,
      snapshot: copy(data.scene(floorId)),
      isExample: false,
    };
    store.get().drills.unshift(record);
    return copy(record);
  },
  async confirmStep(id, step) {
    const r = find(store.get().drills, id, "演练记录");
    if (r.status !== "in_progress") return copy(r);
    if (!["exit", "assembly"].includes(step)) throw new Error("未知的演练步骤");
    if (!r.completedSteps.some((s) => s.id === step))
      r.completedSteps.push({ id: step });
    return copy(r);
  },
  async complete(id) {
    const r = find(store.get().drills, id, "演练记录");
    if (r.status !== "in_progress") return copy(r);
    if (r.completedSteps.length !== 2) throw new Error("请先完成两个线上步骤");
    r.status = "completed";
    r.completedAt = new Date().toISOString();
    r.durationSeconds = Math.max(
      0,
      Math.floor((Date.parse(r.completedAt) - Date.parse(r.startedAt)) / 1000),
    );
    return copy(r);
  },
  async abort(id) {
    const r = find(store.get().drills, id, "演练记录");
    if (r.status === "in_progress") {
      r.status = "aborted";
      r.completedAt = new Date().toISOString();
      r.durationSeconds = Math.max(
        0,
        Math.floor(
          (Date.parse(r.completedAt) - Date.parse(r.startedAt)) / 1000,
        ),
      );
    }
    return copy(r);
  },
  async drill(id) {
    return copy(find(store.get().drills, id, "演练记录"));
  },
  async drills(q) {
    return list(store.get().drills, q);
  },
  async drillStats() {
    const items = store.get().drills.filter((d) => d.status === "completed");
    return {
      completedCount: items.length,
      durationSeconds: items.reduce((n, d) => n + d.durationSeconds, 0),
      completedSteps: items.reduce((n, d) => n + d.completedSteps.length, 0),
    };
  },
  async residentRadar() {
    return require("./resident-assist-scripted").radar(store.get().user);
  },
  async residentAssist(body) {
    return require("./resident-assist-scripted").assist(body);
  },
};
