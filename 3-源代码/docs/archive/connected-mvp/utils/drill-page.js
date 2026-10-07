const { define, go, requireLogin } = require("./page"),
  repo = require("../services/repository"),
  clock = require("../services/drill-clock"),
  fmt = require("../services/format");
module.exports = function (step) {
  define({
    data: { record: null, durationText: "00:00", step },
    onLoad(q) {
      this.id = q.id;
    },
    onShow() {
      this.visible = true;
      if (requireLogin()) this.load();
    },
    load() {
      return this.fetch(async () => {
        const local = clock.load(this.id);
        if (local && local.pendingAction) {
          wx.redirectTo({
            url: "/pages/drill-summary/drill-summary?id=" + this.id,
          });
          return;
        }
        let r;
        try {
          r = await repo.drill(this.id);
          clock.importRecord(r);
        } catch (e) {
          if (!local || e.status === 401 || e.status === 404) throw e;
          r = local;
          this.setData({ error: "进度暂未同步，可继续查看；联网后重试保存" });
        }
        const item = clock.load(this.id);
        if (item.status !== "in_progress") {
          wx.redirectTo({
            url: "/pages/drill-summary/drill-summary?id=" + this.id,
          });
          return;
        }
        if (step === "assembly" && !item.completedSteps.includes("exit")) {
          wx.redirectTo({ url: "/pages/drill/drill?id=" + this.id });
          return;
        }
        this.setData({
          record: item,
          durationText: fmt.duration(item.durationMs / 1000),
        });
        if (this.visible) {
          clock.start(this.id);
          if (this.ticker) clearInterval(this.ticker);
          if (wx.enableAlertBeforeUnload)
            wx.enableAlertBeforeUnload({
              message: "离开将暂停本次演练，进度保留，可在楼栋页继续。",
              fail() {},
            });
          this.ticker = setInterval(() => {
            const current = clock.load(this.id);
            if (current)
              this.setData({
                durationText: fmt.duration(current.durationMs / 1000),
              });
          }, 1000);
        }
      });
    },
    hide() {
      this.visible = false;
      clock.reset();
      if (this.ticker) clearInterval(this.ticker);
      this.ticker = null;
      if (this.id && clock.load(this.id) && !clock.load(this.id).pendingAction)
        clock.sync(this.id).catch(() => {});
    },
    onHide() {
      this.hide();
    },
    onUnload() {
      this.hide();
    },
    confirm() {
      this.task(async () => {
        clock.confirm(this.id, step);
        if (step === "exit") {
          await clock.sync(this.id);
          if (wx.disableAlertBeforeUnload)
            wx.disableAlertBeforeUnload({ fail() {} });
          wx.redirectTo({ url: "/pages/assembly/assembly?id=" + this.id });
        } else {
          clock.pending(this.id, "complete");
          if (wx.disableAlertBeforeUnload)
            wx.disableAlertBeforeUnload({ fail() {} });
          wx.redirectTo({
            url: "/pages/drill-summary/drill-summary?id=" + this.id,
          });
        }
      });
    },
    leave() {
      wx.showModal({
        title: "暂停本次演练？",
        content: "暂停后停止累计时长，已确认步骤保留，可从楼栋或演练记录继续。",
        confirmText: "保存并离开",
        success: (r) => {
          if (r.confirm) {
            clock.reset();
            if (wx.disableAlertBeforeUnload)
              wx.disableAlertBeforeUnload({ fail() {} });
            go("/pages/building/building");
          }
        },
      });
    },
    abort() {
      wx.showModal({
        title: "中止本次演练？",
        content: "将保存为已中止，不计入完成次数；之后可创建新的演练。",
        confirmText: "确认中止",
        success: (r) => {
          if (r.confirm) {
            clock.pending(this.id, "abort");
            if (wx.disableAlertBeforeUnload)
              wx.disableAlertBeforeUnload({ fail() {} });
            wx.redirectTo({
              url: "/pages/drill-summary/drill-summary?id=" + this.id,
            });
          }
        },
      });
    },
  });
};
