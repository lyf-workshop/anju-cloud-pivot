const { define } = require("../../utils/page");

define({
  data: { floorNumber: "", floorId: "" },
  onLoad(query) {
    this.setData({
      floorNumber: query.floorNumber || "",
      floorId: query.floorId || "",
    });
  },
  preview() {
    wx.previewImage({
      urls: ["/assets/illustrations/guide-escape-plan.png"],
    });
  },
  back() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: "/pages/building/building" }) });
  },
});
