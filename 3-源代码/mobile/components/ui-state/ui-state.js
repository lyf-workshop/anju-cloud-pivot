Component({
  properties: {
    loading: Boolean,
    error: String,
    empty: Boolean,
    text: { type: String, value: "暂无记录" },
    compact: Boolean,
  },
  methods: {
    retry() {
      this.triggerEvent("retry");
    },
    login() {
      wx.navigateTo({ url: "/pages/login/login" });
    },
  },
});
