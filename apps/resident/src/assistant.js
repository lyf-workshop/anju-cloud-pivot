export const assistRoles = [
  { id: "identify", name: "识险", note: "判断隐患" },
  { id: "action", name: "处置", note: "现在怎么做" },
  { id: "document", name: "文书", note: "写上报" },
];

export const assistChips = {
  identify: ["走廊堆了纸箱", "楼道闻到烟味", "灭火器被杂物挡住"],
  action: ["通道被堵了我该怎么办", "有烟味先做什么", "应急灯不亮怎么处理"],
  document: ["帮我写通道占用上报", "帮我写烟味情况描述", "帮我写消防设施被挡"],
};

const steps = {
  report: { id: "report", label: "去上报", url: "/pages/report/report" },
  emergency: { id: "emergency", label: "紧急求助", url: "/pages/emergency/emergency" },
  escape: { id: "escape", label: "逃生路径", url: "/pages/building-escape/building-escape" },
};

function addressOf(user) {
  const binding = user?.bindings?.find((item) => item.isCurrent) || user?.bindings?.[0];
  return binding?.address || "当前住址";
}

export function localRadar(user) {
  return {
    configured: false,
    address: addressOf(user),
    openReports: 0,
    notice: "",
    advice: "网络不可用，当前显示本地安全提示；私人记录状态以重新联网后的服务器结果为准。",
    offline: true,
  };
}

export function localAssist(role, text, user) {
  const question = String(text || "").trim();
  const address = addressOf(user);
  if (/烟|火|明火|燃烧|爆炸|浓烟/.test(question)) {
    return card({
      role,
      riskLevel: "emergency",
      title: "疑似烟火，先保人身安全",
      reply: "请立即远离危险区域，走安全楼梯、勿乘电梯，并联系物业或 119。本地建议不能替代现场指挥。",
      findings: ["描述中出现烟火迹象", "优先撤离和求助，再补充上报"],
      questions: role === "identify" ? ["是否看到明火？", "楼道是否已充满烟雾？"] : [],
      actions: [
        { title: "立即撤离", detail: "低姿前行，沿安全出口到集合点。" },
        { title: "通知他人", detail: "提醒邻居，不要返回取物。" },
        { title: "人工求助", detail: "联系物业或 119，说明楼栋和楼层。" },
      ],
      avoid: ["不要乘坐电梯", "不要进入浓烟区域"],
      nextSteps: [steps.emergency, steps.escape, steps.report],
      reportDraft: {
        type: "fire",
        location: address,
        description: "现场出现烟雾或疑似火情，已先行撤离并联系人工求助。请物业尽快现场核查，本记录不代表已核实火警。",
        hazardName: "疑似烟火",
      },
    });
  }
  if (/纸箱|堆物|堵塞|占用|走廊|楼道|通道|杂物|家具/.test(question)) {
    return card({
      role,
      riskLevel: "high",
      title: role === "document" ? "通道占用上报草稿" : "疏散通道可能被占用",
      reply: role === "action"
        ? "请避开堵塞处，在安全前提下拍照并上报物业，不要与他人冲突或把杂物移到另一条消防通道。"
        : "描述更像是楼道堆物占用疏散通道，建议尽快上报物业清理。",
      findings: ["隐患类型倾向：通道占用", "火灾时可能延误逃生"],
      questions: role === "identify" ? ["位于楼梯间、走道还是门口？", "是否完全挡住通行？"] : [],
      actions: [
        { title: "保持出口可用", detail: "不要继续堆放，提醒邻里保持通道畅通。" },
        { title: "拍照上报", detail: "确保安全后拍照，由物业安排清理。" },
      ],
      avoid: ["不要强行与邻里冲突", "不要堵塞另一个出口"],
      nextSteps: [steps.report, steps.escape],
      reportDraft: {
        type: "obstruction",
        location: `${address}公共走廊`,
        description: "公共走道或楼梯间堆放杂物，占用疏散通道。请物业安排清理并复核消防通道是否恢复畅通。",
        hazardName: "疏散通道占用",
      },
    });
  }
  if (/灭火器|消火栓|消防栓|指示灯|应急灯|设施/.test(question)) {
    return card({
      role,
      riskLevel: "medium",
      title: "消防设施可能异常",
      reply: "请勿擅自试用或拆卸消防器材。可在安全前提下拍照，并由物业检查设施是否完好。",
      findings: ["可能影响灭火或疏散指示"],
      questions: role === "identify" ? ["是灭火器、消火栓还是指示灯？"] : [],
      actions: [{ title: "上报物业", detail: "写明位置、设施类型和看到的现象。" }],
      avoid: ["不要把消防器材当普通工具使用"],
      nextSteps: [steps.report],
      reportDraft: {
        type: "equipment",
        location: address,
        description: "消防设施周边被遮挡或疑似损坏，请物业现场检查并恢复可用状态。",
        hazardName: "消防设施异常",
      },
    });
  }
  return card({
    role,
    riskLevel: "none",
    title: "需要多一点关键信息",
    reply: "请说明看到了什么、具体在什么位置。有烟火请先撤离；通道堆物或设施被挡也可以直接上报。",
    findings: ["当前信息不足以判断具体隐患类型"],
    questions: ["具体位置在哪里？", "是否看到烟、火或明显堆物？"],
    actions: [{ title: "补充描述", detail: "说明地点、现象和是否影响通行。" }],
    avoid: ["不要把助手建议当成物业已经受理"],
    nextSteps: [steps.report, steps.escape],
    reportDraft: null,
  });
}

function card(value) {
  return {
    ...value,
    findings: value.findings || [],
    questions: value.questions || [],
    actions: value.actions || [],
    avoid: value.avoid || [],
    nextSteps: value.nextSteps || [],
  };
}
