const http = require("./http");
const config = require("../config/index");
const session = require("./session");
const query = (obj) =>
  Object.keys(obj || {})
    .filter((k) => obj[k] !== "" && obj[k] !== undefined)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]))
    .join("&");
const get = (p, q) => http.request(p + (q ? "?" + query(q) : ""));
const post = (p, b) => http.request(p, "POST", b);
const adapters = {
  demo: async (data) =>
    post(
      "/auth/dev-login",
      Object.assign({}, data, { demoAccount: "resident-a" }),
    ),
  api: async (data) => {
    const code = await new Promise((resolve, reject) =>
      wx.login({
        timeout: 10000,
        success: (r) =>
          r.code
            ? resolve(r.code)
            : reject(new Error("未获取微信登录凭证，请重试")),
        fail: () => reject(new Error("微信登录失败，请重试")),
      }),
    );
    return post("/auth/login", Object.assign({}, data, { code }));
  },
};
module.exports = {
  config: () => get("/config"),
  async login(agreed, legalVersion) {
    if (!agreed) throw new Error("请先阅读并同意协议");
    http.modeGuard();
    const result = await adapters[config.mode]({ agreed: true, legalVersion });
    const old = session.get();
    if (old && old.user.id !== result.user.id) session.clear();
    session.set(result);
    return result.user;
  },
  async me() {
    const u = await get("/me");
    const s = session.get();
    if (s) {
      s.user = u;
      s.expired = false;
      session.set(s);
    }
    return u;
  },
  profile: (nickname) => http.request("/me", "PATCH", { nickname }),
  async logout() {
    try {
      await post("/auth/logout", {});
    } finally {
      require("./drill-clock").reset();
      session.clear();
    }
  },
  bindings: () => get("/bindings"),
  bind: (data) => post("/bindings", data),
  current: (id) => http.request("/bindings/" + id + "/current", "PUT", {}),
  communities: () => get("/communities"),
  buildings: (communityId) => get("/buildings", { communityId }),
  building: (id) => get("/buildings/" + id),
  home: (communityId) => get("/home", { communityId }),
  notices: (q) => get("/announcements", q),
  upload: http.upload,
  image: http.image,
  createReport: (p) => post("/reports", p),
  submission: async (key) => {
    try {
      return await get("/reports/submission/" + encodeURIComponent(key));
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  },
  report: (id) => get("/reports/" + id),
  reports: (mine, q) => get(mine ? "/reports/mine" : "/reports/community", q),
  reportStats: () => get("/reports/stats"),
  devices: (q) => get("/devices", q),
  device: (id) => get("/devices/" + id),
  createDrill: (p) => post("/drills", p),
  drill: (id) => get("/drills/" + id),
  drills: (q) => get("/drills", q),
  drillStats: () => get("/drills/stats"),
  progress: (id, p) => http.request("/drills/" + id + "/progress", "PUT", p),
  complete: (id, p) => post("/drills/" + id + "/complete", p),
  abort: (id, p) => post("/drills/" + id + "/abort", p),
};
