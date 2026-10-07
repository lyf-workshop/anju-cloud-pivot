const config = require("./config/index");
App({
  globalData: { edition: config.mode },
  onLaunch() {
    if (config.transport !== "cloud") return;
    if (!wx.cloud) {
      console.error("当前基础库不支持云开发，请升级微信基础库");
      return;
    }
    const options = { traceUser: true };
    if (config.cloudEnv) options.env = config.cloudEnv;
    wx.cloud.init(options);
  },
  onHide() { if (config.mode !== "showcase") require("./services/drill-clock").pause(); },
  onShow() { if (config.mode !== "showcase") require("./services/drill-clock").resume(); },
});
