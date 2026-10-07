Component({
  data: {
    selected: 0,
    jellyIndex: -1,
    list: [
      {
        pagePath: "/pages/index/index",
        text: "首页",
        iconPath: "/assets/icons/home.png",
        selectedIconPath: "/assets/icons/home-active.png",
      },
      {
        pagePath: "/pages/hazards/hazards",
        text: "隐患",
        iconPath: "/assets/icons/hazard.png",
        selectedIconPath: "/assets/icons/hazard-active.png",
      },
      {
        pagePath: "/pages/assist/assist",
        text: "助手",
        iconPath: "/assets/icons/assist-white.png",
        selectedIconPath: "/assets/icons/assist-white.png",
      },
      {
        pagePath: "/pages/building/building",
        text: "楼栋",
        iconPath: "/assets/icons/cube.png",
        selectedIconPath: "/assets/icons/cube-active.png",
      },
      {
        pagePath: "/pages/me/me",
        text: "我的",
        iconPath: "/assets/icons/user.png",
        selectedIconPath: "/assets/icons/user-active.png",
      },
    ],
  },
  methods: {
    switchTab(e) {
      const { path, index } = e.currentTarget.dataset;
      this.setData({ jellyIndex: index, selected: index });
      wx.switchTab({ url: path });
      setTimeout(() => {
        if (this.data.jellyIndex === index) this.setData({ jellyIndex: -1 });
      }, 480);
    },
  },
});
