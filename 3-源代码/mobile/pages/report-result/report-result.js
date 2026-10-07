const { define, requireLogin } = require("../../utils/page"),
  repo = require("../../services/repository"),
  fmt = require("../../services/format");
define({
  data: { record: null },
  onLoad(q) {
    this.id = q.id;
  },
  onShow() {
    if (requireLogin()) this.load();
  },
  load() {
    this.setData({ record: null });
    return this.fetch(async () =>
      this.setData({ record: fmt.report(await repo.report(this.id)) }),
    );
  },
});
