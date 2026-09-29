const { define, requireLogin } = require("../../utils/page"),
  repo = require("../../services/repository");
define({
  data: { nickname: "" },
  onShow() {
    if (requireLogin()) this.load();
  },
  load() {
    return this.fetch(async () =>
      this.setData({ nickname: (await repo.me()).nickname }),
    );
  },
  input(e) {
    this.setData({ nickname: e.detail.value });
  },
  save() {
    this.task(async () => {
      if (!this.data.nickname.trim()) throw new Error("请填写昵称");
      await repo.profile(this.data.nickname);
      await repo.me();
      wx.showToast({ title: "资料已保存" });
    });
  },
});
