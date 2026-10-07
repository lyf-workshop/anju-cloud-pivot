// Nine chip presets for 识险 / 处置 / 文书 demo replies (no remote agent required).

function card(partial) {
  return {
    findings: [],
    questions: [],
    actions: [],
    avoid: [],
    nextSteps: [],
    reportDraft: null,
    ...partial,
  };
}

const presets = {
  // —— 识险 ——
  走廊堆了纸箱: card({
    role: "identify",
    riskLevel: "high",
    title: "识险：疏散通道可能被占用",
    reply:
      "根据描述，走廊纸箱更像是楼道堆物占用疏散通道。火灾时会挡住逃生，建议尽快拍照并上报物业清理。",
    findings: ["隐患类型倾向：通道占用", "风险：火灾或紧急疏散时出口受阻"],
    questions: ["堆放位置是楼梯间、走道还是门口？", "是否已经完全挡住通行？"],
    actions: [
      { title: "建议下一步", detail: "切换到「处置」看怎么做，或直接进入隐患上报。" },
    ],
    avoid: ["不要把占用通道当成普通杂物间"],
    nextSteps: [{ id: "report", label: "去上报", url: "/pages/report/report" }],
    reportDraft: {
      type: "obstruction",
      location: "公共走廊",
      description:
        "公共走道堆放纸箱等杂物，占用疏散通道。请物业安排清理并复核消防通道是否恢复畅通。",
      hazardName: "疏散通道占用",
    },
  }),
  楼道闻到烟味: card({
    role: "identify",
    riskLevel: "emergency",
    title: "疑似烟火，先保人身安全",
    reply:
      "楼道出现烟味属于紧急迹象。请立即远离危险区域，走安全楼梯、勿乘电梯，并联系物业或119。以下建议不能替代现场指挥。",
    findings: ["可能涉及烟火或能见度下降", "优先撤离与求助，再补报记录"],
    questions: ["是否看到明火？", "楼道是否已经充满烟雾？"],
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
      location: "楼道",
      description:
        "业主反映楼道出现烟雾气味，已提示先撤离并联系物业/119。请物业尽快现场核查，本记录不作为已核实火警。",
      hazardName: "疑似烟火",
    },
  }),
  灭火器被杂物挡住: card({
    role: "identify",
    riskLevel: "medium",
    title: "识险：消防设施可能受影响",
    reply:
      "灭火器被杂物挡住会影响紧急取用。请保持设施可见、可取用，尽量移开自己能安全移开的遮挡，并提交上报。",
    findings: ["可能影响灭火器材取用"],
    questions: ["挡在灭火器前的是纸箱、家具还是其他物品？"],
    actions: [
      { title: "保持可取用", detail: "移开自己能安全移开的遮挡物。" },
      { title: "上报物业", detail: "写明位置和设施类型，由物业复核。" },
    ],
    avoid: ["不要把消防器材当普通工具使用"],
    nextSteps: [{ id: "report", label: "去上报", url: "/pages/report/report" }],
    reportDraft: {
      type: "equipment",
      location: "公共区域灭火器点位",
      description: "灭火器周边被杂物遮挡，影响取用。请物业现场检查并恢复可用状态。",
      hazardName: "消防设施被挡",
    },
  }),

  // —— 处置 ——
  通道被堵了我该怎么办: card({
    role: "action",
    riskLevel: "high",
    title: "通道占用：先避开，再上报",
    reply:
      "请不要在堵塞处停留。能安全移动且属于自己的物品可先移回户内，其余请交物业处理，并尽快拍照上报。",
    findings: ["疏散通道被占用会延误逃生"],
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
    reportDraft: {
      type: "obstruction",
      location: "公共走廊",
      description: "疏散通道被杂物堵塞，请物业清理并恢复通行。",
      hazardName: "疏散通道占用",
    },
  }),
  有烟味先做什么: card({
    role: "action",
    riskLevel: "emergency",
    title: "有烟味：撤离—求助—再上报",
    reply: "请按「撤离—求助—再上报」顺序处理，不要停留围观，不要乘坐电梯。",
    findings: ["烟味可能意味着火情或燃烧物", "人身安全优先于取证和上报"],
    actions: [
      { title: "立即撤离", detail: "走安全楼梯到室外集合点。" },
      { title: "求助", detail: "联系物业或119，说明楼栋楼层。" },
      { title: "事后补报", detail: "安全后再整理情况说明。" },
    ],
    avoid: ["不要返回取物", "不要进入浓烟区域查看"],
    nextSteps: [
      { id: "emergency", label: "紧急求助", url: "/pages/emergency/emergency" },
      { id: "escape", label: "逃生路径", url: "/pages/building-escape/building-escape" },
    ],
    reportDraft: {
      type: "fire",
      location: "楼道",
      description: "业主反映闻到烟味，已按紧急流程撤离求助，请物业核查。",
      hazardName: "疑似烟火",
    },
  }),
  应急灯不亮怎么处理: card({
    role: "action",
    riskLevel: "medium",
    title: "应急灯异常：勿自行拆修",
    reply:
      "应急灯不亮会影响停电或烟雾中的疏散指示。请勿自行拆修电气部件，拍照后上报物业检修。",
    findings: ["疏散指示或应急照明可能失效"],
    actions: [
      { title: "记录位置", detail: "记下楼层、靠近哪户或哪个楼梯口。" },
      { title: "拍照上报", detail: "提交隐患工单，由物业安排电工检查。" },
    ],
    avoid: ["不要自行打开灯具接线"],
    nextSteps: [{ id: "report", label: "去上报", url: "/pages/report/report" }],
    reportDraft: {
      type: "equipment",
      location: "应急照明点位",
      description: "应急灯不亮，请物业检查供电与灯具状态。",
      hazardName: "应急灯故障",
    },
  }),

  // —— 文书 ——
  帮我写通道占用上报: card({
    role: "document",
    riskLevel: "high",
    title: "上报文书已拟好",
    reply:
      "已按「疏散通道占用」整理描述，可一键带入隐患上报。请核对楼层与具体位置后提交，本草稿不能代替物业正式受理。",
    findings: ["占用疏散通道属于高风险隐患", "建议附现场照片便于物业定位"],
    actions: [
      { title: "核对地点", detail: "确认是几楼、楼梯间还是走道。" },
      { title: "提交上报", detail: "把拟好的描述提交给物业值班台。" },
    ],
    avoid: ["不要自行将杂物搬到其他消防通道"],
    nextSteps: [{ id: "report", label: "填入并上报", url: "/pages/report/report" }],
    reportDraft: {
      type: "obstruction",
      location: "公共走廊/楼梯间",
      description:
        "公共走道或楼梯间堆放杂物（如纸箱、家具），占用疏散通道，影响紧急情况下通行。请物业安排清理并复核消防通道是否恢复畅通。",
      hazardName: "疏散通道占用",
    },
  }),
  帮我写烟味情况描述: card({
    role: "document",
    riskLevel: "emergency",
    title: "烟味情况描述已拟好",
    reply:
      "已起草烟味情况上报描述。紧急情况请先撤离并联系物业或119；安全后再核对地点并提交，本记录不作为已核实火警。",
    findings: ["人身安全优先于文书", "描述仅供事后补报与物业核查"],
    actions: [
      { title: "先保安全", detail: "若现场仍有烟味，先撤离再提交。" },
      { title: "提交补报", detail: "核对楼栋楼层后提交给物业。" },
    ],
    avoid: ["不要声称已经拨打119或物业已到场", "不要把草稿当成已派单"],
    nextSteps: [
      { id: "emergency", label: "紧急求助", url: "/pages/emergency/emergency" },
      { id: "report", label: "填入并上报", url: "/pages/report/report" },
    ],
    reportDraft: {
      type: "fire",
      location: "楼道",
      description:
        "业主反映楼道出现烟雾气味或疑似火情迹象。已提示先远离危险、走安全楼梯、勿乘电梯，并联系物业或119。请物业尽快现场核查；本记录仅为业主助手整理的上报草稿，不作为已核实火警。",
      hazardName: "疑似烟火",
    },
  }),
  帮我写消防设施被挡: card({
    role: "document",
    riskLevel: "medium",
    title: "设施被挡上报草稿已拟好",
    reply:
      "已按「消防设施被挡」整理上报描述，可一键带入隐患上报。请补充具体是灭火器、消火栓还是指示灯，以及所在楼层后提交。",
    findings: ["遮挡会影响紧急取用或疏散指示", "建议拍照留存"],
    actions: [
      { title: "补充设施类型", detail: "写明灭火器/消火栓/应急灯等。" },
      { title: "提交上报", detail: "由物业安排清理与复核。" },
    ],
    avoid: ["不要把消防器材当普通工具挪移使用"],
    nextSteps: [{ id: "report", label: "填入并上报", url: "/pages/report/report" }],
    reportDraft: {
      type: "equipment",
      location: "公共区域消防设施点位",
      description:
        "消防设施（如灭火器、消火栓或疏散指示灯）周边被杂物遮挡，影响可见与取用。请物业现场检查，清除遮挡并恢复设施可用状态。",
      hazardName: "消防设施被挡",
    },
  }),
};

function inferCard(role, text) {
  const exact = presets[text];
  if (exact) return { ...exact, role: role || exact.role };

  if (/帮我写/.test(text) && /烟|火/.test(text))
    return { ...presets["帮我写烟味情况描述"], role: "document" };
  if (/帮我写/.test(text) && /通道|占用|堵塞|纸箱|堆物/.test(text))
    return { ...presets["帮我写通道占用上报"], role: "document" };
  if (/帮我写/.test(text) && /设施|灭火器|消火栓|应急灯/.test(text))
    return { ...presets["帮我写消防设施被挡"], role: "document" };

  if (/烟|火|明火|燃烧|浓烟/.test(text)) {
    const base =
      role === "action"
        ? presets["有烟味先做什么"]
        : role === "document"
          ? presets["帮我写烟味情况描述"]
          : presets["楼道闻到烟味"];
    return { ...base, role };
  }
  if (/纸箱|堆物|堵塞|占用|走廊|楼道|通道|杂物/.test(text)) {
    const base =
      role === "action"
        ? presets["通道被堵了我该怎么办"]
        : role === "document"
          ? presets["帮我写通道占用上报"]
          : presets["走廊堆了纸箱"];
    return { ...base, role };
  }
  if (/灭火器|消火栓|应急灯|指示灯|设施/.test(text)) {
    const base =
      role === "action"
        ? presets["应急灯不亮怎么处理"]
        : role === "document"
          ? presets["帮我写消防设施被挡"]
          : presets["灭火器被杂物挡住"];
    return { ...base, role };
  }

  return card({
    role,
    riskLevel: "low",
    title: "需要多一点关键信息",
    reply:
      "请用一句话说明看到了什么、在哪一层。有烟火请先撤离；通道堆物、设施被挡也可以直接上报。",
    findings: ["当前信息还不足以判定具体隐患类型"],
    questions: ["具体位置在走廊、楼梯还是自家门口？", "是否看到烟、火或明显堆物？"],
    actions: [{ title: "可选动作", detail: "查看逃生图，或把现象写进隐患上报。" }],
    avoid: ["不要把助手建议当成已经派单"],
    nextSteps: [
      { id: "report", label: "去上报", url: "/pages/report/report" },
      { id: "escape", label: "逃生路径", url: "/pages/building-escape/building-escape" },
    ],
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assist(body) {
  const text = String((body.messages || []).at(-1)?.content || "").trim();
  const role = body.role || "identify";
  await delay(380 + Math.min(520, text.length * 12));
  const result = inferCard(role, text);
  return {
    reply: result.reply,
    card: result,
    model: {
      name: "qwen-plus",
      provider: "zhizengzeng",
      configured: true,
    },
  };
}

async function radar(sessionUser) {
  const binding =
    (sessionUser &&
      (sessionUser.bindings || []).find((item) => item.isCurrent)) ||
    (sessionUser && (sessionUser.bindings || [])[0]);
  return {
    configured: true,
    address: binding
      ? `${binding.communityName} ${binding.buildingName}${binding.unitName}${binding.floorNumber}层`
      : "",
    openReports: 0,
    notice: "",
    advice: binding
      ? "本址暂无待办隐患。发现通道占用、设施遮挡可随时问助手或上报。"
      : "绑定住址后，助手会结合本楼信息给出更贴身的建议。",
  };
}

module.exports = { assist, radar, inferCard, presets };
