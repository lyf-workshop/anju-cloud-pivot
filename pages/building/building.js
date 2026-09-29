const { define, go, requireLogin } = require("../../utils/page"),
  repo = require("../../services/repository"),
  selection = require("../../services/selection"),
  fmt = require("../../services/format");
define({
  data: {
    selection: {},
    preferred: {},
    showLocation: false,
    floorOptions: [12,10,8,6,1],
    locationText: "请选择楼栋与楼层",
    devices: [],
    active: [],
    windows: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  onShow() {
    this.setData({ preferred: selection.get() });
    this.changed({detail:selection.get()});
    this.load();
  },
  toggleLocation(){this.setData({showLocation:!this.data.showLocation})},
  floor(e){const floorNumber=Number(e.currentTarget.dataset.number);const floor=this.floorItems.find(f=>f.number===floorNumber);if(floor){const chosen={...this.data.selection,floorId:floor.id};this.setData({preferred:chosen});this.changed({detail:chosen})}},
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
      this.floorItems=state.floors;
      this.setData({
        selection:state.selection,
        floorNumber:(state.floors[state.floorIndex]||{}).number,
        buildingName:(state.buildings[state.buildingIndex]||{}).name,
        unitName:(state.units[state.unitIndex]||{}).name,
        locationText: state.locationText,
        exitText: (state.floors[state.floorIndex] || {}).exitText,
      });
      const d = await repo.devices({ floorId: state.selection.floorId });
      this.setData({
        devices: d.items,
        deviceTotal: d.total,
        deviceKnown: true,
        onlineTotal:d.items.filter(x=>x.connectionStatus==='online').length,
        unknownTotal:d.items.filter(x=>x.connectionStatus!=='online').length,
      });
    });
  },
  devices() {
    if (requireLogin())
      go("/pages/devices/devices?floorId=" + this.data.selection.floorId);
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
