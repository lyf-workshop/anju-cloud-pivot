const { define, go } = require("../../utils/page"),
  repo = require("../../services/repository"),
  fmt = require("../../services/format"),
  selection = require("../../services/selection");
define({
  data: {
    items: [],
    status: "",
    page: 1,
    total: 0,
    filters: [
      { id: "", name: "全部" },
      { id: "pending", name: "待处理" },
      { id: "processing", name: "处理中" },
      { id: "completed", name: "已完成" },
    ],
  },
  onShow() {
    this.load();
  },
  load() {
    return this.fetch(async () => {
      const r = await repo.reports(false, {
        status: this.data.status,
        communityId: selection.get().communityId,
        page: 1,
      });
      this.setData({ items: r.items.map(fmt.report), total: r.total, page: 1 });
    });
  },
  filter(e) {
    this.setData({ status: e.currentTarget.dataset.id });
    this.load();
  },
  more() {
    this.task(async () => {
      const page = this.data.page + 1,
        r = await repo.reports(false, {
          status: this.data.status,
          communityId: selection.get().communityId,
          page,
        });
      this.setData({
        page,
        items: this.data.items.concat(r.items.map(fmt.report)),
        total: r.total,
      });
    });
  },
  report() {
    go("/pages/report/report");
  },
});
