const { define, go, requireLogin } = require("../../utils/page"),
  repo = require("../../services/repository"),
  fmt = require("../../services/format");
define({
  data: {
    items: [],
    page: 1,
    total: 0,
    stats: { completedCount: 0, durationSeconds: 0, completedSteps: 0 },
  },
  onShow() {
    if (requireLogin()) this.load();
  },
  load() {
    return this.fetch(async () => {
      const [r, stats] = await Promise.all([
        repo.drills({ page: 1 }),
        repo.drillStats(),
      ]);
      this.setData({
        items: r.items.map(fmt.drill),
        total: r.total,
        page: 1,
        stats,
        durationText: fmt.duration(stats.durationSeconds),
      });
    });
  },
  open(e) {
    const r = this.data.items.find((x) => x.id === e.currentTarget.dataset.id);
    go(
      "/pages/" +
        (r.status === "in_progress"
          ? "drill/drill"
          : "drill-summary/drill-summary") +
        "?id=" +
        r.id,
    );
  },
  more() {
    this.task(async () => {
      const page = this.data.page + 1,
        r = await repo.drills({ page });
      this.setData({
        page,
        items: this.data.items.concat(r.items.map(fmt.drill)),
        total: r.total,
      });
    });
  },
});
