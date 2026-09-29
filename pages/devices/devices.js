const { define, go, requireLogin } = require("../../utils/page"),
  repo = require("../../services/repository"),
  fmt = require("../../services/format"),
  selection = require("../../services/selection");
function device(d) {
  return Object.assign({}, d, {
    connectionLabel: { online: "在线", offline: "离线", unknown: "通信未知" }[
      d.connectionStatus
    ],
    eventLabel: {
      alarm: "示例状态：告警提示",
      cleared: "示例状态：未触发告警",
      unknown: "示例状态：暂无事件信息",
    }[d.eventStatus],
    seenText: fmt.date(d.lastSeenAt),
    readingTime: d.reading ? fmt.date(d.reading.collectedAt) : "暂无采集时间",
  });
}
define({
  data: { items: [], page: 1, total: 0, onlineCount:0,locationText:'本层感知设备' },
  onLoad(q) {
    this.floorId = q.floorId || selection.get().floorId;
    this.deviceId = q.id;
  },
  onShow() {
    if (requireLogin()) this.load();
  },
  load() {
    return this.fetch(async () => {
      if (this.deviceId) {
        this.setData({
          items: [device(await repo.device(this.deviceId))],
          total: 1,
        });
        return;
      }
      const r = await repo.devices({ floorId: this.floorId, page: 1 });
      const location=await selection.load({floorId:this.floorId});
      this.setData({ items: r.items.map(device), total: r.total, page: 1,onlineCount:r.items.filter(x=>x.connectionStatus==='online').length,locationText:location.locationText });
    });
  },
  more() {
    this.task(async () => {
      const page = this.data.page + 1,
        r = await repo.devices({ floorId: this.floorId, page });
      this.setData({
        page,
        items: this.data.items.concat(r.items.map(device)),
        total: r.total,
      });
    });
  },
  feedback(e) {
    const d = this.data.items.find((x) => x.id === e.currentTarget.dataset.id);
    go(
      "/pages/report/report?deviceId=" +
        d.id +
        "&floorId=" +
        d.floorId +
        "&location=" +
        encodeURIComponent(d.location),
    );
  },
});
