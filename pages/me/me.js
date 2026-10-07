const { define } = require("../../utils/page"),
  repo = require("../../services/repository"),
  session = require("../../services/session"),
  fmt = require("../../services/format");
define({
  data: {
    user: null,
    address: null,
    reportStats: { total: 0, processing: 0, completed: 0 },
    drillStats: { completedCount: 0 },
    householdSummary: "",
    menus: [
      { icon: "user", title: "个人资料", url: "/pages/profile/profile" },
      { icon: "report", title: "我的上报", url: "/pages/my-reports/my-reports" },
      { icon: "pin", title: "住址管理", url: "/pages/addresses/addresses" },
      { icon: "bell", title: "社区通知", url: "/pages/notices/notices" },
      { icon: "phone", title: "应急电话", url: "/pages/emergency/emergency" },
      { icon: "drill", title: "演练记录", url: "/pages/drill-records/drill-records" },
      { icon: "settings", title: "设置与帮助", url: "/pages/help/help" },
    ],
  },
  onShow() {
    this.load();
  },
  onProfileTap() {
    if (!this.data.user) {
      this.login();
      return;
    }
    wx.navigateTo({ url: "/pages/profile/profile" });
  },
  load() {
    this.setData({
      user: null,
      address: null,
      reportStats: { total: 0, processing: 0, completed: 0 },
      drillStats: { completedCount: 0 },
      householdSummary: "",
    });
    if (!session.get() || session.get().expired) return;
    return this.fetch(async () => {
      const [user, reportStats, drillStats] = await Promise.all([
        repo.me(),
        repo.reportStats(),
        repo.drillStats(),
      ]);
      const household = user.household;
      this.setData({
        user,
        reportStats,
        drillStats,
        durationText: fmt.duration(drillStats.durationSeconds),
        address: user.bindings.find((b) => b.isCurrent) || null,
        householdSummary: household
          ? `${household.unitName || ""} ${household.floorNumber || ""}层 ${household.room || ""} · ${household.familyCount}人`
          : "",
      });
    });
  },
  logout() {
    wx.showModal({
      title: "退出登录",
      content: this.data.connected
        ? "退出后会清理本机登录信息；服务器已保存的上报和演练记录仍会保留。"
        : "退出后返回登录页，当前体验内容将恢复为示例数据。",
      success: (r) => {
        if (r.confirm)
          this.task(async () => {
            try {
              await repo.logout();
            } finally {
              this.setData({
                user: null,
                reportStats: { total: 0, processing: 0, completed: 0 },
                drillStats: { completedCount: 0 },
                address: null,
                householdSummary: "",
              });
              wx.reLaunch({ url: "/pages/login/login" });
            }
          });
      },
    });
  },
});
