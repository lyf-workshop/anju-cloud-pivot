const { define, go, requireLogin } = require("../../utils/page"),
  repo = require("../../services/repository"),
  selection = require("../../services/selection"),
  fmt = require("../../services/format");

/** 生成立面楼层（从上到下展示，高层在上） */
function buildIsoFloors(floors, fireMap, currentNumber) {
  const sorted = (floors || []).slice().sort((a, b) => b.number - a.number);
  const must = new Set(
    Object.keys(fireMap || {})
      .map(Number)
      .concat(currentNumber ? [Number(currentNumber)] : []),
  );
  let limited = sorted.slice(0, 12);
  must.forEach((n) => {
    if (!limited.some((f) => f.number === n)) {
      const hit = sorted.find((f) => f.number === n);
      if (hit) limited.push(hit);
    }
  });
  limited = limited.sort((a, b) => b.number - a.number).slice(0, 14);
  return limited.map((f, idx) => {
    const fire = fireMap[f.number];
    return {
      id: f.id,
      number: f.number,
      z: idx,
      hasFire: !!fire,
      fireX: fire ? fire.x : 50,
      fireY: fire ? fire.y : 45,
      fireSize: fire ? fire.size : 36,
    };
  });
}

define({
  data: {
    selection: {},
    preferred: {},
    showLocation: false,
    floorOptions: [12, 10, 8, 6, 1],
    locationText: "请选择楼栋与楼层",
    devices: [],
    active: [],
    isoFloors: [],
    demoFire: false,
    showEquipDots: true,
    // 演示：AI 识别火情落点（楼层号 → 相对位置与火势大小）
    fireMap: {},
  },
  onShow() {
    this.setData({ preferred: selection.get() });
    this.changed({ detail: selection.get() });
    this.load();
  },
  toggleLocation() {
    this.setData({ showLocation: !this.data.showLocation });
  },
  /** 演示开关：模拟 AI 识别后在楼体上标注火情 */
  toggleFire(e) {
    const on = !!(e.detail && e.detail.value);
    const fireMap = on
      ? {
          // 示例：6 层偏东侧中等火势，8 层小火点
          6: { x: 58, y: 36, size: 52 },
          8: { x: 28, y: 42, size: 34 },
        }
      : {};
    this.setData({
      demoFire: on,
      fireMap,
      isoFloors: buildIsoFloors(this.floorItems || [], fireMap, this.data.floorNumber),
    });
  },
  floor(e) {
    const floorNumber = Number(e.currentTarget.dataset.number);
    const floor = (this.floorItems || []).find((f) => f.number === floorNumber);
    if (floor) {
      const chosen = { ...this.data.selection, floorId: floor.id };
      this.setData({ preferred: chosen });
      this.changed({ detail: chosen });
    }
  },
  load() {
    return this.fetch(async () => {
      const r = await repo.drills({ status: "in_progress" });
      this.setData({ active: r.items.map(fmt.drill) });
    });
  },
  changed(e) {
    this.setData({
      selection: e.detail,
      devices: [],
      deviceTotal: 0,
      deviceKnown: false,
    });
    this.fetch(async () => {
      const state = await selection.load(e.detail);
      this.floorItems = state.floors;
      const floorOptions = state.floors
        .map((f) => f.number)
        .filter((n, i, arr) => arr.indexOf(n) === i)
        .sort((a, b) => b - a)
        .filter((n) => [18, 16, 14, 12, 10, 8, 6, 4, 2, 1].includes(n) || n % 2 === 0)
        .slice(0, 6);
      // 保证当前层在侧栏可见
      const currentNo = (state.floors[state.floorIndex] || {}).number;
      if (currentNo && !floorOptions.includes(currentNo)) {
        floorOptions.push(currentNo);
        floorOptions.sort((a, b) => b - a);
      }
      this.setData({
        selection: state.selection,
        floorNumber: currentNo,
        buildingName: (state.buildings[state.buildingIndex] || {}).name,
        unitName: (state.units[state.unitIndex] || {}).name,
        locationText: state.locationText,
        exitText: (state.floors[state.floorIndex] || {}).exitText,
        floorOptions: floorOptions.length ? floorOptions : [12, 10, 8, 6, 1],
        isoFloors: buildIsoFloors(state.floors, this.data.fireMap, currentNo),
      });
      const d = await repo.devices({ floorId: state.selection.floorId });
      this.setData({
        devices: d.items,
        deviceTotal: d.total,
        deviceKnown: true,
        onlineTotal: d.items.filter((x) => x.connectionStatus === "online").length,
        unknownTotal: d.items.filter((x) => x.connectionStatus !== "online").length,
      });
    });
  },
  devices() {
    if (requireLogin())
      go("/pages/devices/devices?floorId=" + this.data.selection.floorId);
  },
  goEscape() {
    const floorId = this.data.selection.floorId || "";
    go(
      "/pages/building-escape/building-escape?floorId=" +
        floorId +
        "&floorNumber=" +
        (this.data.floorNumber || ""),
    );
  },
  goEquipment() {
    const floorId = this.data.selection.floorId || "";
    go(
      "/pages/building-equipment/building-equipment?floorId=" +
        floorId +
        "&floorNumber=" +
        (this.data.floorNumber || ""),
    );
  },
  goEmergency() {
    go("/pages/emergency/emergency");
  },
  goChat() {
    go("/pages/building-chat/building-chat");
  },
  openAi() {
    // AI 能力后续接入；先保留入口与提示
    wx.showModal({
      title: "楼栋 AI 助手",
      content:
        "即将接入：火情识别解读、疏散路径建议、灭火器位置问答。当前为入口占位。",
      showCancel: false,
      confirmText: "知道了",
    });
  },
  start() {
    if (!requireLogin() || !this.data.selection.floorId) return;
    this.task(async () => {
      const r = await repo.createDrill({
        floorId: this.data.selection.floorId,
      });
      go("/pages/drill/drill?id=" + r.id);
    });
  },
  resume(e) {
    go("/pages/drill/drill?id=" + e.currentTarget.dataset.id);
  },
});
