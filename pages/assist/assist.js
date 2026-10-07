const { define, requireLogin, go } = require("../../utils/page");
const repo = require("../../services/repository");
const session = require("../../services/session");
const scripted = require("../../services/resident-assist-scripted");

const roles = [
  { id: "identify", name: "识险", note: "判断隐患", mark: "01" },
  { id: "action", name: "处置", note: "现在怎么做", mark: "02" },
  { id: "document", name: "文书", note: "写上报", mark: "03" },
];

const chipsByRole = {
  identify: ["走廊堆了纸箱", "楼道闻到烟味", "灭火器被杂物挡住"],
  action: ["通道被堵了我该怎么办", "有烟味先做什么", "应急灯不亮怎么处理"],
  document: ["帮我写通道占用上报", "帮我写烟味情况描述", "帮我写消防设施被挡"],
};

const riskLabel = {
  none: "提示",
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  emergency: "紧急",
};

function decorateCard(card) {
  if (!card) return null;
  return {
    ...card,
    findings: card.findings || [],
    questions: card.questions || [],
    actions: (card.actions || []).map((item, index) => ({
      ...item,
      no: String(index + 1).padStart(2, "0"),
    })),
    avoid: card.avoid || [],
    nextSteps: card.nextSteps || [],
    riskLabel: riskLabel[card.riskLevel] || "提示",
  };
}

async function radarWithFallback(user) {
  try {
    return await repo.residentRadar();
  } catch (_) {
    const radar = await scripted.radar(user);
    return {
      ...radar,
      advice: `${radar.advice || ""}（当前使用离线安全提示）`,
      offline: true,
    };
  }
}

async function assistWithFallback(body) {
  try {
    return await repo.residentAssist(body);
  } catch (_) {
    const result = await scripted.assist(body);
    return {
      ...result,
      reply: `${result.reply || result.card?.reply || "已生成建议。"}（网络不可用，已使用本地安全建议）`,
      offline: true,
    };
  }
}

define({
  data: {
    role: "identify",
    roles,
    chips: chipsByRole.identify,
    draft: "",
    scrollInto: "",
    radar: { address: "", openReports: 0, notice: "", advice: "" },
    messages: [
      {
        id: "hello",
        role: "assistant",
        text: "我是业主助手。可先识险、再给处置建议，最后帮你写成上报描述。紧急情况请先保证安全。",
        card: null,
        intro: true,
      },
    ],
  },
  onShow() {
    this.loadRadar();
  },
  clearAssistError() {
    this.setData({ error: "" });
  },
  loadRadar() {
    const current = session.get();
    if (!current || current.expired) return;
    radarWithFallback(current.user)
      .then((radar) => this.setData({ radar, error: "" }))
      .catch(() => {});
  },
  setRole(e) {
    const role = e.currentTarget.dataset.id;
    this.setData({ role, chips: chipsByRole[role] || [], error: "" });
  },
  onDraft(e) {
    this.setData({ draft: e.detail.value });
  },
  ask(e) {
    this.setData({ draft: e.currentTarget.dataset.text || "", error: "" });
    this.send();
  },
  send() {
    const text = (this.data.draft || "").trim();
    if (!text || this.data.busy) return;
    if (!requireLogin()) return;
    this.task(async () => {
      const id = "u" + Date.now();
      const history = this.data.messages
        .filter((item) => item.id !== "hello")
        .map((item) => ({ role: item.role, content: item.text }))
        .concat([{ role: "user", content: text }])
        .slice(-8);
      this.setData({
        draft: "",
        error: "",
        messages: this.data.messages.concat([
          { id, role: "user", text, card: null },
        ]),
        scrollInto: "",
      });
      wx.nextTick(() => this.setData({ scrollInto: "msg-" + id }));
      const result = await assistWithFallback({
        role: this.data.role,
        messages: history,
      });
      const aid = "a" + Date.now();
      this.setData({
        messages: this.data.messages.concat([
          {
            id: aid,
            role: "assistant",
            text: result.reply || result.card?.reply || "已生成建议。",
            card: decorateCard(result.card),
          },
        ]),
        scrollInto: "",
      });
      wx.nextTick(() => this.setData({ scrollInto: "msg-end" }));
    });
  },
  goStep(e) {
    const url = e.currentTarget.dataset.url;
    const draft = e.currentTarget.dataset.draft;
    if (draft && url && url.indexOf("/pages/report/report") === 0) {
      wx.setStorageSync(session.privateKey("assist-draft"), draft);
      go("/pages/report/report?from=assist");
      return;
    }
    if (url) go(url);
  },
});
