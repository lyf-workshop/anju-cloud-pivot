const { define } = require("../../utils/page");
const repo = require("../../services/repository");
const fmt = require("../../services/format");
const selection = require("../../services/selection");
define({
  data: {
    types: fmt.types,
    typeIndex: 0,
    form: {
      type: "fire",
      floorId: "",
      location: "",
      description: "",
      contact: "",
    },
    photos: [],
    preferred: {},
    showLocation: false,
    keyboardOpen: false,
    locationText: '',
  },
  onLoad(q) {
    const preferred = { ...selection.get() };
    if (q.floorId) preferred.floorId = q.floorId;
    let location = q.location || "";
    try {
      location = decodeURIComponent(location);
    } catch (_) {}
    this.setData({
      preferred,
      "form.floorId": preferred.floorId,
      "form.location": location,
    });
    if (q.deviceId)
      this.setData({
        "form.deviceId": q.deviceId,
        "form.type": "equipment",
        typeIndex: 2,
      });
    this.location({detail:preferred});
  },
  toggleLocation(){this.setData({showLocation:!this.data.showLocation})},
  keyboard(e){this.setData({keyboardOpen:e.detail.height>0})},
  input(e) {
    if (!this.data.busy)
      this.setData({
        ["form." + e.currentTarget.dataset.field]: e.detail.value,
      });
  },
  type(e) {
    const typeIndex = Number(e.currentTarget.dataset.index === undefined ? e.detail.value : e.currentTarget.dataset.index);
    this.setData({ typeIndex, "form.type": fmt.types[typeIndex].id });
  },
  location(e) {
    this.setData({ "form.floorId": e.detail.floorId });
    selection.load(e.detail).then(s=>this.setData({locationText:s.locationText,'form.floorId':s.selection.floorId}));
  },
  async choose() {
    if (this.data.busy || this.choosing || this.data.photos.length >= 3) return;
    this.choosing = true;
    try {
      const result = await new Promise((resolve, reject) =>
        wx.chooseMedia({
          count: 3 - this.data.photos.length,
          mediaType: ["image"],
          sourceType: ["album", "camera"],
          success: resolve,
          fail: reject,
        }),
      );
      if (result.tempFiles.some((f) => f.size > 5 * 1024 * 1024))
        throw new Error("请选用不超过5MB的图片");
      this.setData({
        photos: this.data.photos
          .concat(result.tempFiles.map((f) => ({ path: f.tempFilePath })))
          .slice(0, 3),
        error: "",
      });
    } catch (e) {
      if (!(e.errMsg || "").includes("cancel"))
        this.setData({
          error:
            e.message ||
            "未能选择图片，请检查相册权限。也可以不加图片继续演示。",
        });
    } finally {
      this.choosing = false;
    }
  },
  remove(e) {
    if (this.data.busy) return;
    const photos = this.data.photos.slice();
    photos.splice(e.currentTarget.dataset.index, 1);
    this.setData({ photos });
  },
  preview(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.path,
      urls: this.data.photos.map((p) => p.path),
    });
  },
  submit() {
    return this.task(async () => {
      const record = await repo.createReport({
        ...this.data.form,
        photos: this.data.photos.map((p) => p.path),
      });
      wx.redirectTo({
        url: "/pages/report-result/report-result?id=" + record.id,
      });
    });
  },
  retry() {
    this.setData({ error: "" });
  },
});
