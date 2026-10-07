const selection = require("../../services/selection");
Component({
  properties: {
    value: {
      type: Object,
      value: {},
      observer(value) {
        if (this.readyToLoad) this.load(value);
      },
    },
    disabled: Boolean,
  },
  data: {
    loading: false,
    error: "",
    communities: [],
    buildings: [],
    units: [],
    floors: [],
    selection: {},
  },
  lifetimes: {
    attached() {
      this.readyToLoad = true;
      this.load(this.data.value);
    },
  },
  methods: {
    async load(preferred) {
      this.setData({ loading: true, error: "" });
      try {
        const state = await selection.load(preferred);
        this.setData(state);
        this.triggerEvent("change", state.selection);
      } catch (e) {
        this.setData({ error: e.message });
      } finally {
        this.setData({ loading: false });
      }
    },
    change(e) {
      const level = e.currentTarget.dataset.level;
      const keys = {
        community: ["communities", "communityId"],
        building: ["buildings", "buildingId"],
        unit: ["units", "unitId"],
        floor: ["floors", "floorId"],
      };
      const pair = keys[level];
      const item = this.data[pair[0]][Number(e.detail.value)];
      const next = Object.assign({}, this.data.selection);
      next[pair[1]] = item.id;
      if (level === "community") {
        next.buildingId = "";
        next.unitId = "";
        next.floorId = "";
      }
      if (level === "building") {
        next.unitId = "";
        next.floorId = "";
      }
      if (level === "unit") next.floorId = "";
      this.load(next);
    },
    retry() {
      this.load(this.data.value);
    },
  },
});
