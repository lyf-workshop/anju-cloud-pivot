const { define, requireLogin } = require("../../utils/page"),
  repo = require("../../services/repository"),
  fmt = require("../../services/format");
define({
  data: { record: null, images: [], imageError: "" },
  onLoad(q) {
    this.id = q.id;
  },
  onShow() {
    if (requireLogin()) this.load();
  },
  load() {
    this.setData({ record: null, images: [] });
    return this.fetch(async () => {
      const record = fmt.report(await repo.report(this.id));
      this.setData({ record, images:record.photos || [] });
    });
  },
  async loadImages() {
    this.setData({ imageError: "" });
    try {
      const images = this.data.record.photos || [];
      this.setData({ images });
    } catch (e) {
      this.setData({ imageError: e.message });
    }
  },
  preview(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.path,
      urls: this.data.images,
    });
  },
});
