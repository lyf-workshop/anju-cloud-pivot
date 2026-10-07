const { define } = require("../../utils/page"),
  repo = require("../../services/repository"),
  selection = require("../../services/selection"),
  fmt = require("../../services/format");
define({
  data: { items: [], page: 1, total: 0 },
  onShow() {
    this.load();
  },
  load() {
    return this.fetch(async () => {
      const r = await repo.notices({
        communityId: selection.get().communityId,
        page: 1,
      });
      this.setData({
        items: r.items.map((n) =>
          Object.assign({}, n, { timeText: fmt.date(n.publishedAt) }),
        ),
        page: 1,
        total: r.total,
      });
    });
  },
  more() {
    this.task(async () => {
      const page = this.data.page + 1,
        r = await repo.notices({
          communityId: selection.get().communityId,
          page,
        });
      this.setData({
        page,
        total: r.total,
        items: this.data.items.concat(
          r.items.map((n) =>
            Object.assign({}, n, { timeText: fmt.date(n.publishedAt) }),
          ),
        ),
      });
    });
  },
});
