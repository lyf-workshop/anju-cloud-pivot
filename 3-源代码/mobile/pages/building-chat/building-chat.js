const { define } = require("../../utils/page");

const seedMessages = [
  {
    id: "m1",
    name: "林先生",
    avatar: "林",
    floor: "2号楼3单元5层",
    role: "owner",
    text: "2号楼3单元5层走廊有浓烟，味道很呛，已经往楼梯口撤了。",
    time: "10:21",
  },
  {
    id: "m2",
    name: "王阿姨",
    avatar: "王",
    floor: "2号楼2单元3层",
    role: "owner",
    text: "2号楼3层东侧好像有明火，门口堆了纸箱，请物业尽快确认！",
    time: "10:22",
  },
  {
    id: "m3",
    name: "物业值班",
    avatar: "物",
    floor: "值班室",
    role: "property",
    text: "收到，已通知消控室并拨打119。请各位优先走安全楼梯，勿乘电梯。",
    time: "10:23",
  },
  {
    id: "m4",
    name: "陈同学",
    avatar: "陈",
    floor: "2号楼1单元6层",
    role: "owner",
    text: "6层暂时还能见度，但楼梯间开始有烟味，大家低姿前行。",
    time: "10:24",
  },
  {
    id: "m5",
    name: "周先生",
    avatar: "周",
    floor: "1号楼靠近连廊",
    role: "owner",
    text: "连廊这边看到2号楼3层窗口有火星，建议周边楼栋也留意。",
    time: "10:25",
  },
];

define({
  data: {
    draft: "",
    scrollInto: "",
    aiSummary: {
      updatedAt: "刚刚更新",
      title: "当前火情速览",
      content:
        "综合业主上报：火情主要集中在2号楼，3层有明火迹象，3单元5层出现浓烟；建议沿安全楼梯撤离，勿乘电梯，低姿捂口鼻。物业与消控室已介入。",
      tags: ["2号楼", "3层明火", "5层浓烟", "勿乘电梯"],
    },
    messages: seedMessages,
  },
  onShow() {
    this.setData({ scrollInto: "msg-end" });
  },
  onDraft(e) {
    this.setData({ draft: e.detail.value });
  },
  send() {
    const text = (this.data.draft || "").trim();
    if (!text) return;
    const id = "m" + Date.now();
    const now = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const time = p(now.getHours()) + ":" + p(now.getMinutes());
    const messages = this.data.messages.concat([
      {
        id,
        name: "我",
        avatar: "我",
        floor: "本机",
        role: "mine",
        mine: true,
        text,
        time,
      },
    ]);
    this.setData({
      messages,
      draft: "",
      scrollInto: "msg-end",
      "aiSummary.updatedAt": "刚刚更新",
      "aiSummary.content":
        "AI 已纳入你的补充：" +
        text +
        "。综合来看火情仍以2号楼为主，请继续留意烟雾蔓延方向并听从物业指引。",
    });
  },
});
