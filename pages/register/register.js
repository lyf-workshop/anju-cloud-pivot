const { define, requireLogin } = require("../../utils/page"),
  repo = require("../../services/repository"),
  selection = require("../../services/selection"),
  onboarding = require("../../services/onboarding");

function peopleView(elderly, children, pets) {
  return [
    {
      key: "elderly",
      label: "老人",
      icon: "/assets/illustrations/icon-elderly.png",
      count: elderly,
    },
    {
      key: "children",
      label: "小孩",
      icon: "/assets/illustrations/icon-children.png",
      count: children,
    },
    {
      key: "pets",
      label: "宠物",
      icon: "/assets/illustrations/icon-pets.png",
      count: pets,
    },
  ];
}

function formState(data) {
  const room = String(data.room || "").trim();
  const familyCount = Number(data.familyCount);
  const unitPicked = !!data.unitPicked && data.unitIndex >= 0;
  const floorPicked = !!data.floorPicked && data.floorIndex >= 0;
  const familyOk = Number.isFinite(familyCount) && familyCount >= 1;
  return {
    unitPicked,
    floorPicked,
    roomOk: !!room,
    familyOk,
    canNext: unitPicked && floorPicked && !!room && familyOk,
  };
}

function validateStep1(data) {
  const errors = {};
  if (!data.unitPicked || data.unitIndex < 0) errors.unit = "请选择单元";
  if (!data.floorPicked || data.floorIndex < 0) errors.floor = "请选择层数";
  if (!String(data.room || "").trim()) errors.room = "请输入房间号";
  const familyCount = Number(data.familyCount);
  if (!Number.isFinite(familyCount) || familyCount < 1)
    errors.familyCount = "请输入家庭人数";
  return errors;
}

define({
  data: {
    editing: false,
    step: 1,
    buildingId: "",
    units: [],
    floors: [],
    unitLabels: [],
    floorLabels: [],
    unitIndex: -1,
    floorIndex: -1,
    unitPicked: false,
    floorPicked: false,
    room: "",
    familyCount: "",
    canNext: false,
    fieldErrors: {},
    // 第二步默认均为选填：计数器默认 0，特殊情况默认不勾选
    elderly: 0,
    children: 0,
    pets: 0,
    people: peopleView(0, 0, 0),
    situationOptions: [],
    situations: [],
    // 隐私告知弹窗显隐（仅第二步首次进入时为 true）
    showPrivacy: false,
  },
  onLoad(query) {
    this.editing = query && query.mode === "edit";
    // 本页生命周期内只弹一次；刷新 / 重新进入页面后会重置
    this._privacyAcked = false;
    this.setData({ editing: !!this.editing, showPrivacy: false });
    if (this.editing) wx.setNavigationBarTitle({ title: "编辑资料" });
  },
  onShow() {
    if (requireLogin()) this.load();
  },
  noop() {},
  goHome() {
    wx.switchTab({ url: "/pages/index/index" });
  },
  // 关闭隐私弹窗，允许继续填写第二步
  ackPrivacy() {
    this._privacyAcked = true;
    this.setData({ showPrivacy: false });
  },
  // 进入第二步时：若本页尚未确认过隐私说明，则立刻弹出
  openStep2() {
    const showPrivacy = !this._privacyAcked;
    this.setData({
      step: 2,
      error: "",
      fieldErrors: {},
      showPrivacy,
    });
  },
  syncForm(patch) {
    const next = Object.assign({}, this.data, patch || {});
    const state = formState(next);
    this.setData(
      Object.assign({}, patch || {}, {
        canNext: state.canNext,
      }),
    );
  },
  clearFieldError(key) {
    if (!this.data.fieldErrors[key]) return;
    const fieldErrors = Object.assign({}, this.data.fieldErrors);
    delete fieldErrors[key];
    this.setData({ fieldErrors });
  },
  load() {
    return this.fetch(async () => {
      const [catalog, options, user] = await Promise.all([
        selection.load(),
        repo.householdOptions(),
        repo.me(),
      ]);
      const household = user.household || {};
      const preferred = household.floorId
        ? {
            communityId: household.communityId,
            buildingId: household.buildingId,
            unitId: household.unitId,
            floorId: household.floorId,
          }
        : catalog.selection;
      const loaded = await selection.load(preferred);
      const elderly = Number(household.elderly || 0);
      const children = Number(household.children || 0);
      const pets = Number(household.pets || 0);
      const situations = household.situations || [];
      const hasHousehold = !!household.floorId;
      const unitIndex = hasHousehold ? Math.max(0, loaded.unitIndex) : -1;
      const floorIndex = hasHousehold ? Math.max(0, loaded.floorIndex) : -1;
      const patch = {
        buildingId: loaded.selection.buildingId,
        units: loaded.units,
        floors: loaded.floors,
        unitLabels: loaded.units.map((u) => u.name),
        floorLabels: loaded.floors.map((f) => `${f.number}层`),
        unitIndex,
        floorIndex,
        unitPicked: hasHousehold,
        floorPicked: hasHousehold,
        room: (household.room || "").replace(/室$/, ""),
        familyCount: household.familyCount ? String(household.familyCount) : "",
        elderly,
        children,
        pets,
        people: peopleView(elderly, children, pets),
        situations,
        situationOptions: options.map((item) => ({
          ...item,
          selected: situations.includes(item.id),
        })),
        step: 1,
        fieldErrors: {},
        error: "",
        showPrivacy: false,
      };
      const state = formState(patch);
      this.setData(Object.assign(patch, { canNext: state.canNext }));
    });
  },
  async refreshFloors(unitIndex) {
    const unit = this.data.units[unitIndex];
    if (!unit) return;
    const detail = await repo.building(this.data.buildingId);
    const match = detail.units.find((u) => u.id === unit.id) || unit;
    const floors = match.floors || [];
    selection.set({
      buildingId: this.data.buildingId,
      unitId: unit.id,
      floorId: "",
    });
    const patch = {
      unitIndex,
      unitPicked: true,
      floors,
      floorLabels: floors.map((f) => `${f.number}层`),
      floorIndex: -1,
      floorPicked: false,
    };
    this.syncForm(patch);
    this.clearFieldError("unit");
    this.clearFieldError("floor");
  },
  pickUnit(e) {
    const unitIndex = Number(e.detail.value);
    this.task(async () => this.refreshFloors(unitIndex));
  },
  pickFloor(e) {
    const floorIndex = Number(e.detail.value);
    const floor = this.data.floors[floorIndex];
    if (floor) selection.set({ floorId: floor.id });
    this.syncForm({ floorIndex, floorPicked: true });
    this.clearFieldError("floor");
  },
  inputRoom(e) {
    this.syncForm({ room: e.detail.value });
    if (String(e.detail.value || "").trim()) this.clearFieldError("room");
  },
  inputFamily(e) {
    this.syncForm({ familyCount: e.detail.value });
    const n = Number(e.detail.value);
    if (Number.isFinite(n) && n >= 1) this.clearFieldError("familyCount");
  },
  next() {
    if (this.data.busy) return;
    const fieldErrors = validateStep1(this.data);
    if (Object.keys(fieldErrors).length) {
      this.setData({ fieldErrors, canNext: false });
      return;
    }
    const unit = this.data.units[this.data.unitIndex];
    const floor = this.data.floors[this.data.floorIndex];
    selection.set({ unitId: unit.id, floorId: floor.id });
    this.openStep2();
  },
  back() {
    this.setData({ step: 1, error: "", showPrivacy: false });
  },
  adjust(e) {
    const key = e.currentTarget.dataset.key;
    const delta = Number(e.currentTarget.dataset.delta);
    const next = Math.max(0, Number(this.data[key] || 0) + delta);
    const patch = { [key]: next };
    const elderly = key === "elderly" ? next : this.data.elderly;
    const children = key === "children" ? next : this.data.children;
    const pets = key === "pets" ? next : this.data.pets;
    patch.people = peopleView(elderly, children, pets);
    this.setData(patch);
  },
  toggleSituation(e) {
    const id = e.currentTarget.dataset.id;
    let situations = this.data.situations.slice();
    if (situations.includes(id)) situations = situations.filter((x) => x !== id);
    else situations.push(id);
    this.setData({
      situations,
      situationOptions: this.data.situationOptions.map((item) => ({
        ...item,
        selected: situations.includes(item.id),
      })),
    });
  },
  // 统一提交：skip=true 时清空第二步全部选填数据后再保存
  submitStep2(skip) {
    this.task(async () => {
      const unit = this.data.units[this.data.unitIndex];
      const floor = this.data.floors[this.data.floorIndex];
      if (!unit || !floor) throw new Error("请先完成住址选择");

      const elderly = skip ? 0 : Number(this.data.elderly || 0);
      const children = skip ? 0 : Number(this.data.children || 0);
      const pets = skip ? 0 : Number(this.data.pets || 0);
      const situations = skip ? [] : this.data.situations || [];

      // 跳过时同步清空页面展示，避免用户误以为仍已勾选
      if (skip) {
        this.setData({
          elderly: 0,
          children: 0,
          pets: 0,
          people: peopleView(0, 0, 0),
          situations: [],
          situationOptions: this.data.situationOptions.map((item) => ({
            ...item,
            selected: false,
          })),
        });
      }

      await repo.saveHousehold({
        floorId: floor.id,
        room: this.data.room,
        familyCount: this.data.familyCount,
        elderly,
        children,
        pets,
        situations,
      });
      onboarding.complete();
      selection.set({
        buildingId: this.data.buildingId,
        unitId: unit.id,
        floorId: floor.id,
      });

      wx.showToast({ title: skip ? "已跳过并完成登记" : "资料已保存", icon: "success" });
      setTimeout(() => {
        // 提交成功后进入登记完成页；编辑模式返回上一页
        if (this.data.editing) {
          wx.navigateBack({
            fail: () =>
              wx.redirectTo({ url: "/pages/register-done/register-done" }),
          });
        } else {
          wx.redirectTo({ url: "/pages/register-done/register-done" });
        }
      }, 400);
    });
  },
  // 保存：保留用户已填内容（含全空 / 部分填写），不做第二步必填校验
  save() {
    this.submitStep2(false);
  },
  // 跳过：不收集本页选填数据，直接完成登记
  skip() {
    this.submitStep2(true);
  },
});
