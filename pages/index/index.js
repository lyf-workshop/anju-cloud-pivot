const { define, go } = require("../../utils/page"),
  repo = require("../../services/repository"),
  selection = require("../../services/selection");
define({
  data: {
    home: null,
    communities: [],
    communityIndex: 0,
    services: [
      {
        icon: "hazard-active",
        title: "隐患上报",
        note: "发现问题，随手上报",
        url: "/pages/report/report",
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
      {icon:'book',title:'物业缴费',url:''},
      {icon:'calendar',title:'社区活动',url:''},
    ],
  },
  onShow() {
    this.load();
  },
  service(e) {
    const {url,title}=e.currentTarget.dataset;
    if(url)go(url);else wx.showModal({title,content:'该社区增值服务暂未开放。本次可体验隐患上报、楼栋设备与线上演练。',showCancel:false});
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
