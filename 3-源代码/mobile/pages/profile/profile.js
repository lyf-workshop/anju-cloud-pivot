const { define, requireLogin, go } = require("../../utils/page"),
  repo = require("../../services/repository");

define({
  data: {
    nickname: "",
    household: null,
    situationLabels: [],
  },
  onShow() {
    if (requireLogin()) this.load();
  },
  load() {
    return this.fetch(async () => {
      const [user, options] = await Promise.all([
        repo.me(),
        repo.householdOptions(),
      ]);
      const household = user.household || null;
      const map = Object.fromEntries(options.map((o) => [o.id, o.label]));
      this.setData({
        nickname: user.nickname || "",
        household,
        situationLabels: household
          ? (household.situations || []).map((id) => map[id] || id)
          : [],
      });
    });
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
  editHousehold() {
    go("/pages/register/register?mode=edit");
  },
});
