const { define, go } = require("./page");
const repo = require("../services/repository");
const fmt = require("../services/format");
module.exports = (step) =>
  define({
    data: { record: null, step, durationText: "00:00" },
    onLoad(q) {
      this.id = q.id;
    },
    onShow() {
      this.load();
    },
    load() {
      return this.fetch(async () => {
        const record = await repo.drill(this.id);
        if (record.status !== "in_progress") {
          wx.redirectTo({
            url: "/pages/drill-summary/drill-summary?id=" + record.id,
          });
          return;
        }
        // Page progress follows the two display steps; no background sync or resume machinery.
        if (step === "assembly") await repo.confirmStep(this.id, "exit");
        this.setData({
          record,
          durationText: fmt.duration(
            Math.max(0, (Date.now() - Date.parse(record.startedAt)) / 1000),
          ),
        });
      });
    },
    confirm() {
      return this.task(async () => {
        await repo.confirmStep(this.id, step);
        if (step === "exit")
          wx.redirectTo({ url: "/pages/assembly/assembly?id=" + this.id });
        else {
          await repo.complete(this.id);
          wx.redirectTo({
            url: "/pages/drill-summary/drill-summary?id=" + this.id,
          });
        }
      });
    },
    leave() {
      wx.showModal({
        title: "离开本次演练？",
        content: "本次为线上模拟体验，可以从楼栋页面重新开始。",
        confirmText: "离开演练",
        success: (r) => {
          if (r.confirm)
            this.task(async () => {
              await repo.abort(this.id);
              go("/pages/building/building");
            });
        },
      });
    },
  });
