(() => {
  const dock = document.querySelector("#agent-dock");
  const workspace = document.querySelector("#agent-workspace");
  const root = dock || workspace;
  if (!root || !window.AnjuAPI) return;
  const panel = root.querySelector("#agent-panel");
  const log = root.querySelector("#agent-log");
  const form = root.querySelector("#agent-form");
  const input = root.querySelector("#agent-input");
  const status = root.querySelector("#agent-status");
  const toggle = dock?.querySelector("#agent-toggle");
  const messages = [];
  let communityId = "";
  const CAMERA_ID = "CAM-RPI-01";
  const DEMO_TICKET_QUERY =
    "请调取工单WY-20261005-001，识别安全隐患，给出物业处置方案";

  const isDemoTicket = (text) => {
    const t = String(text || "").replace(/\s/g, "");
    return /WY-20261005-001/i.test(t) || (t.includes("消防通道") && t.includes("杂物"));
  };

  const demoTicketHtml = () => `<div class="agent-ticket">
      <section class="ticket-block">
        <h4>工单详情</h4>
        <dl class="ticket-meta">
          <div><dt>工单编号</dt><dd>WY-20261005-001</dd></div>
          <div><dt>工单标题</dt><dd>楼道消防通道堆放废弃杂物</dd></div>
          <div><dt>位置</dt><dd>XX小区 3号楼 2单元 1层楼道消防通道门口</dd></div>
          <div><dt>现场情况</dt><dd>业主长期在消防通道出入口堆积旧纸箱、废旧家具、闲置自行车等杂物，占用全部疏散通道。杂物属易燃物品，通道被堵塞，发生火情时人员无法疏散；消防通道标识被纸箱、木板、旧椅子遮挡，存在重大消防安全隐患。</dd></div>
        </dl>
      </section>
      <section class="ticket-block">
        <h4>风险识别</h4>
        <dl class="ticket-meta">
          <div><dt>隐患类型</dt><dd>消防疏散通道堵塞 + 易燃堆物。</dd></div>
          <div><dt>危害</dt><dd>一旦起火，1层出口失效，整单元人员无法向外疏散，火势可沿纸箱、木器迅速蔓延至楼梯间；同时违反消防通道严禁占用的强制性要求，属于高风险、需立即处置的重大隐患。</dd></div>
        </dl>
      </section>
      <section class="ticket-block">
        <h4>处置方案</h4>
        <ol>
          <li>值班员 5 分钟内到达现场，拍照取证（含楼层号、通道标识、堆物全貌）。</li>
          <li>能立即移开的纸箱、自行车当场清出通道，恢复疏散宽度。</li>
          <li>大件家具当场无法清运的，张贴《消防通道整改通知》，限期 24 小时清运。</li>
          <li>建立安全工单派秩序组巡查、工程组协助清运；拒不配合的升级项目经理，按业主公约书面告知。</li>
          <li>对责任业主进行消防劝导：楼道禁止堆放易燃杂物，占用消防通道将影响整栋疏散。</li>
        </ol>
      </section>
      <section class="ticket-block">
        <h4>闭环跟进</h4>
        <ol>
          <li>当日交班复核通道是否已恢复畅通。</li>
          <li>24 小时内复检，逾期未清运由工程协助清运并记录。</li>
          <li>纳入本周消防巡查台账，下周抽查该单元是否回潮。</li>
          <li>工单状态：现场清理完成后标记「已完成」，照片与整改通知随单归档。</li>
        </ol>
      </section>
    </div>`;

  if (input && !input.value.trim()) input.value = DEMO_TICKET_QUERY;

  const esc = (value) =>
    String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const setStatus = (text) => {
    if (status) status.textContent = text;
  };

  const add = (role, html) => {
    if (!log) return;
    const item = document.createElement("article");
    item.className = "agent-msg agent-msg-" + role;
    item.innerHTML = html;
    log.append(item);
    log.scrollTop = log.scrollHeight;
  };

  const toolsHtml = (tools) => {
    if (!tools?.length) return "";
    return (
      `<ul class="agent-tools">` +
      tools
        .map(
          (item) =>
            `<li>已调用 ${esc(item.name)}</li>`,
        )
        .join("") +
      `</ul>`
    );
  };

  const proposalHtml = (proposal) => {
    if (!proposal) return "";
    return `<div class="agent-proposal" data-proposal="${encodeURIComponent(JSON.stringify(proposal))}">
      <p>待确认：将工单 ${esc(proposal.number || proposal.reportId)} 标记为 ${esc(proposal.status === "processing" ? "已受理" : "已完成")}。</p>
      <p>${esc(proposal.message)}</p>
      <button type="button" class="btn btn-primary" data-confirm-proposal>确认写入工单</button>
    </div>`;
  };

  const loadSession = async () => {
    try {
      const me = await window.AnjuAPI.get("/staff/me");
      communityId = me.communities?.[0]?.communityId || "";
      const info = await window.AnjuAPI.get("/staff/agent/status");
      root.dataset.ready = "1";
      setStatus(
        info.configured
          ? `智增增 · ${info.model}`
          : "未配置密钥，当前使用本地工具摘要",
      );
      add(
        "assistant",
        workspace
          ? "<p>已进入物业服务工作台。演示可直接发送输入框中的工单样例：调取 <code>WY-20261005-001</code> 识别隐患并给出处置方案。</p>"
          : "<p>已登录值班台。演示可直接发送：调取工单 WY-20261005-001，识别安全隐患，给出物业处置方案。</p>",
      );
    } catch {
      root.dataset.ready = "0";
      setStatus("需要物业登录");
      add(
        "assistant",
        `<p>演示工单已内置。输入框已填好样例，直接点发送即可调取 <code>WY-20261005-001</code>。其他问询请先 <a href="login.html">登录物业账号</a>。</p>`,
      );
    }
  };

  toggle?.addEventListener("click", () => {
    const open = dock.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    if (panel) panel.hidden = !open;
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = (input?.value || "").trim();
    if (!text) return;
    if (isDemoTicket(text)) {
      input.value = DEMO_TICKET_QUERY;
      add("user", `<p>${esc(text)}</p>`);
      add("assistant", demoTicketHtml());
      setStatus("已调取内置工单 WY-20261005-001");
      return;
    }
    if (root.dataset.ready !== "1") return;
    input.value = DEMO_TICKET_QUERY;
    messages.push({ role: "user", content: text });
    add("user", `<p>${esc(text)}</p>`);
    setStatus("正在查询…");
    try {
      const data = await window.AnjuAPI.post("/staff/agent/chat", {
        communityId,
        cameraId: CAMERA_ID,
        messages,
      });
      messages.push({ role: "assistant", content: data.reply });
      add(
        "assistant",
        `<p>${esc(data.reply)}</p>${toolsHtml(data.tools)}${proposalHtml(data.proposal)}`,
      );
      setStatus(
        data.model?.provider === "zhizengzeng"
          ? `智增增 · ${data.model.name}`
          : "本地工具摘要",
      );
    } catch (error) {
      messages.pop();
      add("assistant", `<p>${esc(error.message || "智能体暂时不可用")}</p>`);
      setStatus("请求失败");
    }
  });

  log?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-confirm-proposal]");
    if (!button) return;
    const box = button.closest("[data-proposal]");
    let proposal;
    try {
      proposal = JSON.parse(
        decodeURIComponent(box.getAttribute("data-proposal") || ""),
      );
    } catch {
      return;
    }
    button.disabled = true;
    try {
      const saved = await window.AnjuAPI.post(
        "/staff/reports/" + proposal.reportId + "/actions",
        {
          idempotencyKey: window.AnjuAPI.key(),
          expectedVersion: proposal.expectedVersion,
          status: proposal.status,
          message: proposal.message,
        },
      );
      button.replaceWith(
        Object.assign(document.createElement("p"), {
          textContent: "已写入工单 " + (saved.number || "") + "，状态 " + saved.status,
        }),
      );
    } catch (error) {
      button.disabled = false;
      add("assistant", `<p>${esc(error.message || "写入失败")}</p>`);
    }
  });

  loadSession();
})();
