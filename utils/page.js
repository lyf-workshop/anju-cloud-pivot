const session = require("../services/session");
const config = require("../config/index");
const tabs = [
  "/pages/index/index",
  "/pages/hazards/hazards",
  "/pages/building/building",
  "/pages/me/me",
];
function go(url) {
  if (tabs.includes(url.split("?")[0])) {
    wx.switchTab({ url: url.split("?")[0] });
  } else wx.navigateTo({ url });
}
function requireLogin() {
  const s = session.get();
  if (s && !s.expired) return true;
  go("/pages/login/login");
  return false;
}
function error(page, e) {
  page.setData({
    error: e.message || "操作失败，请重试",
    loading: false,
    busy: false,
  });
}
function syncTabBar(page) {
  if (typeof page.getTabBar !== "function") return;
  const bar = page.getTabBar();
  if (!bar) return;
  const route = "/" + (page.route || "");
  const index = tabs.indexOf(route);
  if (index >= 0) bar.setData({ selected: index });
}
const common = {
  data: {
    loading: false,
    error: "",
    busy: false,
    connected: config.mode !== "showcase",
    localBackend:
      config.mode === "local" && config.loginMode !== "demo-session",
    remoteDemo: config.loginMode === "demo-session",
  },
  go(e) {
    go(e.currentTarget.dataset.url);
  },
  login() {
    go("/pages/login/login");
  },
  retry() {
    if (this.load) this.load();
  },
  async task(fn) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      return await fn();
    } catch (e) {
      error(this, e);
    } finally {
      this.setData({ busy: false });
    }
  },
  async fetch(fn) {
    this.setData({ loading: true, error: "" });
    try {
      await fn();
    } catch (e) {
      error(this, e);
    } finally {
      this.setData({ loading: false });
    }
  },
  onPullDownRefresh() {
    Promise.resolve(this.load && this.load()).finally(() =>
      wx.stopPullDownRefresh(),
    );
  },
};
function define(spec) {
  const obj = Object.assign({}, common, spec);
  obj.data = Object.assign({}, common.data, spec.data || {});
  const initial = JSON.parse(JSON.stringify(obj.data));
  obj.resetPrivateView = function () {
    this.setData(JSON.parse(JSON.stringify(initial)));
    this.draftKey = null;
  };
  const userOnShow = obj.onShow;
  obj.onShow = function () {
    syncTabBar(this);
    if (typeof userOnShow === "function") return userOnShow.call(this);
  };
  Page(obj);
}
module.exports = { define, go, requireLogin, error };
