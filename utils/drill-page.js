const { define, go } = require("./page");
const repo = require("../services/repository");
const fmt = require("../services/format");
const connected = require("../config/index").mode !== "showcase";
const clock = connected ? require("../services/drill-clock") : null;
module.exports = (step) =>
  define({
    data: { record: null, step, durationText: "00:00" },
    onLoad(q) {
      this.id = q.id;
    },
    onShow() {
      this.load();
    },
    onHide() {
      if (clock && clock.load(this.id)) {
        clock.pause();
        if (clock.load(this.id).status === "in_progress") repo.progress(this.id, clock.payload(this.id)).catch(e => this.setData({error: e.message}));
      }
    },
    onUnload() { if (clock) clock.reset(); },
    load() {
      return this.fetch(async () => {
        const record = await repo.drill(this.id);
        if (record.status !== "in_progress") {
          wx.redirectTo({
            url: "/pages/drill-summary/drill-summary?id=" + record.id,
          });
          return;
        }
        if (step === "assembly" && !record.completedSteps.some(s => (s.id || s) === "exit")) {
          wx.redirectTo({ url: "/pages/drill/drill?id=" + this.id });
          return;
        }
        if (clock) { clock.importRecord(record); clock.start(this.id); }
        this.setData({
          record,
          durationText: fmt.duration(
            clock ? clock.payload(this.id).durationMs / 1000 : Math.max(0, (Date.now() - Date.parse(record.startedAt)) / 1000),
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
        content: "确认后中止本次线上演练。记录将保留，可从楼栋页面开始新演练。",
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
