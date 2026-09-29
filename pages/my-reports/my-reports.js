const { define, requireLogin } = require("../../utils/page"),
  repo = require("../../services/repository"),
  fmt = require("../../services/format");
define({
  data: {
    items: [],
    status: "",
    page: 1,
    total: 0,
    stats: { total: 0, pending: 0, completed: 0 },
    filters: [
      { id: "", name: "全部" },
      { id: "pending", name: "待处理" },
      { id: "processing", name: "处理中" },
      { id: "completed", name: "已完成" },
    ],
  },
  onShow() {
    if (requireLogin()) this.load();
  },
  load() {
    return this.fetch(async () => {
      const [r, stats] = await Promise.all([
        repo.reports(true, { status: this.data.status, page: 1 }),
        repo.reportStats(),
      ]);
      this.setData({
        items: r.items.map(fmt.report),
        total: r.total,
        page: 1,
        stats,
      });
    });
  },
  filter(e) {
    this.setData({ status: e.currentTarget.dataset.id });
    this.load();
  },
  more() {
    this.task(async () => {
      const page = this.data.page + 1,
        r = await repo.reports(true, { status: this.data.status, page });
      this.setData({
        page,
        items: this.data.items.concat(r.items.map(fmt.report)),
        total: r.total,
      });
    });
  },
});
