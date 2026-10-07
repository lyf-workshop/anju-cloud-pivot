const { define } = require("../../utils/page");
const repo = require("../../services/repository");
const fmt = require("../../services/format");
define({
  data: { record: null },
  onLoad(q) {
    this.id = q.id;
  },
  onShow() {
    this.load();
  },
  load() {
    return this.fetch(async () =>
      this.setData({ record: fmt.drill(await repo.drill(this.id)) }),
    );
  },
  again() {
    return this.task(async () => {
      const record = await repo.createDrill({
        floorId: this.data.record.snapshot.floorId,
      });
      wx.redirectTo({ url: "/pages/drill/drill?id=" + record.id });
    });
  },
});
