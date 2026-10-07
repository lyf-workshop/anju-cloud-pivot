const http = require("./http"),
  config = require("../config/index"),
  session = require("./session"),
  fmt = require("./format");
const query = (obj) =>
  Object.keys(obj || {})
    .filter((k) => obj[k] !== "" && obj[k] !== undefined)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]))
    .join("&");
const get = (path, q) => http.request(path + (q ? "?" + query(q) : ""));
const post = (path, body) => http.request(path, "POST", body);
const clock = () => require("./drill-clock");
const householdOptions = require("../mock/data").householdOptions;
const demoInstallationKeyName = "anju:wechat-demo-installation:v1";

function demoInstallationKey() {
  let value = wx.getStorageSync(demoInstallationKeyName) || "";
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(value)) {
    value = (fmt.uid() + "-" + fmt.uid()).slice(0, 96);
    wx.setStorageSync(demoInstallationKeyName, value);
  }
  return value;
}

function decorateUser(rawUser) {
  const user = { ...rawUser, bindings: (rawUser.bindings || []).slice() };
  const binding = user.bindings.find((item) => item.isCurrent) || user.bindings[0];
  if (!binding) return { ...user, household: null };
  const saved = wx.getStorageSync(session.privateKey("household")) || {};
  const sameHome =
    saved.floorId === binding.floorId &&
    (!saved.room || String(saved.room).replace(/室$/, "") === String(binding.room || "").replace(/室$/, ""));
  const details = sameHome ? saved : {};
  return {
    ...user,
    household: {
      communityId: binding.communityId,
      buildingId: binding.buildingId,
      unitId: binding.unitId,
      floorId: binding.floorId,
      communityName: binding.communityName,
      buildingName: binding.buildingName,
      unitName: binding.unitName,
      floorNumber: binding.floorNumber,
      room: binding.room,
      address: binding.address,
      familyCount: Number(details.familyCount || 1),
      elderly: Number(details.elderly || 0),
      children: Number(details.children || 0),
      pets: Number(details.pets || 0),
      situations: Array.isArray(details.situations) ? details.situations : [],
      updatedAt: details.updatedAt || binding.createdAt || null,
    },
  };
}

function reportMeta() {
  return wx.getStorageSync(session.privateKey("report-meta")) || {};
}

function withReportMeta(record) {
  if (!record || !record.id) return record;
  return { ...record, ...(reportMeta()[record.id] || {}) };
}

function rememberReportMeta(record, form) {
  if (!record || !record.id) return record;
  const all = reportMeta();
  all[record.id] = {
    hazardId: form.hazardId || "",
    hazardName: form.hazardName || "",
    title: form.title || form.hazardName || "",
    categoryId: form.categoryId || "",
  };
  wx.setStorageSync(session.privateKey("report-meta"), all);
  return withReportMeta(record);
}

async function savedDrill(id, action, payload) {
  if (!payload) {
    if (!clock().load(id)) clock().importRecord(await get("/drills/" + id));
    clock().pending(id, action);
    payload = clock().payload(id);
  }
  const result = await post(`/drills/${id}/${action}`, payload);
  clock().importRecord(result);
  return result;
}
module.exports = {
  config: () => get("/config"),
  async login(agreed, legalVersion) {
    if (!agreed) throw new Error("请先阅读并勾选协议");
    let result;
    if (config.loginMode === "demo-session")
      result = await post("/auth/demo-session", {
        installationKey: demoInstallationKey(),
        // The deployed demo API currently groups browser-like runtimes as web.
        platform: "web",
        clientVersion: "miniprogram-1.1.0",
      });
    else if (config.mode === "local")
      result = await post("/auth/dev-login", {
        agreed: true,
        legalVersion,
        demoAccount: config.demoAccount,
      });
    else {
      const code = await new Promise((resolve, reject) =>
        wx.login({
          timeout: 10000,
          success: (r) =>
            r.code ? resolve(r.code) : reject(new Error("微信登录未返回凭证")),
          fail: () => reject(new Error("微信登录失败，请重试")),
        }),
      );
      result = await post("/auth/login", { agreed: true, legalVersion, code });
    }
    if (session.get() && session.get().user.id !== result.user.id)
      session.clear();
    session.set(result);
    const user = decorateUser(result.user);
    session.set({ ...result, user });
    return user;
  },
  async me() {
    const user = decorateUser(await get("/me")),
      s = session.get();
    if (s) session.set({ ...s, user, expired: false });
    return user;
  },
  async profile(nickname) {
    const user = decorateUser(await http.request("/me", "PATCH", { nickname }));
    const s = session.get();
    if (s) session.set({ ...s, user, expired: false });
    return user;
  },
  householdOptions: async () => householdOptions.map((item) => ({ ...item })),
  async saveHousehold(form) {
    const value = String(form.room || "").trim();
    const room = /室$/.test(value) ? value : value + "室";
    const bindings = await post("/bindings", { floorId: form.floorId, room });
    const binding = (bindings || []).find((item) => item.isCurrent) ||
      (bindings || []).find((item) => item.floorId === form.floorId);
    const details = {
      floorId: form.floorId,
      room: binding ? binding.room : room,
      familyCount: Number(form.familyCount || 1),
      elderly: Number(form.elderly || 0),
      children: Number(form.children || 0),
      pets: Number(form.pets || 0),
      situations: Array.isArray(form.situations) ? form.situations.slice() : [],
      updatedAt: new Date().toISOString(),
    };
    wx.setStorageSync(session.privateKey("household"), details);
    const user = decorateUser(await get("/me"));
    const s = session.get();
    if (s) session.set({ ...s, user, expired: false });
    return user.household;
  },
  async logout() {
    try {
      await post("/auth/logout", {});
    } finally {
      clock().reset();
      session.clear();
      require("./selection").reset();
    }
  },
  bindings: () => get("/bindings"),
  bind: (body) => post("/bindings", body),
  current: (id) => http.request(`/bindings/${id}/current`, "PUT", {}),
  communities: () => get("/communities"),
  buildings: (communityId) => get("/buildings", { communityId }),
  building: (id) => get("/buildings/" + id),
  home: (communityId) => get("/home", { communityId }),
  notices: (q) => get("/announcements", q),
  image: http.image,
  async createReport(form) {
    if (
      !form.floorId ||
      form.location.trim().length < 2 ||
      form.description.trim().length < 5
    )
      throw new Error("请选择楼层，填写具体位置和至少5字描述");
    const contact = String(form.contact || "").trim();
    if (contact && !/^[0-9+()\- ]{5,30}$/.test(contact))
      throw new Error("请填写有效联系电话（5—30位）");
    const idempotencyKey = form.idempotencyKey || fmt.uid();
    // Resolve a lost response before uploading again or creating another record.
    try {
      const existing = await get(
        "/reports/submission/" + encodeURIComponent(idempotencyKey),
      );
      return rememberReportMeta(existing, form);
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    const uploadKey = session.privateKey("uploads:" + idempotencyKey);
    const uploaded = wx.getStorageSync(uploadKey) || {};
    const attachmentIds = [];
    for (const file of (form.photos || []).slice(0, 3)) {
      if (!uploaded[file]) {
        uploaded[file] = (await http.upload(file)).id;
        wx.setStorageSync(uploadKey, uploaded);
      }
      attachmentIds.push(uploaded[file]);
    }
    const body = {
      idempotencyKey,
      floorId: form.floorId,
      type: form.type,
      location: form.location,
      description: form.description,
      // The current API requires a contact value. 00000 is the documented demo
      // placeholder and is rendered back to the user as “未填写”.
      contact: contact || "00000",
      attachmentIds,
    };
    if (form.deviceId) body.deviceId = form.deviceId;
    return rememberReportMeta(await post("/reports", body), form);
  },
  async report(id, publicView) {
    const record = await get((publicView ? "/reports/public/" : "/reports/") + id);
    return publicView ? record : withReportMeta(record);
  },
  async reports(mine, q) {
    const result = await get(mine ? "/reports/mine" : "/reports/community", q);
    if (mine) result.items = (result.items || []).map(withReportMeta);
    return result;
  },
  reportStats: () => get("/reports/stats"),
  devices: (q) => get("/devices", q),
  device: (id) => get("/devices/" + id),
  async createDrill(body) {
    const key = session.privateKey("drill-create");
    const pending = wx.getStorageSync(key);
    const payload =
      pending && pending.floorId === body.floorId
        ? pending
        : { ...body, idempotencyKey: fmt.uid() };
    wx.setStorageSync(key, payload);
    const record = await post("/drills", payload);
    wx.removeStorageSync(key);
    clock().importRecord(record);
    return record;
  },
  drill: (id) => get("/drills/" + id),
  drills: (q) => get("/drills", q),
  drillStats: () => get("/drills/stats"),
  progress: (id, body) => http.request(`/drills/${id}/progress`, "PUT", body),
  async confirmStep(id, step) {
    if (!clock().load(id)) clock().importRecord(await get("/drills/" + id));
    clock().confirm(id, step);
    const result = await http.request(
      `/drills/${id}/progress`,
      "PUT",
      clock().payload(id),
    );
    clock().importRecord(result);
    return result;
  },
  complete: (id, body) => savedDrill(id, "complete", body),
  abort: (id, body) => savedDrill(id, "abort", body),
  residentRadar: () => get("/agent/resident-radar"),
  residentAssist: (body) => post("/agent/resident-assist", body),
};
