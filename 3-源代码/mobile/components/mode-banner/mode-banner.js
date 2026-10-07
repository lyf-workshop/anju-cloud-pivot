const config = require("../../config/index");
Component({
  data: {
    label:
      config.mode === "showcase"
        ? "展示版 · 本地示例数据"
        : config.loginMode === "demo-session"
          ? "比赛演示 · 记录保存至演示服务器"
          : config.mode === "local"
            ? "本地联调 · 数据保存至开发数据库"
            : "社区服务 · 线上演练",
  },
});
