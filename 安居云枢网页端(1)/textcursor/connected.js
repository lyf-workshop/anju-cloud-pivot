/* Shared view adapter for the existing multi-page property site. All business data comes from /api. */
(() => {
  const api = window.AnjuAPI;
  const page = location.pathname.split("/").pop() || "index.html";
  const apiPage = (target) => {
    const url = new URL(target, location.href);
    url.searchParams.set("mode", "api");
    return url.pathname + url.search + url.hash;
  };
  const routeLinks = (root) => {
    root.querySelectorAll("a[href]").forEach((link) => {
      const target = link.getAttribute("href");
      if (!link.hasAttribute("data-showcase") && /^[a-z-]+\.html(?:[?#]|$)/.test(target))
        link.setAttribute("href", apiPage(target));
    });
  };
  const main = document.querySelector("main");
  const subtitle = document.querySelector(".brand-text small");
  if (subtitle) {
    subtitle.textContent = "物业接口联调";
    subtitle.removeAttribute("title");
  }
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const date = (value) =>
    value
      ? new Date(value).toLocaleString("zh-CN", { hour12: false })
      : "暂无记录";
  const labels = {
    pending: "待处理",
    processing: "处理中",
    completed: "已完成",
    in_progress: "进行中",
    aborted: "已中止",
    fire: "消防隐患",
    obstruction: "通道堵塞",
    equipment: "设备问题",
    electrical: "用电安全",
    other: "其他隐患",
    online: "在线",
    offline: "离线",
    unknown: "未知",
    verified: "已审核",
    rejected: "未通过",
    alarm: "告警",
    clear: "解除事件",
    reading: "读数",
    heartbeat: "通信",
    unreviewed: "未审核",
    acknowledged: "已确认",
    closed: "处置已结束",
    false_positive: "已标记误报",
  };
  const label = (value) => esc(labels[value] || value);
  const status = (value) =>
    `<span class="api-status ${esc(value)}">${label(value)}</span>`;
  const button = (text, id = "", cls = "btn-primary") =>
    `<button type="button" class="btn ${cls}" ${id ? `id="${id}"` : ""}>${text}</button>`;
  const input = (name, title, type = "text", required = true) =>
    `<label>${title}<input name="${name}" type="${type}" ${required ? "required" : ""}></label>`;
  const field = (name, title, options) =>
    `<label>${title}<select name="${name}" required>${options}</select></label>`;
  const option = (value, title) =>
    `<option value="${esc(value)}">${esc(title)}</option>`;
  const textArea = (name, title) =>
    `<label>${title}<textarea name="${name}" rows="3" required minlength="2" maxlength="2000"></textarea></label>`;
  const card = (title, body) =>
    `<section class="api-card"><h2>${title}</h2>${body}</section>`;
  const table = (headers, rows) =>
    rows.length
      ? `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map((s) => `<th>${s}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((s) => `<td>${s}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      : '<div class="api-empty">暂无记录。保存操作后会在这里显示。</div>';
  let user,
    communityId,
    config,
    currentPage = 1,
    currentStatus = "",
    uploaded = new Map();
  const operations = new Map();
  const operationKey = (payload) => {
    const key = JSON.stringify(payload);
    if (!operations.has(key)) operations.set(key, api.key());
    return operations.get(key);
  };
  const q = (extra) =>
    new URLSearchParams({
      communityId,
      page: currentPage,
      pageSize: 20,
      ...extra,
    });
  const msg = (text, success = false) => {
    const element = document.getElementById("api-message");
    if (element) {
      element.textContent = text;
      element.className = "api-message" + (success ? " api-success" : "");
      element.scrollIntoView({ block: "nearest" });
    }
  };
  const frame = (
    title,
    body,
    description = config?.publicDemo
      ? "在线演示环境 · 操作会保存到独立演示数据库"
      : "本地后端联调 · 操作会保存到开发数据库",
  ) => {
    main.className = "api-main";
    main.innerHTML = `<div class="container"><div class="page-hero"><h1>${title}</h1><p>${description}</p></div><div id="api-message" role="status" aria-live="polite"></div>${body}</div>`;
    routeLinks(main);
    document.body.dataset.ready = "true";
  };
  const action = (element, task) => {
    element.addEventListener("click", async () => {
      if (element.disabled) return;
      element.disabled = true;
      msg("");
      try {
        await task();
      } catch (e) {
        showError(e);
      } finally {
        element.disabled = false;
      }
    });
  };
  function showError(error) {
    msg(error.message);
    if (error.status === 401 && page !== "login.html") {
      const area = document.getElementById("api-message");
      if (area) {
        const a = document.createElement("a");
        a.href = "login.html";
        a.textContent = " 重新登录";
        area.append(a);
      }
    }
  }
  function submit(form, task, reportError = showError) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity() || form.dataset.busy) return;
      form.dataset.busy = "true";
      const b = form.querySelector("[type=submit]");
      b.disabled = true;
      msg("");
      try {
        await task(Object.fromEntries(new FormData(form)), form);
      } catch (e) {
        reportError(e);
      } finally {
        delete form.dataset.busy;
        b.disabled = false;
      }
    });
  }
  function pagination(result, reload) {
    const container = document.createElement("div");
    container.className = "api-pagination";
    container.innerHTML = `${button("上一页", "prev", "btn-ghost")}<span>第 ${result.page} 页 · 共 ${result.total} 条</span>${button("下一页", "next", "btn-ghost")}`;
    main.querySelector(".container").append(container);
    container.querySelector("#prev").disabled = result.page <= 1;
    container.querySelector("#next").disabled =
      result.page * result.pageSize >= result.total;
    action(container.querySelector("#prev"), async () => {
      currentPage--;
      await reload();
    });
    action(container.querySelector("#next"), async () => {
      currentPage++;
      await reload();
    });
  }
  async function floors() {
    const buildings = await api.get(
      "/buildings?" + new URLSearchParams({ communityId }),
    );
    const details = await Promise.all(
      buildings.map((b) => api.get("/buildings/" + b.id)),
    );
    return details.flatMap((b) =>
      b.units.flatMap((u) =>
        u.floors.map((f) => ({
          ...f,
          name: `${b.name} ${u.name} ${f.number}层`,
        })),
      ),
    );
  }
  async function login() {
    const requested = new URLSearchParams(location.search).get("next") || "";
    const safeNext = /^\/[a-z-]+\.html$/.test(requested)
      ? apiPage(requested)
      : apiPage("index.html");
    try {
      await api.get("/staff/me");
      location.replace(safeNext);
      return;
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    frame(
      "物业工作台登录",
      `<div class="api-login">${card("安居云枢", `<form id="login-form"><label>物业账号<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></label><label>密码<input name="password" type="password" autocomplete="current-password" required></label><label class="api-check"><input name="remember" type="checkbox" value="true"> 在本机保持登录 7 天</label><button class="btn btn-primary api-login-submit" type="submit">登录物业工作台</button></form><p class="api-secondary">${config.staffDemoLogin ? "本地演示账号：property-demo<br>默认密码：AnjuLocal2026!（若已配置其他密码，请使用配置值）" : "请使用管理员分配的物业账号。连续输错密码会临时锁定账号。"}</p>`)}</div>`,
      "居民使用微信小程序；物业账号由管理员分配。",
    );
    const form = document.getElementById("login-form");
    if (config.staffDemoLogin) form.elements.username.value = "property-demo";
    submit(form, async (body) => {
      body.remember = form.elements.remember.checked;
      await api.post("/staff/auth/login", body);
      location.replace(safeNext);
    });
  }
  async function openSecurity() {
    document.getElementById("security-dialog")?.remove();
    const sessions = await api.get("/staff/auth/sessions");
    const dialog = document.createElement("dialog");
    dialog.id = "security-dialog";
    dialog.className = "security-dialog";
    dialog.innerHTML = `<div class="security-head"><div><small>账号安全</small><h2>${esc(user.nickname)}</h2><p>${esc(user.username)}</p></div><button type="button" class="modal-close" data-security-close aria-label="关闭">×</button></div>
      <div class="security-body"><div id="security-message" class="api-message" role="status" aria-live="polite"></div>
      <section><h3>当前登录</h3><p class="api-secondary">密码修改时间：${date(user.security.passwordChangedAt)}。修改密码后，其他设备会自动退出。</p>
      <div class="security-sessions">${sessions
        .map(
          (session) => `<article><div><strong>${esc(session.client)}${session.current ? " · 当前设备" : ""}</strong><small>最近使用 ${date(session.lastSeenAt)}<br>有效期至 ${date(session.expiresAt)}</small></div>${session.current ? '<span class="api-status completed">使用中</span>' : `<button type="button" class="btn btn-ghost" data-revoke-session="${esc(session.id)}">退出此设备</button>`}</article>`,
        )
        .join("")}</div></section>
      <section><h3>修改密码</h3><form id="password-form"><label>当前密码<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>新密码<input name="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="200" required></label><label>确认新密码<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="200" required></label><p class="api-secondary">至少 12 位，并同时包含大写字母、小写字母、数字和符号。</p><button class="btn btn-primary" type="submit">保存新密码</button></form></section>
      <div class="security-actions"><button type="button" class="btn btn-ghost" id="logout-all">退出全部设备</button><button type="button" class="btn btn-primary" data-security-close>完成</button></div></div>`;
    document.body.append(dialog);
    const securityMessage = (value, success = false) => {
      const target = dialog.querySelector("#security-message");
      target.textContent = value;
      target.className = "api-message" + (success ? " api-success" : "");
    };
    dialog.querySelectorAll("[data-security-close]").forEach((element) =>
      element.addEventListener("click", () => dialog.close()),
    );
    dialog.addEventListener("close", () => dialog.remove());
    dialog.querySelectorAll("[data-revoke-session]").forEach((element) =>
      element.addEventListener("click", async () => {
        element.disabled = true;
        try {
          await api.post("/staff/auth/sessions/revoke", {
            sessionId: element.dataset.revokeSession,
          });
          element.closest("article").remove();
          securityMessage("该设备已退出登录。", true);
        } catch (error) {
          element.disabled = false;
          securityMessage(error.message);
        }
      }),
    );
    const passwordForm = dialog.querySelector("#password-form");
    submit(passwordForm, async (body) => {
      if (body.newPassword !== body.confirmPassword) {
        securityMessage("两次输入的新密码不一致。");
        return;
      }
      delete body.confirmPassword;
      await api.post("/staff/auth/change-password", body);
      passwordForm.reset();
      securityMessage("密码已修改，其他设备已退出登录。", true);
    }, (error) => securityMessage(error.message));
    dialog.querySelector("#logout-all").addEventListener("click", async (event) => {
      event.currentTarget.disabled = true;
      try {
        await api.post("/staff/auth/logout-all", {});
        location.replace("login.html");
      } catch (error) {
        event.currentTarget.disabled = false;
        securityMessage(error.message);
      }
    });
    dialog.showModal();
  }
  async function overview() {
    const [s, devices, events, drills, notices] = await Promise.all([
      api.get("/staff/overview?" + q()),
      api.get("/staff/devices?" + q()),
      api.get("/staff/events?" + q()),
      api.get("/staff/drills?" + q()),
      api.get("/announcements?" + q()),
    ]);
    const metrics = [
      ["待处理隐患", s.pending],
      ["上报总数", s.reports],
      ["绑定居民", s.residents],
      ["完成演练", s.completedDrills],
      ["登记设备", s.devices],
    ];
    frame(
      "社区值班工作台",
      `<div class="api-metrics">${metrics.map(([name, count]) => card(name, `<strong>${count}</strong>`)).join("")}</div>
      <div class="api-toolbar"><a class="btn btn-primary" href="report.html">处理隐患工单</a><a class="btn btn-ghost" href="buildings.html">楼栋与设备</a>${button("刷新数据", "refresh")}</div>
      <div class="api-grid">${card("感知设备", deviceTable(devices.items))}${card("社区公告", notices.items.map((n) => `<h3>${esc(n.title)}</h3><p class="api-detail">${esc(n.body)}</p><small>${date(n.publishedAt)}</small>`).join("") || "<p>暂无公告</p>")}</div>
      ${card(
        "设备事件与人工处置",
        '<p class="api-secondary">目前未接入真实硬件。人工处置不修改原始事件，也不代表设备告警已解除。</p>' +
          table(
            ["设备 / 事件", "采集时间", "数据来源", "处置状态", "操作"],
            events.items.map((e) => [
              `${esc(e.deviceName)} / ${label(e.eventType)}`,
              date(e.occurredAt),
              e.isTest ? "演示事件" : esc(e.source),
              status(e.reviewStatus),
              ["closed", "false_positive"].includes(e.reviewStatus)
                ? "已归档"
                : `<button class="btn btn-ghost event-review" data-id="${esc(e.eventId)}" data-version="${e.version}">记录处置</button>`,
            ]),
          ),
      )}
      ${card(
        "线上演练记录",
        table(
          ["参与者", "场景", "状态", "步骤", "时长 / 时间"],
          drills.items.map((d) => [
            esc(d.nickname),
            esc(
              d.snapshot.communityName +
                " " +
                d.snapshot.buildingName +
                " " +
                d.snapshot.floorNumber +
                "层",
            ),
            status(d.status),
            `${d.completedSteps.length}/${d.totalSteps}`,
            `${d.durationSeconds} 秒<br>${date(d.completedAt || d.startedAt)}`,
          ]),
        ),
      )}
      ${card("发布社区公告", `<form id="notice-form">${input("title", "公告标题")}${textArea("body", "公告内容")}<button type="submit" class="btn btn-primary">发布公告</button></form>`)}`,
      esc(s.community.name) + " · 设备数据为固定演示，未连接摄像头或硬件",
    );
    action(document.getElementById("refresh"), overview);
    document.querySelectorAll(".event-review").forEach((b) =>
      action(b, async () => {
        const note = prompt("填写处置说明（至少2字，仅保存本地联调记录）：");
        if (note === null) return;
        const selected = prompt(
          "处置状态：acknowledged（确认）、closed（结束）、false_positive（误报）",
          "acknowledged",
        );
        if (!selected) return;
        const body = {
          expectedVersion: Number(b.dataset.version),
          status: selected,
          note,
        };
        await api.post(
          `/staff/events/${encodeURIComponent(b.dataset.id)}/review`,
          {
            ...body,
            idempotencyKey: operationKey({ id: b.dataset.id, ...body }),
          },
        );
        await overview();
        msg("人工处置记录已保存；设备原始状态保持独立。", true);
      }),
    );
    submit(document.getElementById("notice-form"), async (data) => {
      const body = { communityId, ...data };
      await api.post("/staff/announcements", {
        ...body,
        idempotencyKey: operationKey(body),
      });
      await overview();
      msg("公告已保存，小程序通知页可查看。", true);
    });
  }
  function deviceTable(devices) {
    return table(
      ["设备 / 位置", "连接 / 事件", "最近通信", "读数"],
      devices.map((d) => [
        `${esc(d.name)}<br><small>${esc(d.location)}</small>`,
        `${status(d.connectionStatus)} / ${label(d.eventStatus)}`,
        date(d.lastSeenAt),
        d.reading
          ? `${esc(d.reading.value)} ${esc(d.reading.unit)} · ${d.reading.freshness === "stale" ? "已过期" : "采集有效期内"}<br><small>${date(d.reading.collectedAt)} · ${esc(d.source)}</small>`
          : "暂无读数",
      ]),
    );
  }
  async function reports() {
    const [result, floorList] = await Promise.all([
      api.get(
        "/staff/reports?" + q(currentStatus ? { status: currentStatus } : {}),
      ),
      floors(),
    ]);
    frame(
      "隐患工单",
      `<div class="api-toolbar"><label>处理状态 <select id="report-filter">${option("", "全部")}${["pending", "processing", "completed"].map((s) => option(s, labels[s])).join("")}</select></label>${button("刷新", "refresh")}</div>
      ${card(
        "居民与物业上报",
        table(
          ["编号", "类型 / 位置", "状态", "时间", "操作"],
          result.items.map((r) => [
            esc(r.number),
            `${label(r.type)}<br>${esc(r.location)}`,
            status(r.status),
            date(r.createdAt),
            `<button class="btn btn-ghost report-open" data-id="${r.id}">查看与处理</button>`,
          ]),
        ),
      )}
      <div id="report-detail"></div>
      ${card("登记现场隐患", `<form id="connected-report-form">${field("floorId", "楼栋 / 楼层", floorList.map((f) => option(f.id, f.name)).join(""))}${field("type", "隐患类型", ["fire", "obstruction", "equipment", "electrical", "other"].map((s) => option(s, labels[s])).join(""))}${input("location", "具体位置")}${textArea("description", "情况描述（至少5字）")}${input("contact", "回访电话", "tel")}<label>现场照片（最多3张，每张不超过5MB）<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><p class="api-secondary">图片保存至${config.publicDemo ? "服务器演示库" : "本地后端"}；演示联调请勿填写真实个人信息。</p><button class="btn btn-primary" type="submit">保存上报</button></form>`)}`,
    );
    document.getElementById("report-filter").value = currentStatus;
    document.getElementById("report-filter").onchange = async (e) => {
      currentStatus = e.target.value;
      currentPage = 1;
      try {
        await reports();
      } catch (err) {
        showError(err);
      }
    };
    action(document.getElementById("refresh"), reports);
    pagination(result, reports);
    document
      .querySelectorAll(".report-open")
      .forEach((b) => action(b, () => reportDetail(b.dataset.id)));
    const form = document.getElementById("connected-report-form");
    const draftKey = "anju:report:" + user.id + ":" + communityId;
    const draft = JSON.parse(sessionStorage.getItem(draftKey) || "null");
    if (draft)
      for (const [key, value] of Object.entries(draft.fields || {}))
        if (form.elements[key] && key !== "photos")
          form.elements[key].value = value;
    let submissionKey = draft?.key || api.key();
    const fields = () => ({
      floorId: form.elements.floorId.value,
      type: form.elements.type.value,
      location: form.elements.location.value,
      description: form.elements.description.value,
      contact: form.elements.contact.value,
    });
    form.addEventListener("input", () =>
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ key: submissionKey, fields: fields() }),
      ),
    );
    submit(form, async () => {
      const files = [...form.elements.photos.files];
      if (
        files.length > 3 ||
        files.some(
          (f) =>
            f.size > 5 * 1024 * 1024 ||
            !["image/png", "image/jpeg", "image/webp"].includes(f.type),
        )
      )
        throw new Error("请选择最多3张 JPG/PNG/WebP 图片，每张不超过5MB");
      const data = fields();
      if (data.description.trim().length < 5) throw new Error("描述至少5字");
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ key: submissionKey, fields: data }),
      );
      let saved;
      try {
        saved = await api.get("/reports/submission/" + submissionKey);
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      if (!saved) {
        const attachmentIds = [];
        for (const f of files) {
          if (!uploaded.has(f)) uploaded.set(f, (await api.upload(f)).id);
          attachmentIds.push(uploaded.get(f));
        }
        saved = await api.post("/reports", {
          ...data,
          attachmentIds,
          idempotencyKey: submissionKey,
        });
      }
      sessionStorage.removeItem(draftKey);
      uploaded.clear();
      currentPage = 1;
      currentStatus = "";
      await reports();
      await reportDetail(saved.id);
      msg("上报已保存：" + saved.number, true);
    });
    const selected = new URLSearchParams(location.search).get("id");
    if (selected) await reportDetail(selected);
  }
  async function reportDetail(id) {
    const [r, members] = await Promise.all([
      api.get("/staff/reports/" + encodeURIComponent(id)),
      api.get("/staff/members?" + q()),
    ]);
    history.replaceState(
      null,
      "",
      apiPage("report.html?id=" + encodeURIComponent(r.id)),
    );
    const box = document.getElementById("report-detail");
    box.innerHTML = card(
      `工单 ${esc(r.number)}`,
      `<div class="api-toolbar">${status(r.status)}<span>版本 ${r.version} · ${date(r.createdAt)}</span></div><p>${esc(r.location)}</p><p class="api-detail">${esc(r.description)}</p><p>联系方式：${esc(r.contact)}</p><div class="api-photos">${r.attachmentIds.map((a) => `<a href="/api/attachments/${a}" target="_blank" rel="noopener"><img src="/api/attachments/${a}" alt="现场上报图片"></a>`).join("")}</div><ol>${r.events.map((e) => `<li>${date(e.occurredAt)} · ${esc(e.message)}</li>`).join("")}</ol>${
        r.status === "completed"
          ? '<p class="api-success">工单已完成</p>'
          : `<form id="work-form">${field("status", "本次处理", r.status === "pending" ? option("processing", "受理并开始处理") : option("processing", "补充处理进展") + option("completed", "处理完成"))}${field(
              "assigneeId",
              "处理人",
              members
                .filter((m) => m.role !== "viewer")
                .map((m) => option(m.id, m.nickname))
                .join(""),
            )}${textArea("message", "处理说明")}<button type="submit" class="btn btn-primary">保存处理进度</button></form>`
      }`,
    );
    const form = document.getElementById("work-form");
    if (form) {
      form.elements.assigneeId.value = r.assigneeId || user.id;
      submit(form, async (data) => {
        const body = { expectedVersion: r.version, ...data };
        await api.post(`/staff/reports/${r.id}/actions`, {
          ...body,
          idempotencyKey: operationKey({ id: r.id, ...body }),
        });
        await reports();
        await reportDetail(r.id);
        msg("处理进度已保存，居民端刷新后可查看。", true);
      });
    }
    box.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  async function people() {
    const result = await api.get("/staff/residents?" + q());
    frame(
      "居民住址台账",
      card(
        "已提交的住址绑定",
        table(
          ["居民", "楼栋 / 房号", "审核状态", "操作"],
          result.items.map((r) => [
            esc(r.nickname),
            `${esc(r.buildingName)} ${esc(r.unitName)} ${r.floorNumber}层 ${esc(r.room)}`,
            status(r.verification),
            `<button class="btn btn-ghost verify-binding" data-id="${r.id}">审核</button>`,
          ]),
        ),
      ),
      "仅展示本社区授权数据。住址绑定与审核分别记录；未收集老人、儿童或健康情况。",
    );
    pagination(result, people);
    document.querySelectorAll(".verify-binding").forEach((b) =>
      action(b, async () => {
        const reason = prompt(
          "请填写审核依据（至少2字；本地联调不要填写真实身份信息）：",
        );
        if (reason === null) return;
        const verified = confirm("确认审核通过？点击取消将记为“审核未通过”。");
        await api.patch("/staff/bindings/" + b.dataset.id, {
          verification: verified ? "verified" : "rejected",
          reason,
        });
        await people();
        msg("审核结果已保存。", true);
      }),
    );
  }
  async function buildings() {
    const [list, devices] = await Promise.all([
      api.get("/buildings?" + q()),
      api.get("/staff/devices?" + q()),
    ]);
    const details = await Promise.all(
      list.map((b) => api.get("/buildings/" + b.id)),
    );
    frame(
      "楼栋与感知设备",
      `<div class="api-grid">${details.map((b) => card(esc(b.name), b.units.map((u) => `<p>${esc(u.name)} · ${u.floors.length}层</p><details><summary>查看楼层说明</summary>${u.floors.map((f) => `<p>${f.number}层：${esc(f.exitText)}</p>`).join("")}</details>`).join(""))).join("")}</div>${card("设备最近观测", deviceTable(devices.items))}`,
      "楼栋资料来自共享目录；连接状态、事件状态和数据时效分别展示，未接入真实硬件。",
    );
    pagination(devices, buildings);
  }
  async function inspections() {
    const [result, floorList] = await Promise.all([
      api.get("/staff/inspections?" + q()),
      floors(),
    ]);
    frame(
      "巡查台账",
      card(
        "历史巡查",
        table(
          ["时间", "位置", "结果", "说明", "登记人"],
          result.items.map((i) => [
            date(i.createdAt),
            esc(i.location),
            i.result === "clear" ? "本次未发现问题" : "发现问题",
            esc(i.description),
            esc(i.nickname),
          ]),
        ),
      ) +
        card(
          "登记巡查",
          `<form id="inspection-form">${field("floorId", "巡查楼层", floorList.map((f) => option(f.id, f.name)).join(""))}${input("location", "巡查位置")}${field("result", "本次结果", option("clear", "本次未发现问题") + option("issue", "发现问题"))}${textArea("description", "巡查说明")}<button class="btn btn-primary" type="submit">保存巡查</button></form>`,
        ),
    );
    pagination(result, inspections);
    submit(document.getElementById("inspection-form"), async (data) => {
      const body = { communityId, ...data };
      await api.post("/staff/inspections", {
        ...body,
        idempotencyKey: operationKey(body),
      });
      await inspections();
      msg("巡查记录已保存。发现的问题可在隐患工单中登记。", true);
    });
  }
  async function duties() {
    const [result, members] = await Promise.all([
      api.get("/staff/duties?" + q()),
      api.get("/staff/members?" + q()),
    ]);
    frame(
      "值班安排",
      card(
        "值班记录",
        table(
          ["任务", "值班员", "开始", "结束", "备注"],
          result.items.map((d) => [
            esc(d.title),
            esc(d.nickname),
            date(d.startsAt),
            date(d.endsAt),
            esc(d.note),
          ]),
        ),
      ) +
        card(
          "安排值班",
          `<form id="duty-form">${input("title", "值班任务")}${field("assigneeId", "值班员", members.map((m) => option(m.id, m.nickname)).join(""))}${input("startsAt", "开始时间", "datetime-local")}${input("endsAt", "结束时间", "datetime-local")}${input("note", "备注", "text", false)}<button type="submit" class="btn btn-primary">保存安排</button></form>`,
        ),
    );
    pagination(result, duties);
    submit(document.getElementById("duty-form"), async (data) => {
      const body = {
        communityId,
        ...data,
        startsAt: new Date(data.startsAt).toISOString(),
        endsAt: new Date(data.endsAt).toISOString(),
      };
      await api.post("/staff/duties", {
        ...body,
        idempotencyKey: operationKey(body),
      });
      await duties();
      msg("值班安排已保存。", true);
    });
  }
  async function publicPage() {
    if (page === "emergency.html") {
      frame(
        "紧急联系方式",
        card(
          "消防救援",
          `<h2>${esc(config.emergencyPhone)}</h2><p>本地联调仅展示拨号提示，不实际拨打。</p>${button("查看消防电话提示", "fire-call")}`,
        ) +
          card(
            "物业联系",
            `<p>${esc(config.propertyPhone || "物业号码尚未核实配置")}</p><p>更新：${date(config.propertyUpdatedAt)}</p>${button("查看物业联系提示", "property-call", "btn-ghost")}`,
          ) +
          card(
            "现场情况",
            '<p>紧急情况上报不等于救援受理。</p><a class="btn btn-primary" href="report.html">物业现场登记</a>',
          ),
        "公共信息，无需登录。线上演练示意不能作为实时火场安全路线。",
      );
      action(document.getElementById("fire-call"), async () =>
        alert("演示提示：消防电话为119。本次不会拨号，也不表示救援已受理。"),
      );
      action(document.getElementById("property-call"), async () =>
        alert(
          config.propertyPhone
            ? "本次只展示联系流程，不实际拨号。"
            : "物业号码未核实配置，请联系社区工作人员。",
        ),
      );
    } else {
      const notices = await api.get("/announcements?pageSize=20");
      frame(
        "社区公告与使用说明",
        card("服务说明", `<p class="api-detail">${esc(config.help)}</p>`) +
          notices.items
            .map((n) =>
              card(
                esc(n.title),
                `<p class="api-detail">${esc(n.body)}</p><small>${date(n.publishedAt)} · ${esc(n.source)}</small>`,
              ),
            )
            .join(""),
        "公开信息。处置预案须由物业核实后发布，当前不提供自动疏散决策。",
      );
    }
  }
  const render = () =>
    (
      ({
        "index.html": overview,
        "report.html": reports,
        "people.html": people,
        "buildings.html": buildings,
        "inspection.html": inspections,
        "duty.html": duties,
      })[page] || overview
    )();
  async function start() {
    frame("正在连接服务", "<p>正在读取数据…</p>");
    try {
      config = await api.get("/config");
      if (page === "login.html") return login();
      if (["emergency.html", "knowledge.html"].includes(page))
        return await publicPage();
      try {
        user = await api.get("/staff/me");
      } catch (e) {
        if (e.status === 401) {
          location.replace("login.html");
          return;
        }
        throw e;
      }
      if (!user.communities.length)
        throw new Error("当前物业账号尚未分配社区，请联系管理员。");
      communityId = sessionStorage.getItem("anju:community:" + user.id);
      if (!user.communities.some((c) => c.communityId === communityId))
        communityId = user.communities[0].communityId;
      const bar = document.createElement("div");
      bar.className = "connection-bar";
      bar.innerHTML = `<strong>${config.publicDemo ? "在线演示" : config.mode === "demo" ? "本地联调" : "物业工作台"}</strong><span>${esc(user.nickname)}</span><label>当前社区 <select id="community-select">${user.communities.map((c) => option(c.communityId, c.communityName)).join("")}</select></label><span class="connection-actions">${button("账号安全", "security", "btn-ghost")}${button("退出登录", "logout", "btn-ghost")}</span>`;
      main.before(bar);
      const originalSite = document.createElement("a");
      originalSite.href = "index.html";
      originalSite.className = "btn btn-ghost";
      originalSite.textContent = "返回原版网页";
      bar.append(originalSite);
      document.getElementById("community-select").value = communityId;
      document.getElementById("community-select").onchange = async (e) => {
        communityId = e.target.value;
        currentPage = 1;
        history.replaceState(null, "", apiPage(page));
        sessionStorage.setItem("anju:community:" + user.id, communityId);
        try {
          await render();
        } catch (err) {
          frame("加载失败", button("重试", "retry"));
          showError(err);
          action(document.getElementById("retry"), render);
        }
      };
      action(document.getElementById("security"), openSecurity);
      action(document.getElementById("logout"), async () => {
        await api.post("/staff/auth/logout", {});
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith("anju:"))
          .forEach((k) => sessionStorage.removeItem(k));
        location.replace("login.html");
      });
      await render();
    } catch (e) {
      frame("暂时无法加载", button("重新连接", "retry"));
      showError(e);
      action(document.getElementById("retry"), async () => location.reload());
    }
  }
  document.querySelectorAll('a[href^="tel:"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      alert("本地联调不实际拨号，请在紧急联系方式页查看配置。");
    }),
  );
  const footer = document.querySelector(".site-footer");
  if (footer)
    footer.innerHTML =
      '<div class="container footer-inner"><strong>安居云枢 · 社区服务</strong><p>本地联调环境 · 未接入真实硬件 · 数据保存在本机后端</p></div>';
  routeLinks(document);
  start();
})();
