import { z } from "zod";
import type { Settings } from "./config.js";
import { fail, text } from "./core.js";
import { completeChat, type LlmMessage } from "./llm.js";

const SYSTEM = `你是安居云枢物业值班台的处置智能体，协助值班员理解摄像头检测结果和隐患工单。
规则：
- 只能依据工具返回的数据回答，不要编造工单号、位置或火警。
- 摄像头 confirmed/candidate 只表示模型连续帧疑似，必须人工复核，不是已核实火警，也不要建议系统自动拨打 119。
- 不要声称已经派单、已经完成工单或已经通知业主；写入必须等值班员在页面上确认。
- 用简体中文，短句，先结论后依据。`;

export const agentChatSchema = z
  .object({
    communityId: text().optional(),
    cameraId: text(3, 64).optional(),
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

type ToolTrace = { name: string; arguments: unknown; result: unknown };
type Proposal = {
  kind: "report_action";
  reportId: string;
  number?: string;
  status: "processing" | "completed";
  message: string;
  expectedVersion: number;
};

export async function runStaffAgent(
  ctx: {
    cfg: Settings;
    communityId: string;
    inspectCamera: (id: string) => unknown;
    listReports: (status?: string) => any[];
    getReport: (id: string) => any;
  },
  input: z.infer<typeof agentChatSchema>,
) {
  const tools: ToolTrace[] = [];
  let proposal: Proposal | null = null;
  const execute = (name: string, raw: unknown) => {
    const args = parseArgs(raw);
    let result: unknown;
    if (name === "get_camera_status") {
      result = ctx.inspectCamera(
        String(args.cameraId || input.cameraId || ctx.cfg.agentCameraId),
      );
    } else if (name === "list_open_reports") {
      const status =
        args.status === "processing" || args.status === "pending"
          ? args.status
          : undefined;
      result = {
        items: ctx.listReports(status).map((row) => summarizeReport(row)),
      };
    } else if (name === "get_report") {
      if (!args.reportId) fail(400, "VALIDATION_ERROR", "缺少工单编号");
      result = summarizeReport(ctx.getReport(String(args.reportId)), true);
    } else if (name === "draft_report_action") {
      if (!args.reportId || !args.status || !args.message)
        fail(400, "VALIDATION_ERROR", "起草工单动作缺少字段");
      const report = ctx.getReport(String(args.reportId));
      const status = args.status as "processing" | "completed";
      if (
        report.status === "completed" ||
        (report.status === "pending" && status !== "processing")
      )
        fail(409, "REPORT_STATE", "请先受理工单；已完成工单不能再次处理");
      proposal = {
        kind: "report_action",
        reportId: report.id,
        number: report.number,
        status,
        message: String(args.message).slice(0, 1000),
        expectedVersion: report.version || 0,
      };
      result = {
        drafted: true,
        requiresConfirmation: true,
        proposal,
      };
    } else {
      result = { error: "未知工具" };
    }
    tools.push({ name, arguments: args, result });
    return result;
  };

  const last = input.messages.at(-1)?.content || "";
  let provider: "zhizengzeng" | "local-fallback" = "local-fallback";
  let reply = "";
  let llmError = "";
  if (ctx.cfg.llmApiKey) {
    try {
      const history: LlmMessage[] = [
        { role: "system", content: SYSTEM },
        ...input.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];
      for (let i = 0; i < 4; i++) {
        const { message } = await completeChat(ctx.cfg, history);
        provider = "zhizengzeng";
        const calls = message.tool_calls || [];
        if (!calls.length) {
          reply = String(message.content || "").trim();
          break;
        }
        history.push(message);
        for (const call of calls) {
          const result = execute(call.function?.name, call.function?.arguments);
          history.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      }
    } catch (error) {
      provider = "local-fallback";
      llmError = String((error as Error)?.message || error).slice(0, 200);
    }
  }
  if (!reply) {
    if (!tools.length) for (const name of inferTools(last)) execute(name, {});
    if (/起草|受理/.test(last) && !proposal) {
      const listed =
        (tools.find((t) => t.name === "list_open_reports")?.result as any)
          ?.items || ctx.listReports();
      const first = listed[0];
      if (first)
        execute("draft_report_action", {
          reportId: first.id,
          status: first.status === "pending" ? "processing" : "completed",
          message:
            "值班员已复核监控与上报信息，现予受理并安排现场核查。此为人工确认，不是自动火警。",
        });
    }
    reply = localReply(last, tools, proposal);
    if (llmError) reply += "（大模型暂时不可用，已改用本地工具摘要：" + llmError + "）";
  }
  return {
    reply,
    tools,
    proposal,
    model: {
      name: ctx.cfg.llmModel,
      provider,
      configured: Boolean(ctx.cfg.llmApiKey),
    },
  };
}

function parseArgs(raw: unknown) {
  if (!raw) return {} as Record<string, any>;
  if (typeof raw === "object") return raw as Record<string, any>;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function summarizeReport(row: any, detail = false) {
  const base = {
    id: row.id,
    number: row.number,
    type: row.type,
    status: row.status,
    location: row.location,
    createdAt: row.createdAt,
    version: row.version || 0,
  };
  if (!detail) return base;
  return {
    ...base,
    description: row.description,
    events: row.events,
  };
}

function inferTools(text: string) {
  const names: string[] = [];
  if (/摄像|烟火|火情|YOLO|告警|镜头|检测/i.test(text))
    names.push("get_camera_status");
  if (/工单|隐患|待办|上报|受理/i.test(text) || !names.length)
    names.push("list_open_reports");
  return names;
}

function localReply(question: string, tools: ToolTrace[], proposal: Proposal | null) {
  const bits: string[] = [];
  const camera = tools.find((t) => t.name === "get_camera_status")?.result as any;
  if (camera) {
    if (!camera.available)
      bits.push("摄像头暂无最新画面，不能把缺画面当成火警。");
    else
      bits.push(
        `摄像头 ${camera.cameraId} ${camera.online ? "在线" : "已过期"}，检测状态 ${camera.alarmState}。${camera.notice}`,
      );
  }
  const listed = tools.find((t) => t.name === "list_open_reports")?.result as any;
  if (listed?.items)
    bits.push(
      listed.items.length
        ? `待办工单 ${listed.items.length} 条：` +
            listed.items
              .slice(0, 5)
              .map((item: any) => `${item.number}（${item.status}，${item.location}）`)
              .join("；")
        : "当前没有待处理或受理中的工单。",
    );
  if (proposal)
    bits.push(
      `已起草工单 ${proposal.number || proposal.reportId} 的「${proposal.status === "processing" ? "受理" : "完成"}」说明，请在面板确认后才会写入。`,
    );
  if (!bits.length) bits.push("请说明要查摄像头还是待办工单。");
  if (/119|自动报警/.test(question))
    bits.push("本系统不会自动拨打紧急电话，须值班员人工研判。");
  return bits.join("");
}
