const { define } = require("../../utils/page"),
  repo = require("../../services/repository"),
  onboarding = require("../../services/onboarding");

function enter(user) {
  if (onboarding.required(user))
    wx.redirectTo({ url: "/pages/register/register" });
  else wx.switchTab({ url: "/pages/index/index" });
}
define({
  data: {
    agreed: false,
    config: null,
  },
  onLoad() {
    this.load();
  },
  load() {
    return this.fetch(async () => {
      const config = await repo.config();
      this.setData({ config });
      const session = require("../../services/session").get();
      if (this.data.connected && session && !session.expired) {
        try {
          const user = await repo.me();
          enter(user);
        } catch (e) {
          if (e.status !== 401) throw e;
        }
      }
    });
  },
  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },
  submit() {
    if (!this.data.agreed || this.data.busy) return;
    this.task(async () => {
      let config = this.data.config;
      if (!config) {
        config = await repo.config();
        this.setData({ config });
      }
      const user = await repo.login(true, config.legalVersion);
      enter(user);
    });
  },
});
