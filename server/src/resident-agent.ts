import { z } from "zod";
import { text } from "./core.js";
import { completeChat, type LlmMessage } from "./llm.js";
import type { Settings } from "./config.js";

export const residentRoles = ["identify", "action", "document"] as const;
export type ResidentRole = (typeof residentRoles)[number];

export const residentAssistSchema = z
  .object({
    role: z.enum(residentRoles).default("identify"),
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: text(1, 2000),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

type Step = { id: string; label: string; url: string };
type ActionItem = { title: string; detail: string };
type ReportDraft = {
  type: "fire" | "obstruction" | "equipment" | "electrical" | "other";
  location: string;
  description: string;
  hazardName: string;
};
export type ResidentCard = {
  role: ResidentRole;
  riskLevel: "none" | "low" | "medium" | "high" | "emergency";
  title: string;
  reply: string;
  findings: string[];
  questions: string[];
  actions: ActionItem[];
  avoid: string[];
  nextSteps: Step[];
  reportDraft: ReportDraft | null;
};

const SYSTEM = `你是安居云枢面向业主的社区安全助手，按角色工作：
- identify（识险）：判断可能的隐患类型与风险等级，最多追问2个关键问题。
- action（处置）：给出业主现在能做的步骤，以及不要做的事。
- document（文书）：整理可提交的上报描述，不代替正式受理。
硬性规则：
- 只依据用户描述和系统提供的住址/本人上报摘要，不要编造工单号或物业已处置。
- 不要声称已经拨打119、已经派单或已经完成整改。
- 有明火、浓烟、爆炸气味时，优先提示远离危险并联系物业/119，同时仍可引导上报。
- 建议不等于消防鉴定。用简体中文。
只输出一个 JSON 对象，不要 Markdown。字段：
role, riskLevel(none|low|medium|high|emergency), title, reply, findings[], questions[], actions[{title,detail}], avoid[], nextSteps[{id,label,url}], reportDraft({type,location,description,hazardName}|null)
url 只能是这些之一：
/pages/report/report
/pages/emergency/emergency
/pages/building-escape/building-escape
/pages/my-reports/my-reports
type 只能是 fire|obstruction|equipment|electrical|other。`;

export async function runResidentAgent(
  ctx: {
    cfg: Settings;
    address: string;
    openReports: number;
    notice: string;
  },
  input: z.infer<typeof residentAssistSchema>,
) {
  const last = input.messages.at(-1)?.content || "";
  const role = input.role;
  let provider: "zhizengzeng" | "local-fallback" = "local-fallback";
  let llmError = "";
  let card: ResidentCard | null = null;
  if (ctx.cfg.llmApiKey) {
    try {
      const history: LlmMessage[] = [
        {
          role: "system",
          content:
            SYSTEM +
            `\n住址摘要：${ctx.address || "未绑定"}；本人待处理/处理中上报 ${ctx.openReports} 条；最近公告：${ctx.notice || "无"}。`,
        },
        ...input.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        {
          role: "user",
          content: `当前角色=${role}。请仅输出 JSON。`,
        },
      ];
      const { message } = await completeChat(ctx.cfg, history, []);
      provider = "zhizengzeng";
      card = normalizeCard(extractJson(String(message.content || "")), role, last, ctx);
    } catch (error) {
      provider = "local-fallback";
      llmError = String((error as Error)?.message || error).slice(0, 180);
    }
  }
  if (!card) card = localCard(role, last, ctx);
  if (llmError && provider === "local-fallback")
    card.reply += "（大模型暂时不可用，已提供本地安全建议）";
  return {
    reply: card.reply,
    card,
    model: {
      name: ctx.cfg.llmModel,
      provider,
      configured: Boolean(ctx.cfg.llmApiKey),
    },
  };
}

function extractJson(text: string) {
  const trimmed = String(text || "").trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeCard(
  raw: any,
  role: ResidentRole,
  question: string,
  ctx: { address: string; openReports: number },
): ResidentCard | null {
  if (!raw || typeof raw !== "object") return null;
  const fallback = localCard(role, question, ctx);
  const risk = ["none", "low", "medium", "high", "emergency"].includes(raw.riskLevel)
    ? raw.riskLevel
    : fallback.riskLevel;
  const draft = normalizeDraft(raw.reportDraft) || fallback.reportDraft;
  return {
    role,
    riskLevel: risk,
    title: String(raw.title || fallback.title).slice(0, 40),
    reply: String(raw.reply || fallback.reply).slice(0, 800),
    findings: stringList(raw.findings, fallback.findings),
    questions: stringList(raw.questions, fallback.questions).slice(0, 3),
    actions: actionList(raw.actions, fallback.actions),
    avoid: stringList(raw.avoid, fallback.avoid),
    nextSteps: stepList(raw.nextSteps, fallback.nextSteps),
    reportDraft: draft,
  };
}

function normalizeDraft(raw: any): ReportDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const type = ["fire", "obstruction", "equipment", "electrical", "other"].includes(
    raw.type,
  )
    ? raw.type
    : "other";
  const description = String(raw.description || "").trim();
  if (description.length < 5) return null;
  return {
    type,
    location: String(raw.location || "公共区域").slice(0, 160),
    description: description.slice(0, 2000),
    hazardName: String(raw.hazardName || "业主助手建议").slice(0, 40),
  };
}

function stringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value.map((item) => String(item || "").trim()).filter(Boolean);
  return items.length ? items.slice(0, 5) : fallback;
}

function actionList(value: unknown, fallback: ActionItem[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => ({
      title: String(item?.title || "").trim().slice(0, 20),
      detail: String(item?.detail || "").trim().slice(0, 120),
    }))
    .filter((item) => item.title && item.detail);
  return items.length ? items.slice(0, 4) : fallback;
}

const allowedUrls = new Set([
  "/pages/report/report",
  "/pages/emergency/emergency",
  "/pages/building-escape/building-escape",
  "/pages/my-reports/my-reports",
]);

function stepList(value: unknown, fallback: Step[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => ({
      id: String(item?.id || item?.url || "").trim(),
      label: String(item?.label || "").trim().slice(0, 16),
      url: String(item?.url || "").trim(),
    }))
    .filter((item) => item.label && allowedUrls.has(item.url));
  return items.length ? items.slice(0, 3) : fallback;
}

function localCard(
  role: ResidentRole,
  question: string,
  ctx: { address: string; openReports: number },
): ResidentCard {
  const scene = inferScene(question);
  const address = ctx.address || "当前住址";
  if (scene === "smoke") {
    const base: ResidentCard = {
      role,
      riskLevel: "emergency",
      title: "疑似烟火，先保人身安全",
      reply:
        "描述中出现烟或火的迹象。请立即远离危险区域，走安全楼梯、勿乘电梯，并联系物业或119。以下建议不能替代现场指挥。",
      findings: ["可能涉及烟火或能见度下降", "优先撤离与求助，再补报记录"],
      questions: role === "identify" ? ["是否看到明火？", "楼道是否已经充满烟雾？"] : [],
      actions: [
        { title: "立即撤离", detail: "低姿前行，走安全出口，到小区集合点。" },
        { title: "通知他人", detail: "敲门告知邻居，不要返回取物。" },
        { title: "求助", detail: "拨打物业电话或119，说明楼栋与楼层。" },
      ],
      avoid: ["不要乘坐电梯", "不要自行深入浓烟区域"],
      nextSteps: [
        { id: "emergency", label: "紧急求助", url: "/pages/emergency/emergency" },
        { id: "escape", label: "逃生路径", url: "/pages/building-escape/building-escape" },
        { id: "report", label: "事后上报", url: "/pages/report/report" },
      ],
      reportDraft: {
        type: "fire",
        location: address,
        description:
          "业主反映现场出现烟雾或疑似火情，已提示先撤离并联系物业/119。请物业尽快现场核查，本记录不作为已核实火警。",
        hazardName: "疑似烟火",
      },
    };
    if (role === "document")
      base.reply = "已起草上报描述。请核对地点后提交，紧急情况仍应先撤离和求助。";
    if (role === "action")
      base.reply = "请按「撤离—求助—再上报」顺序处理，不要停留围观。";
    return base;
  }
  if (scene === "obstruction") {
    const draft: ReportDraft = {
      type: "obstruction",
      location: address + "公共走廊",
      description:
        "公共走道/楼梯间堆放杂物（如纸箱、家具），占用疏散通道。请物业安排清理并复核消防通道是否恢复畅通。",
      hazardName: "疏散通道占用",
    };
    if (role === "document")
      return {
        role,
        riskLevel: "high",
        title: "上报文书已拟好",
        reply: "已按「疏散通道占用」整理描述，可一键带入隐患上报，仍需您确认后提交。",
        findings: ["占用疏散通道属于高风险隐患", "物业清理前请避免堵塞进一步加重"],
        questions: [],
        actions: [{ title: "提交上报", detail: "把拟好的描述提交给物业值班台。" }],
        avoid: ["不要自行将杂物搬到其他消防通道"],
        nextSteps: [{ id: "report", label: "填入并上报", url: "/pages/report/report" }],
        reportDraft: draft,
      };
    if (role === "action")
      return {
        role,
        riskLevel: "high",
        title: "通道占用：先避开，再上报",
        reply: "请不要在堵塞处停留。能安全移动且属于自己的物品可先移回户内，其余请交物业处理。",
        findings: ["疏散通道被占用会延误逃生"],
        questions: [],
        actions: [
          { title: "保持出口可用", detail: "不要继续堆放，提醒邻里勿堵塞楼梯间。" },
          { title: "拍照取证", detail: "在确保安全的前提下拍照，便于物业定位。" },
          { title: "正式上报", detail: "提交隐患工单，由物业安排清理。" },
        ],
        avoid: ["不要与邻里冲突强行清场", "不要堵塞另一个出口"],
        nextSteps: [
          { id: "report", label: "去上报", url: "/pages/report/report" },
          { id: "escape", label: "看逃生图", url: "/pages/building-escape/building-escape" },
        ],
        reportDraft: draft,
      };
    return {
      role,
      riskLevel: "high",
      title: "识险：疏散通道可能被占用",
      reply: "根据描述，更像是楼道堆物占用疏散通道。这会影响逃生，建议尽快上报物业清理。",
      findings: ["隐患类型倾向：通道占用", "风险：火灾时出口受阻"],
      questions: ["堆放位置是楼梯间、走道还是门口？", "是否已经完全挡住通行？"],
      actions: [{ title: "建议下一步", detail: "切换到「处置」看怎么做，或直接上报。" }],
      avoid: ["不要把占用通道当成普通杂物间"],
      nextSteps: [{ id: "report", label: "去上报", url: "/pages/report/report" }],
      reportDraft: draft,
    };
  }
  if (scene === "equipment") {
    const draft: ReportDraft = {
      type: "equipment",
      location: address,
      description:
        "消防设施周边被遮挡或疑似损坏（如灭火器、消火栓、指示灯），请物业现场检查并恢复可用状态。",
      hazardName: "消防设施异常",
    };
    return {
      role,
      riskLevel: "medium",
      title: role === "document" ? "设施异常上报草稿" : "识险：消防设施可能受影响",
      reply:
        role === "action"
          ? "请勿挪走或试用消防器材。拍照后上报，由物业检查设施是否完好。"
          : "描述指向消防设施被挡或异常。请保持设施可见、可取用，并提交上报。",
      findings: ["可能影响灭火或疏散指示"],
      questions: role === "identify" ? ["是灭火器、消火栓还是指示灯？"] : [],
      actions: [
        { title: "保持可取用", detail: "移开自己能安全移开的遮挡物。" },
        { title: "上报物业", detail: "写明位置和设施类型。" },
      ],
      avoid: ["不要把消防器材当普通工具使用"],
      nextSteps: [{ id: "report", label: "去上报", url: "/pages/report/report" }],
      reportDraft: draft,
    };
  }
  const draft: ReportDraft = {
    type: "other",
    location: address,
    description:
      (question || "业主咨询社区安全问题。").slice(0, 200) +
      " 请物业结合现场情况核查，本记录仅为业主助手整理的上报草稿。",
    hazardName: "安全咨询",
  };
  return {
    role,
    riskLevel: ctx.openReports ? "low" : "none",
    title: role === "document" ? "可继续完善后上报" : "需要多一点关键信息",
    reply:
      role === "document"
        ? "已生成通用描述草稿。建议补充具体位置和现象后再提交。"
        : "请用一句话说明看到了什么、在哪一层。有烟火请先撤离；通道堆物、设施被挡也可以直接上报。",
    findings: ctx.openReports
      ? [`您名下还有 ${ctx.openReports} 条待跟进上报`]
      : ["当前信息还不足以判定具体隐患类型"],
    questions: ["具体位置在走廊、楼梯还是自家门口？", "是否看到烟、火或明显堆物？"],
    actions: [{ title: "可选动作", detail: "查看逃生图，或把现象写进隐患上报。" }],
    avoid: ["不要把助手建议当成已经派单"],
    nextSteps: [
      { id: "report", label: "去上报", url: "/pages/report/report" },
      { id: "escape", label: "逃生路径", url: "/pages/building-escape/building-escape" },
    ],
    reportDraft: draft,
  };
}

function inferScene(question: string) {
  if (/烟|火|明火|燃烧|爆炸|浓烟/.test(question)) return "smoke";
  if (/纸箱|堆物|堵塞|占用|走廊|楼道|通道|杂物|家具/.test(question))
    return "obstruction";
  if (/灭火器|消火栓|消防栓|指示灯|应急灯|设施/.test(question)) return "equipment";
  return "generic";
}
