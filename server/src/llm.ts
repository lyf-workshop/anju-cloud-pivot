import type { Settings } from "./config.js";

export type LlmMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: LlmToolCall[];
};

export type LlmToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export const agentTools = [
  {
    type: "function",
    function: {
      name: "get_camera_status",
      description:
        "读取树莓派边缘检测摄像头的最新状态。confirmed 只表示连续帧疑似，必须人工复核。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          cameraId: {
            type: "string",
            description: "摄像头编号，默认社区演示摄像头",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_open_reports",
      description: "列出本社区待处理或处理中的隐患工单",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          status: {
            type: "string",
            enum: ["pending", "processing"],
            description: "不传则同时返回待处理和受理中工单",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_report",
      description: "读取一条工单的详情、版本号和处理时间线",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { reportId: { type: "string" } },
        required: ["reportId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_report_action",
      description:
        "起草工单受理或完成说明。不会写入数据库，必须由值班员在页面确认后才会生效。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          reportId: { type: "string" },
          status: { type: "string", enum: ["processing", "completed"] },
          message: { type: "string" },
        },
        required: ["reportId", "status", "message"],
      },
    },
  },
];

export async function completeChat(
  cfg: Settings,
  messages: LlmMessage[],
  tools: typeof agentTools | [] = agentTools,
): Promise<{ message: LlmMessage; provider: "zhizengzeng" }> {
  if (!cfg.llmApiKey) throw new Error("LLM_NOT_CONFIGURED");
  const body: Record<string, unknown> = {
    model: cfg.llmModel,
    temperature: 0.2,
    messages,
  };
  if (tools.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  const response = await fetch(cfg.llmBaseUrl + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + cfg.llmApiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const payload = (await response.json().catch(() => ({}))) as any;
  if (!response.ok)
    throw new Error(
      payload?.error?.message || "大模型接口返回 " + response.status,
    );
  const message = payload?.choices?.[0]?.message;
  if (!message) throw new Error("大模型没有返回内容");
  return { message, provider: "zhizengzeng" };
}
