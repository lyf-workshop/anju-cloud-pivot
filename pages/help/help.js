const { define } = require("../../utils/page"),
  repo = require("../../services/repository"),
  config = require("../../config/index");
define({
  data: { config: null, mode: config.mode },
  onLoad() {
    this.load();
  },
  load() {
    return this.fetch(async () =>
      this.setData({ config: await repo.config() }),
    );
  },
});
