const { define } = require("../../utils/page"),
  repo = require("../../services/repository");
define({
  data: {
    agreed: false,
    config: null,
    windows: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  onLoad() {
    this.load();
  },
  load() {
    return this.fetch(async () =>
      this.setData({ config: await repo.config() }),
    );
  },
  agree(e) {
    this.setData({ agreed: e.detail.value.includes("yes") });
  },
  submit() {
    if (!this.data.agreed || !this.data.config || this.data.busy) return;
    this.task(async () => {
      await repo.login(this.data.agreed, this.data.config.legalVersion);
      wx.switchTab({ url: "/pages/index/index" });
    });
  },
});
