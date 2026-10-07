const { define, go } = require("../../utils/page"),
  repo = require("../../services/repository"),
  selection = require("../../services/selection");

/** 轮播高度：不超过可视区域 1/3；略抬高一点给底部弧形留白 */
function calcHeroHeight() {
  try {
    const sys = wx.getSystemInfoSync();
    const third = Math.floor((sys.windowHeight || 667) / 3);
    return Math.max(160, Math.min(third, 230));
  } catch (e) {
    return 190;
  }
}

define({
  data: {
    home: { community: {}, announcements: [], buildings: [] },
    communities: [],
    communityIndex: 0,
    // 顶部纯图片轮播：居家消防安全插画
    heroSlides: [
      { id: "banner-1", image: "/assets/illustrations/hero-banner-1.png" },
      { id: "banner-2", image: "/assets/illustrations/hero-banner-2.png" },
    ],
    heroCurrent: 0,
    heroAutoplay: true,
    heroHeight: 180,
    services: [
      {
        icon: "hazard-active",
        title: "隐患上报",
        note: "发现问题，随手上报",
        url: "/pages/report/report?camera=1",
        style: "main",
      },
      {
        icon: "wrench",
        title: "报事报修",
        note: "社区服务",
        url: "",
        style: "",
      },
      {
        icon: "report",
        title: "投诉建议",
        note: "社区服务",
        url: "",
        style: "",
      },
      {
        icon: "cloud",
        title: "社区天气",
        note: "社区服务",
        url: "",
        style: "light",
      },
      { icon: "book", title: "物业缴费", url: "" },
      { icon: "calendar", title: "社区活动", url: "" },
    ],
  },
  onLoad() {
    this.setData({ heroHeight: calcHeroHeight() });
  },
  onShow() {
    // 回到首页时恢复自动轮播
    this.setData({ heroAutoplay: true });
    this.load();
  },
  onHide() {
    this.setData({ heroAutoplay: false });
  },
  /** 手指按住 / 滑动时暂停自动轮播 */
  pauseHero() {
    if (this.data.heroAutoplay) this.setData({ heroAutoplay: false });
  },
  /** 手指离开后继续自动轮播 */
  resumeHero() {
    if (!this.data.heroAutoplay) this.setData({ heroAutoplay: true });
  },
  onHeroChange(e) {
    this.setData({ heroCurrent: e.detail.current || 0 });
  },
  service(e) {
    const { url, title } = e.currentTarget.dataset;
    if (url) go(url);
    else
      wx.showModal({
        title,
        content:
          "该社区增值服务暂未开放。本次可体验隐患上报、楼栋设备与线上演练。",
        showCancel: false,
      });
  },
  load() {
    return this.fetch(async () => {
      const communities = await repo.communities();
      const s = selection.get();
      const index = Math.max(
        0,
        communities.findIndex((c) => c.id === s.communityId),
      );
      const c = communities[index];
      if (c) selection.set({ communityId: c.id });
      const home = await repo.home(c && c.id);
      this.setData({ communities, communityIndex: index, home });
    });
  },
  community(e) {
    const i = Number(e.detail.value);
    selection.set({
      communityId: this.data.communities[i].id,
      buildingId: "",
      unitId: "",
      floorId: "",
    });
    this.load();
  },
  building(e) {
    selection.set({
      buildingId: e.currentTarget.dataset.id,
      unitId: "",
      floorId: "",
    });
    go("/pages/building/building");
  },
});
