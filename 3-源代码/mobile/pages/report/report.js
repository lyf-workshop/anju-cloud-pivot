const { define, requireLogin } = require("../../utils/page");
const repo = require("../../services/repository");
const fmt = require("../../services/format");
const selection = require("../../services/selection");
const session = require("../../services/session");
const hazardTypes = require("../../services/hazard-types");
const connected = require("../../config/index").mode !== "showcase";

function draftView(data) {
  return {
    form: data.form,
    photos: data.photos,
    preferred: data.preferred,
    categoryId: data.categoryId,
    categoryName: data.categoryName,
    typeItems: data.typeItems,
    revealOn: data.revealOn,
    hazardId: data.hazardId,
    hazardName: data.hazardName,
    isCustom: data.isCustom,
    customName: data.customName,
  };
}

define({
  data: {
    categories: hazardTypes.categories,
    categoryId: "",
    categoryName: "",
    typeItems: [],
    revealOn: false,
    tapCatId: "",
    tapHazardId: "",
    hazardId: "",
    hazardName: "",
    isCustom: false,
    customName: "",
    form: {
      type: "other",
      floorId: "",
      location: "",
      description: "",
      contact: "",
      hazardId: "",
      hazardName: "",
      categoryId: "",
    },
    photos: [],
    preferred: {},
    showLocation: false,
    keyboardOpen: false,
    locationText: "",
  },
  onLoad(q) {
    const assistDraft =
      q.from === "assist"
        ? wx.getStorageSync(session.privateKey("assist-draft"))
        : null;
    if (assistDraft && assistDraft.description) {
      const preferred = { ...selection.get() };
      this.setData({
        preferred,
        "form.floorId": preferred.floorId || "",
        "form.type": assistDraft.type || "other",
        "form.location": assistDraft.location || "",
        "form.description": assistDraft.description,
        "form.hazardName": assistDraft.hazardName || "",
        hazardName: assistDraft.hazardName || "",
      });
      if (connected) this.setData({ "form.idempotencyKey": fmt.uid() });
      this.location({ detail: preferred });
      return;
    }
    if (connected) {
      const draft = wx.getStorageSync(session.privateKey("report-draft"));
      if (draft && !q.deviceId) {
        this.setData(draft);
        this.location({
          detail: { ...selection.get(), floorId: draft.form.floorId },
        });
        if (q.camera === "1" && !(draft.photos || []).length)
          setTimeout(() => this.chooseSource(), 350);
        return;
      }
      this.setData({ "form.idempotencyKey": fmt.uid() });
    }

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
      });
    this.location({ detail: preferred });
    if (q.camera === "1") setTimeout(() => this.chooseSource(), 350);
  },
  onShow() {
    if (connected) requireLogin();
  },
  onHide() {
    this.saveDraft();
  },
  saveDraft() {
    if (connected && !this.submitted)
      wx.setStorageSync(
        session.privateKey("report-draft"),
        draftView(this.data),
      );
  },
  toggleLocation() {
    this.setData({ showLocation: !this.data.showLocation });
  },
  keyboard(e) {
    this.setData({ keyboardOpen: e.detail.height > 0 });
  },
  input(e) {
    if (!this.data.busy)
      this.setData({
        ["form." + e.currentTarget.dataset.field]: e.detail.value,
      });
    this.saveDraft();
  },
  customInput(e) {
    if (this.data.busy) return;
    const customName = e.detail.value;
    this.setData({
      customName,
      hazardName: customName.trim() || "自己补充",
      "form.hazardName": customName.trim(),
    });
    this.saveDraft();
  },
  pickCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    const cat = hazardTypes.categories.find((item) => item.id === categoryId);
    if (!cat) return;
    if (this.data.categoryId === categoryId) {
      this.setData({
        categoryId: "",
        categoryName: "",
        typeItems: [],
        revealOn: false,
        hazardId: "",
        hazardName: "",
        isCustom: false,
        customName: "",
        "form.categoryId": "",
        "form.hazardId": "",
        "form.hazardName": "",
        tapCatId: categoryId,
      });
      this.saveDraft();
      setTimeout(() => this.setData({ tapCatId: "" }), 320);
      return;
    }
    this.setData({
      categoryId,
      categoryName: cat.name,
      typeItems: cat.items,
      revealOn: false,
      hazardId: "",
      hazardName: "",
      isCustom: false,
      customName: "",
      tapCatId: categoryId,
      "form.categoryId": categoryId,
      "form.type": cat.legacyType,
      "form.hazardId": "",
      "form.hazardName": "",
    });
    this.saveDraft();
    setTimeout(() => this.setData({ revealOn: true, tapCatId: "" }), 30);
  },
  pickHazard(e) {
    const hazardId = e.currentTarget.dataset.id;
    const hit = hazardTypes.findItem(hazardId);
    if (!hit) return;
    const isCustom = !!hit.item.custom;
    this.setData({
      hazardId,
      hazardName: hit.item.name,
      isCustom,
      customName: isCustom ? this.data.customName : "",
      categoryId: hit.category.id,
      categoryName: hit.category.name,
      tapHazardId: hazardId,
      "form.hazardId": hazardId,
      "form.hazardName": isCustom ? this.data.customName.trim() : hit.item.name,
      "form.type": hit.category.legacyType,
      "form.categoryId": hit.category.id,
    });
    this.saveDraft();
    setTimeout(() => this.setData({ tapHazardId: "" }), 340);
  },
  location(e) {
    this.setData({ "form.floorId": e.detail.floorId });
    selection
      .load(e.detail)
      .then((state) => {
        this.setData({
          locationText: state.locationText,
          "form.floorId": state.selection.floorId,
        });
        this.saveDraft();
      })
      .catch((error) => this.setData({ error: error.message }));
  },
  chooseSource() {
    if (this.data.busy || this.choosing || this.data.photos.length >= 3) {
      if (this.data.photos.length >= 3)
        wx.showToast({ title: "最多3张照片", icon: "none" });
      return;
    }
    wx.showActionSheet({
      itemList: ["拍照", "从相册选择"],
      success: (res) =>
        this.choose(res.tapIndex === 0 ? ["camera"] : ["album"]),
    });
  },
  async choose(sourceType) {
    if (this.data.busy || this.choosing || this.data.photos.length >= 3) return;
    this.choosing = true;
    try {
      const result = await new Promise((resolve, reject) =>
        wx.chooseMedia({
          count: 3 - this.data.photos.length,
          mediaType: ["image"],
          sourceType: sourceType || ["album", "camera"],
          success: resolve,
          fail: reject,
        }),
      );
      if (result.tempFiles.some((file) => file.size > 5 * 1024 * 1024))
        throw new Error("请选用不超过5MB的图片");
      this.setData({
        photos: this.data.photos
          .concat(result.tempFiles.map((file) => ({ path: file.tempFilePath })))
          .slice(0, 3),
        error: "",
      });
      this.saveDraft();
    } catch (error) {
      if (!(error.errMsg || "").includes("cancel"))
        this.setData({
          error:
            error.message ||
            "未能选择图片，请检查相册/相机权限。也可以先选类型再补照片。",
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
    this.saveDraft();
  },
  preview(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.path,
      urls: this.data.photos.map((photo) => photo.path),
    });
  },
  submit() {
    return this.task(async () => {
      if (!this.data.photos.length)
        throw new Error("请先拍摄或选择至少一张现场照片");
      if (!this.data.hazardId) throw new Error("请选择隐患类型");
      let hazardName = this.data.hazardName;
      if (this.data.isCustom) {
        hazardName = (this.data.customName || "").trim();
        if (hazardName.length < 2)
          throw new Error("请填写自定义隐患名称（至少2个字）");
      }
      this.saveDraft();
      const record = await repo.createReport({
        ...this.data.form,
        hazardId: this.data.hazardId,
        hazardName,
        title: hazardName,
        categoryId: this.data.categoryId,
        photos: this.data.photos.map((photo) => photo.path),
      });
      this.submitted = true;
      if (connected) wx.removeStorageSync(session.privateKey("report-draft"));
      wx.redirectTo({
        url: "/pages/report-result/report-result?id=" + record.id,
      });
    });
  },
  retry() {
    this.setData({ error: "" });
  },
});
