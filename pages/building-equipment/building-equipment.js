const { define } = require("../../utils/page");

define({
  data: {
    floorNumber: "",
    floorId: "",
    mapSrc: "/assets/illustrations/equip-location-map.png",
    previewUrls: [
      "/assets/illustrations/guide-extinguisher.png",
      "/assets/illustrations/guide-hydrant.png",
      "/assets/illustrations/guide-blanket.png",
    ],
  },
  onLoad(query) {
    this.setData({
      floorNumber: query.floorNumber || "",
      floorId: query.floorId || "",
    });
  },
  previewMap() {
    wx.previewImage({
      current: this.data.mapSrc,
      urls: [this.data.mapSrc],
    });
  },
  preview(e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({
      current: src,
      urls: this.data.previewUrls,
    });
  },
  back() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: "/pages/building/building" }) });
  },
});
