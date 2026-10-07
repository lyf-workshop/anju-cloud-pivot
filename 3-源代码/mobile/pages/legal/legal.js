const { define } = require("../../utils/page"),
  repo = require("../../services/repository");
define({
  data: { text: "", version: "" },
  onLoad(q) {
    this.type = q.type === "privacy" ? "privacy" : "terms";
    wx.setNavigationBarTitle({
      title: this.type === "privacy" ? "隐私说明" : "使用说明",
    });
    this.load();
  },
  load() {
    return this.fetch(async () => {
      const c = await repo.config();
      this.setData({
        text: c[this.type],
        version: c.legalVersion,
      });
    });
  },
});
