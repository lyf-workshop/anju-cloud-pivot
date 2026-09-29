const { define } = require("../../utils/page"),
  repo = require("../../services/repository"),
  session = require("../../services/session"),
  fmt = require("../../services/format");
define({
  data: {
    user: null,
    reportStats: { total: 0 },
    drillStats: { completedCount: 0 },
    menus: [
      {icon:'user',title:'个人资料',note:'管理昵称、示例资料',url:'/pages/profile/profile'},
      {
        icon: "report",
        title: "我的上报",
        note: "查看处理状态与记录",
        url: "/pages/my-reports/my-reports",
      },
      {
        icon: "pin",
        title: "住址管理",
        note: "管理绑定的楼栋与房号",
        url: "/pages/addresses/addresses",
      },
      {
        icon: "bell",
        title: "社区通知",
        note: "查看公告与安全提示",
        url: "/pages/notices/notices",
      },
      {
        icon: "settings",
        title: "设置与帮助",
        note: "使用说明与展示说明",
        url: "/pages/help/help",
      },
      {icon:'drill',title:'演练记录',note:'回顾每一次线上练习',url:'/pages/drill-records/drill-records'},
    ],
  },
  onShow() {
    this.load();
  },
  load() {
    this.setData({
      user: null,
      reportStats: { total: 0 },
      drillStats: { completedCount: 0 },
    });
    if (!session.get() || session.get().expired) return;
    return this.fetch(async () => {
      const [user, reportStats, drillStats] = await Promise.all([
        repo.me(),
        repo.reportStats(),
        repo.drillStats(),
      ]);
      this.setData({
        user,
        reportStats,
        drillStats,
        durationText: fmt.duration(drillStats.durationSeconds),
        address: user.bindings.find((b) => b.isCurrent) || null,
      });
    });
  },
  logout() {
    wx.showModal({
      title: "退出登录",
      content: "退出后返回登录页，当前体验内容将恢复为示例数据。",
      success: (r) => {
        if (r.confirm)
          this.task(async () => {
            try {
              await repo.logout();
            } finally {
              this.setData({
                user: null,
                reportStats: { total: 0 },
                drillStats: { completedCount: 0 },
                address: null,
              });
              wx.reLaunch({ url: "/pages/login/login" });
            }
          });
      },
    });
  },
});
