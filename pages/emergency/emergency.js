const { define } = require("../../utils/page");
const repo = require("../../services/repository");
define({
  data: { config: null, address: "", manual: "", callMessage: "" },
  onShow() {
    this.load();
  },
  load() {
    return this.fetch(async () => {
      const [config, user] = await Promise.all([repo.config(), repo.me()]);
      const address = user.bindings.find((b) => b.isCurrent);
      this.setData({ config, address: address ? address.address : "" });
    });
  },
  input(e) {
    this.setData({ manual: e.detail.value });
  },
  copy() {
    const data = this.data.manual.trim() || this.data.address;
    if (!data) return;
    wx.setClipboardData({
      data,
      success: () => wx.showToast({ title: "示例住址已复制", icon: "none" }),
      fail: () => this.setData({ error: "复制失败，请重试" }),
    });
  },
  call(e) {
    const property = e.currentTarget.dataset.kind === "property";
    wx.showModal({
      title: property ? "物业联系演示" : "消防电话演示",
      content: property
        ? "这里展示联系物业的确认流程，号码为示例，不会实际拨打。"
        : "这里展示拨打119的确认流程，当前演示不会实际拨打电话。",
      confirmText: "知道了",
      showCancel: false,
      success: () =>
        this.setData({ callMessage: "已完成联系流程演示，未拨打任何电话" }),
    });
  },
});
