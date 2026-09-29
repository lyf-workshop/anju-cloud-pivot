const { define, requireLogin } = require("../../utils/page"),
  repo = require("../../services/repository"),
  selection = require("../../services/selection");
define({
  data: { items: [], room: "", selection: {}, preferred: {} },
  onShow() {
    if (requireLogin()) {
      this.setData({ preferred: selection.get() });
      this.load();
    }
  },
  load() {
    return this.fetch(async () =>
      this.setData({ items: await repo.bindings() }),
    );
  },
  changed(e) {
    this.setData({ selection: e.detail });
  },
  input(e) {
    this.setData({ room: e.detail.value });
  },
  save() {
    this.task(async () => {
      if (!this.data.selection.floorId || !this.data.room.trim())
        throw new Error("请选择楼层并填写房号");
      await repo.bind({
        floorId: this.data.selection.floorId,
        room: this.data.room,
      });
      const user = await repo.me();
      this.setData({ items: user.bindings, room: "" });
      selection.set(this.data.selection);
      wx.showToast({ title: "示例住址已更新", icon: "none" });
    });
  },
  current(e) {
    this.task(async () => {
      const items = await repo.current(e.currentTarget.dataset.id);
      await repo.me();
      const item = items.find((x) => x.isCurrent);
      selection.set(item);
      this.setData({
        items,
        preferred: {
          communityId: item.communityId,
          buildingId: item.buildingId,
          unitId: item.unitId,
          floorId: item.floorId,
        },
      });
      wx.showToast({ title: "已切换当前住址", icon: "none" });
    });
  },
});
