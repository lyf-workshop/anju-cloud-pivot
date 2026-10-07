import { assistChips, assistRoles } from "./assistant.js";

const A = "./assets";

const statusNames = {
  pending: "待处理",
  processing: "处理中",
  completed: "已完成",
  in_progress: "进行中",
  aborted: "已中止",
  online: "在线示例",
  offline: "离线",
  unknown: "状态未知",
};

const typeNames = {
  fire: "消防隐患",
  obstruction: "安全通道",
  equipment: "设施故障",
  electrical: "用电电路",
  other: "其他隐患",
};

export const hazardCategories = [
  {
    id: "passage",
    name: "安全通道",
    legacyType: "obstruction",
    items: [
      ["exit-locked", "安全出口上锁", "hazard-exit-locked.png"],
      ["no-sign-light", "缺少疏散指示/应急照明", "hazard-no-sign-light.png"],
      ["exit-blocked", "杂物堵塞安全出口", "hazard-exit-blocked.png"],
      ["fire-lane", "违规占用消防通道", "hazard-ebike-scene.jpg"],
    ],
  },
  {
    id: "fire-equip",
    name: "消防器材",
    legacyType: "fire",
    items: [
      ["hose-corroded", "水带腐蚀严重", "hazard-hose-corroded.png"],
      ["hydrant-incomplete", "消火栓配置不齐", "hazard-hydrant-incomplete.png"],
      ["hydrant-nowater", "消火栓无水", "hazard-hydrant-nowater.png"],
      ["extinguisher-expired", "灭火器过期", "fire.png"],
    ],
  },
  {
    id: "ebike",
    name: "电动车",
    legacyType: "fire",
    items: [
      ["ebike-flying-wire", "电动车飞线充电", "hazard-ebike-scene.jpg"],
      ["ebike-elevator", "电动车/电池进电梯", "hazard-ebike-scene.jpg"],
    ],
  },
  {
    id: "electrical",
    name: "用电电路",
    legacyType: "electrical",
    items: [
      ["circuit-aging", "电路老化", "electrical.png"],
      ["outlet-damage", "公共用电设施损坏", "electrical.png"],
    ],
  },
  {
    id: "other",
    name: "其他",
    legacyType: "other",
    items: [["custom", "自己补充", "equipment.png", true]],
  },
].map((category) => ({
  ...category,
  items: category.items.map(([id, name, image, custom = false]) => ({
    id,
    name,
    image: `${A}/illustrations/${image}`,
    custom,
  })),
}));

export const esc = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const dateText = (value) => {
  if (!value) return "暂无记录";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const durationText = (seconds = 0) => {
  const value = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
};

const syncTime = (value) => {
  if (!value) return "等待首次同步";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const icon = (name, active = false, extra = "") =>
  `<img class="line-icon ${extra}" src="${A}/icons/${esc(name)}${active ? "-active" : ""}.png" alt="" />`;

const badge = (status, label = statusNames[status] || status) =>
  `<span class="pill status-${esc(status)}">${esc(label)}</span>`;

const empty = (text) =>
  `<div class="empty"><div class="empty-mark">◇</div><p>${esc(text)}</p></div>`;

const nav = [
  ["home", "home", "首页"],
  ["hazards", "hazard", "隐患"],
  ["assist", "help", "助手"],
  ["building", "cube", "楼栋"],
  ["me", "user", "我的"],
];

function activeRoot(route) {
  if (["hazards", "report", "my-reports"].includes(route) || route.startsWith("report/")) return "hazards";
  if (route === "assist") return "assist";
  if (route === "building" || route === "devices" || route.startsWith("building-")) return "building";
  if (["me", "profile", "drill-records", "notices", "help", "emergency"].includes(route)) return "me";
  if (route.startsWith("drill") || route.startsWith("summary/")) return "building";
  return "home";
}

function navItems(active) {
  return nav
    .map(
      ([route, name, label]) => `<button class="nav-item ${route === "assist" ? "nav-main" : ""} ${active === route ? "active" : ""}" data-route="${route}">
        ${icon(name, active === route)}<span>${label}</span>
      </button>`,
    )
    .join("");
}

export function welcomeView(state) {
  return `<main class="welcome login-page">
    <section class="welcome-panel">
      <div class="brand">
        <img class="brand-logo" src="${A}/illustrations/login-logo.png" alt="安居云枢标志" />
        <h1>安居云枢</h1>
        <p>让社区安全，看得见，也触手可及。</p>
      </div>
      <div class="login-illustration"><img src="${A}/illustrations/building.png" alt="社区楼栋插画" /></div>
      <div class="login-intro"><h2>欢迎加入安心社区</h2><p>进入后查看楼栋信息、上报隐患并保存你的演练记录</p></div>
      ${state.error ? `<div class="error-box" role="alert">${esc(state.error)}</div>` : ""}
      <button class="primary-button direct-button" data-action="direct" ${state.busy ? "disabled" : ""}>
        ${state.busy ? "正在连接安全演示环境…" : "直接体验"}
      </button>
      <p class="privacy-note">无需账号密码 · 首次进入自动领取仅属于本机的匿名演示会话</p>
      <div class="future-login"><strong>正式账号入口</strong><span>预留 · 本阶段不开放</span></div>
      <p class="login-footer">评审演示登录，不读取真实微信资料<br />关注隐患 · 让安全更简单</p>
    </section>
  </main>`;
}

const householdSituations = [
  ["bedridden", "卧床", "situation-bedridden.png"],
  ["wheelchair", "轮椅", "situation-wheelchair.png"],
  ["mobility", "行动不便", "situation-mobility.png"],
  ["vision", "视力障碍", "situation-vision.png"],
  ["hearing", "听力障碍", "situation-hearing.png"],
  ["pregnant", "孕妇", "situation-pregnant.png"],
];

function onboardingSteps(step) {
  return `<div class="register-steps" aria-label="登记进度">
    <span class="register-step-dot ${step === 1 ? "active" : "done"}">1</span>
    <i class="${step === 2 ? "active" : ""}"></i>
    <span class="register-step-dot ${step === 2 ? "active" : ""}">2</span>
  </div>`;
}

export function registerView(state) {
  const step = state.onboardingStep || 1;
  const draft = state.onboardingDraft || {};
  const units = state.building?.units || [];
  const selectedUnit = units.find((item) => item.id === draft.unitId) || units[0];
  const floors = selectedUnit?.floors || [];
  const errors = state.onboardingErrors || {};
  const people = [
    ["elderly", "老人", "icon-elderly.png"],
    ["children", "小孩", "icon-children.png"],
    ["pets", "宠物", "icon-pets.png"],
  ];
  const canNext = Boolean(draft.unitId && draft.floorId && String(draft.room || "").trim() && Number(draft.familyCount) >= 1);

  return `<section class="page register-page">
    <button class="register-home-button" data-action="onboarding-home" aria-label="暂不补充，进入首页" title="进入首页">${icon("home")}</button>
    <header class="register-hero">
      <p>${state.editingOnboarding ? "编辑住户资料" : "您好，欢迎来到温暖社区"}</p>
      <h1>${step === 1 ? "人口登记" : "家庭成员情况"}</h1>
      <span>${step === 1 ? "填写住址与家庭人数，方便社区应急关注" : "补充重点人群与特殊情况，便于安全服务（均可选填）"}</span>
      ${onboardingSteps(step)}
    </header>
    <div class="demo-data-note"><b>演示资料</b><span>系统已填入匿名演示住址，无需填写真实个人信息。</span></div>
    ${state.error ? `<div class="error-box" role="alert">${esc(state.error)}</div>` : ""}
    ${step === 1 ? `<form id="onboarding-form" class="card register-card">
      <label class="register-field"><span>单元 <i>*</i></span><select name="unitId" data-action="onboarding-unit" class="${errors.unitId ? "has-error" : ""}">
        ${units.map((item) => `<option value="${esc(item.id)}" ${item.id === draft.unitId ? "selected" : ""}>${esc(item.name)}</option>`).join("")}
      </select>${errors.unitId ? `<em>${esc(errors.unitId)}</em>` : ""}</label>
      <label class="register-field"><span>层数 <i>*</i></span><select name="floorId" data-action="onboarding-floor" class="${errors.floorId ? "has-error" : ""}">
        ${floors.map((item) => `<option value="${esc(item.id)}" ${item.id === draft.floorId ? "selected" : ""}>${item.number}层</option>`).join("")}
      </select>${errors.floorId ? `<em>${esc(errors.floorId)}</em>` : ""}</label>
      <label class="register-field"><span>房号 <i>*</i></span><input name="room" data-onboarding-field="room" maxlength="20" value="${esc(draft.room)}" class="${errors.room ? "has-error" : ""}" placeholder="请输入房间号" />${errors.room ? `<em>${esc(errors.room)}</em>` : ""}</label>
      <label class="register-field"><span>家庭人数 <i>*</i></span><input name="familyCount" data-onboarding-field="familyCount" type="number" min="1" max="99" inputmode="numeric" value="${esc(draft.familyCount)}" class="${errors.familyCount ? "has-error" : ""}" placeholder="请输入家庭人数" />${errors.familyCount ? `<em>${esc(errors.familyCount)}</em>` : ""}</label>
      <button type="submit" class="register-next ${canNext ? "ready" : "pending"}" ${state.busy ? "disabled" : ""}>→ 下一步</button>
    </form>` : `<div class="register-step-two">
      <section class="card register-card">
        <h2>重点人群</h2><p class="register-hint">选填 · 默认 0，可不改</p>
        <div class="people-grid">${people.map(([key, label, image]) => `<article class="people-tile"><span><img src="${A}/illustrations/${image}" alt="" /></span><strong>${label}</strong><div><button data-action="onboarding-adjust" data-key="${key}" data-delta="-1" aria-label="减少${label}">−</button><b>${Number(draft[key] || 0)}</b><button data-action="onboarding-adjust" data-key="${key}" data-delta="1" aria-label="增加${label}">+</button></div></article>`).join("")}</div>
      </section>
      <section class="card register-card">
        <h2>家庭人员情况</h2><p class="register-hint">选填 · 点选图标即可，可多选</p>
        <div class="situation-grid">${householdSituations.map(([id, label, image]) => `<button class="situation-tile ${(draft.situations || []).includes(id) ? "active" : ""}" data-action="onboarding-situation" data-id="${id}"><img src="${A}/illustrations/${image}" alt="" /><span>${label}</span></button>`).join("")}</div>
      </section>
      <div class="register-actions"><button class="secondary-button" data-action="onboarding-back">上一步</button><button class="register-skip" data-action="onboarding-skip" ${state.busy ? "disabled" : ""}>跳过此部分</button><button class="primary-button" data-action="onboarding-save" ${state.busy ? "disabled" : ""}>${state.busy ? "保存中…" : "保存"}</button></div>
    </div>`}
    ${state.showOnboardingPrivacy ? `<div class="privacy-mask" role="dialog" aria-modal="true" aria-labelledby="privacy-title"><div class="privacy-dialog"><h2 id="privacy-title">信息隐私说明</h2><p>本模块信息属于<strong>私密信息</strong>，仅在发生紧急突发事件时，才会提交给社区物业用于应急救援；</p><p>日常不会对外泄露，仅用于社区应急关怀服务。</p><button class="primary-button" data-action="onboarding-privacy">我已知晓</button></div></div>` : ""}
  </section>`;
}

export function registerDoneView() {
  return `<section class="page register-done-page">
    <div class="success-circle">${icon("check", true)}</div>
    <h1 class="center">登记完成</h1>
    <p class="center muted">感谢你的填写，社区应急关怀会更有温度</p>
    <div class="card register-done-card"><p>住址信息已保存。重点人群与家庭人员情况为选填内容，后续可在「我的资料」中随时补充或修改。</p><small>当前为匿名演示会话，资料只用于本次受控体验。</small></div>
    <button class="primary-button full-button" data-action="onboarding-enter-home">进入首页</button>
    <button class="register-edit-button" data-action="onboarding-edit">编辑资料</button>
  </section>`;
}

export function appShell(state, content) {
  const active = activeRoot(state.route);
  const roots = ["home", "hazards", "assist", "building", "me"];
  const onboarding = state.route === "register" || state.route === "register-done";
  const connected = state.online && state.backendHealthy === true;
  const connectionLabel = !state.online
    ? "离线"
    : state.backendHealthy === false
      ? "未连接"
      : state.backendHealthy === true
        ? "云端"
        : "连接中";
  return `<div class="app-shell ${onboarding ? "onboarding-shell" : ""}">
    ${onboarding ? "" : `<aside class="sidebar">
      <div class="sidebar-brand"><img src="${A}/illustrations/login-logo.png" alt="" /><div><strong>安居云枢</strong><small>评委体验版</small></div></div>
      <nav>${navItems(active)}</nav>
      <div class="sidebar-extra">
        <button data-route="my-reports">${icon("report")}<span>我的上报</span></button>
        <button data-route="drill-records">${icon("drill")}<span>演练记录</span></button>
      </div>
      <div class="sidebar-foot"><span class="status-dot ${connected ? "online" : ""}"></span>${connected ? `演示服务器已同步 · ${syncTime(state.lastSyncedAt)}` : connectionLabel}<small>设备、告警与互通消息均为演示</small></div>
    </aside>`}
    <div class="app-main">
      <header class="topbar"><button class="back-button ${roots.includes(state.route) || onboarding ? "hidden" : ""}" data-action="back" aria-label="返回">‹</button><strong>${esc(state.pageTitle || "安居云枢")}</strong><span class="topbar-demo cloud-state ${connected ? "connected" : ""}"><i></i>${connectionLabel}</span></header>
      ${state.online ? "" : '<div class="offline-banner">网络已断开。已填写内容会保留，联网后可重试。</div>'}
      <main class="content">${state.loading ? '<div class="loading"><span></span>正在读取服务器数据…</div>' : content}</main>
      ${onboarding ? "" : `<nav class="bottom-nav">${navItems(active)}</nav>`}
    </div>
    ${state.previewImage ? `<div class="image-viewer" data-action="close-preview"><button data-action="close-preview" aria-label="关闭">×</button><img src="${esc(state.previewImage)}" alt="图片预览" /></div>` : ""}
    <div id="toast" class="toast" role="status"></div>
  </div>`;
}

export function homeView(state) {
  const home = state.home || {};
  const notice = home.announcements?.[0];
  const building = home.buildings?.[0];
  return `<section class="page home-page">
    <section class="home-cover">
      <img class="home-cover-bg" src="${A}/illustrations/home-gate-cover.jpg" alt="社区门头" />
      <div class="home-cover-veil"></div>
      <div class="home-cover-top"><span>⌖ ${esc(home.community?.name || "云栖花园（演示社区）")}⌄</span><em>本地演示住户</em></div>
      <div class="home-cover-copy"><small>安居云枢 · 社区安全</small><h1>把安全，带回每一个家</h1><p>守护邻里日常，从每一次安心开始</p></div>
    </section>
    <div class="home-sheet">
      <button class="home-notice" data-route="notices"><b>📢</b><span>${esc(notice?.title || "让安全成为每一天的习惯")}</span><i>›</i></button>
      <div class="cloud-sync-card"><span class="cloud-sync-mark">✓</span><span><strong>${state.backendHealthy === true ? "演示云端已同步" : "演示云端待连接"}</strong><small>私人记录按本机隔离 · ${syncTime(state.lastSyncedAt)}</small></span><em>${state.backendHealthy === true ? "在线" : "重试中"}</em></div>
      <button class="home-guide" data-route="help"><img src="${A}/illustrations/hero-banner-${state.heroIndex === 1 ? "2" : "1"}.png" alt="居家消防安全指南" /></button>
      <div class="section-heading"><h2>社区服务</h2></div>
      <div class="service-grid six">
        <button data-route="report">${icon("hazard", true)}<span>隐患上报</span></button>
        <button data-action="placeholder" data-label="报事报修">${icon("wrench")}<span>报事报修</span></button>
        <button data-action="placeholder" data-label="投诉建议">${icon("report")}<span>投诉建议</span></button>
        <button data-action="placeholder" data-label="社区天气">${icon("cloud")}<span>社区天气</span></button>
        <button data-action="placeholder" data-label="物业缴费">${icon("book")}<span>物业缴费</span></button>
        <button data-action="placeholder" data-label="社区活动">${icon("calendar")}<span>社区活动</span></button>
      </div>
      <button class="safety-strip" data-route="building"><span>${icon("shield")}<strong>平安社区，你我共建</strong><i>查看 ›</i></span><small>查看楼栋信息，在线认识安全出口与集合点</small></button>
      <div class="metrics-row"><div><strong>${Number(state.reportStats?.total || 0)}</strong><span>我的上报</span></div><div><strong>${Number(state.drillStats?.completedCount || 0)}</strong><span>完成演练</span></div><div><strong>${Number(home.deviceCount || 0)}</strong><span>示例设备</span></div></div>
      <div class="section-heading community-heading"><h2>我的社区</h2><button data-route="building">查看楼栋 ›</button></div>
      <button class="community-card" data-route="building"><span class="community-building">${icon("cube")}</span><span><strong>${esc(building?.name || "1号楼")}</strong><small>${esc(home.community?.name || "云栖花园")} · 当前住址</small></span><em>›</em></button>
      <button class="property-contact" data-action="placeholder" data-label="物业联系"><span>${icon("phone")}<span><strong>联系物业服务中心</strong><small>演示入口，不会真实拨号</small></span></span><em>›</em></button>
    </div>
  </section>`;
}

const assistRiskNames = {
  none: "提示",
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  emergency: "紧急",
};

function assistCard(card, messageId) {
  if (!card) return "";
  const findings = card.findings || [];
  const questions = card.questions || [];
  const actions = card.actions || [];
  const avoid = card.avoid || [];
  const nextSteps = card.nextSteps || [];
  return `<article class="assist-action-card risk-${esc(card.riskLevel || "none")}">
    <header><span>${esc(assistRiskNames[card.riskLevel] || "提示")}</span><strong>${esc(card.title || "安全提示")}</strong></header>
    ${findings.length ? `<section><h3>识别要点</h3><ul>${findings.map((line) => `<li>${esc(line)}</li>`).join("")}</ul></section>` : ""}
    ${questions.length ? `<section><h3>还想确认</h3><div class="assist-question-list">${questions.map((line) => `<button data-action="assist-quick" data-text="${esc(line)}">${esc(line)}</button>`).join("")}</div></section>` : ""}
    ${actions.length ? `<section><h3>建议处置</h3><ol>${actions.map((item) => `<li><b>${esc(item.title)}</b><span>${esc(item.detail)}</span></li>`).join("")}</ol></section>` : ""}
    ${avoid.length ? `<section class="assist-avoid"><h3>请不要</h3>${avoid.map((line) => `<p>${esc(line)}</p>`).join("")}</section>` : ""}
    ${nextSteps.length ? `<footer>${nextSteps.map((step, index) => `<button class="${index === 0 ? "primary-button" : "secondary-button"}" data-action="assist-step" data-message-id="${esc(messageId)}" data-step-index="${index}">${esc(step.label)}</button>`).join("")}</footer>` : ""}
  </article>`;
}

export function assistView(state) {
  const radar = state.assistRadar || {};
  const messages = state.assistMessages || [];
  const chips = assistChips[state.assistRole] || [];
  return `<section class="page resident-assist-page">
    <header class="assist-hero">
      <small>安居云枢 · 业主安全助手</small>
      <h1>看见隐患，马上问清楚</h1>
      <p>识险 · 处置 · 文书，建议仅供参考</p>
      <div class="assist-role-switch">${assistRoles.map((item) => `<button class="${state.assistRole === item.id ? "active" : ""}" data-action="assist-role" data-role="${item.id}"><strong>${item.name}</strong><span>${item.note}</span></button>`).join("")}</div>
    </header>
    <section class="assist-radar ${radar.offline ? "offline" : ""}">
      <span class="assist-radar-mark">${icon("shield-white")}</span>
      <div><small>本楼风险雷达 · 待跟进 ${Number(radar.openReports || 0)}</small><strong>${esc(radar.address || "绑定住址后可生成楼层提示")}</strong><p>${esc(radar.advice || "正在读取本楼提示…")}</p></div>
      <em>${radar.offline ? "离线建议" : "服务器数据"}</em>
    </section>
    <p class="assist-emergency-tip">紧急情况请先确保安全，并人工联系物业或 119</p>
    <div class="assist-message-list">${messages.map((message) => `<div class="assist-message ${message.role}"><span class="assist-avatar">${message.role === "user" ? "我" : "助"}</span><div><p>${esc(message.text)}</p>${assistCard(message.card, message.id)}</div></div>`).join("")}${state.assistBusy ? '<div class="assist-message assistant"><span class="assist-avatar">助</span><div><p class="assist-typing">正在整理建议…</p></div></div>' : ""}</div>
    ${state.assistError ? `<div class="error-box" role="alert">${esc(state.assistError)}</div>` : ""}
    <div class="assist-composer-dock">
      <div class="assist-quick-list">${chips.map((text) => `<button data-action="assist-quick" data-text="${esc(text)}">${esc(text)}</button>`).join("")}</div>
      <form id="assist-form"><input name="message" maxlength="2000" value="${esc(state.assistDraft || "")}" placeholder="描述你看到的现象，如走廊堆物、烟味" autocomplete="off" /><button class="primary-button" type="submit" ${state.assistBusy ? "disabled" : ""}>${state.assistBusy ? "处理中" : "发送"}</button></form>
    </div>
  </section>`;
}

function reportTitle(item) {
  const match = String(item.description || "").match(/^【(.+?)】/);
  return match?.[1] || typeNames[item.type] || "社区隐患";
}

function reportBody(item) {
  return String(item.description || "").replace(/^【.+?】\s*/, "");
}

function reportCover(item) {
  const title = reportTitle(item);
  for (const category of hazardCategories) {
    const match = category.items.find((entry) => entry.name === title);
    if (match) return match.image;
  }
  const names = { fire: "fire.png", obstruction: "obstruction.png", equipment: "equipment.png", electrical: "electrical.png" };
  return `${A}/illustrations/${names[item.type] || "obstruction.png"}`;
}

export function hazardsView(state) {
  const reports = state.reports || [];
  const filters = [["", "全部"], ["pending", "待处理"], ["processing", "处理中"], ["completed", "已完成"]];
  return `<section class="page hazards-page">
    <div class="page-title-row"><div><h1>一起守护社区安全</h1><p>拍照上报 · 分类选择隐患类型</p></div><span class="soft-icon">${icon("shield", true)}</span></div>
    <button class="report-banner" data-route="report"><span><strong>发现隐患？先拍照再选类型</strong><small>消防器材 · 电动车 · 电路 · 安全通道</small></span><em>${icon("camera", true)}</em></button>
    <div class="filter-scroll">${filters.map(([id, label]) => `<button class="chip ${state.hazardFilter === id ? "active" : ""}" data-action="filter-hazards" data-status="${id}">${label}</button>`).join("")}</div>
    ${reports.length ? `<div class="report-list">${reports.map((item) => `<button class="report-card" data-action="open-report" data-id="${esc(item.id)}"><img src="${reportCover(item)}" alt="" /><span><strong>${esc(reportTitle(item))}</strong><small>${esc(item.location)}</small>${badge(item.status)}</span><footer><time>${dateText(item.createdAt)}</time><em>查看进度 ›</em></footer></button>`).join("")}</div>` : empty("暂无该状态的隐患记录")}
  </section>`;
}

export function reportView(state) {
  const draft = state.reportDraft;
  const category = hazardCategories.find((item) => item.id === draft.categoryId);
  return `<section class="page report-page">
    <div class="page-title-row"><div><h1>一起守护社区安全</h1><p>拍照上报 · 分类选择隐患类型</p></div><span class="soft-icon">${icon("shield", true)}</span></div>
    ${state.error ? `<div class="error-box" role="alert">${esc(state.error)}<button data-action="retry-report">重试</button></div>` : ""}
    <form id="report-form">
      <div class="report-steps"><span class="active"><b>1</b>上传照片</span><i></i><span><b>2</b>选择类型</span><i></i><span><b>3</b>填写详情</span></div>
      <label class="photo-banner" for="report-photos"><span><strong>发现隐患？先拍照再选类型</strong><small>已选 ${state.photos.length} / 3 张 · 点击可选拍照或相册</small></span><em>${icon("camera", true)}</em><input id="report-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple data-action="photos" /></label>
      ${state.photos.length ? `<div class="photo-previews">${state.photos.map((item, index) => `<div><button type="button" class="preview-photo" data-action="preview-image" data-src="${esc(item.preview)}"><img src="${esc(item.preview)}" alt="现场图片 ${index + 1}" /></button><button type="button" class="remove-photo" data-action="remove-photo" data-index="${index}" aria-label="删除图片">×</button></div>`).join("")}</div>` : ""}
      <fieldset class="hazard-field"><legend>隐患类型 <i>*</i></legend><div class="hazard-categories">${hazardCategories.map((item) => `<button type="button" class="${draft.categoryId === item.id ? "active" : ""}" data-action="select-hazard-category" data-id="${item.id}">${item.name}</button>`).join("")}</div>
        ${category ? `<div class="hazard-cards">${category.items.map((item) => `<button type="button" class="${draft.hazardId === item.id ? "active" : ""}" data-action="select-hazard" data-id="${item.id}"><img src="${item.image}" alt="" /><strong>${esc(item.name)}</strong></button>`).join("")}</div>` : '<p class="hazard-empty-tip">点选上方分类后，再选择具体隐患示例图</p>'}
        ${draft.hazardId === "custom" ? `<label class="form-field"><span>补充隐患名称 <i>*</i></span><input name="customName" maxlength="40" value="${esc(draft.customName || "")}" placeholder="例如：楼道堆放易燃物" /></label>` : ""}
      </fieldset>
      <label class="form-field"><span>隐患位置 <i>*</i></span><input name="location" minlength="2" maxlength="160" required value="${esc(draft.location)}" placeholder="如东侧公共走廊" /></label>
      <label class="form-field"><span>情况描述 <i>*</i></span><textarea name="description" minlength="5" maxlength="500" required placeholder="描述发现的问题，至少5个字">${esc(draft.description)}</textarea></label>
      <label class="form-field"><span>联系电话 <small>选填，演示填写即可</small></span><input name="contact" inputmode="tel" maxlength="30" value="${esc(draft.contact)}" placeholder="无需提供真实手机号" /></label>
      <div class="safety-note">演示上报会保存到评审服务器，但不会触发真实物业告警。</div>
      <button class="primary-button submit-report" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "正在上传并保存…" : "提交演示上报"}</button>
    </form>
  </section>`;
}

function floorRows(state) {
  const floors = state.building?.units?.[0]?.floors || [];
  return [...floors].sort((a, b) => b.number - a.number);
}

export function buildingView(state) {
  const floors = floorRows(state);
  const floor = state.floorNumber || 6;
  const offline = (state.devices || []).filter((item) => item.connectionStatus !== "online").length;
  const online = (state.devices || []).length - offline;
  return `<section class="page building-page">
    <div class="building-heading"><strong>1号楼 · 1单元⌄</strong><span class="pill">演示数据</span></div>
    <section class="iso-stage">
      <div class="iso-stage-head"><span class="pill white">立体楼房 · 示意</span><label class="fire-switch"><input type="checkbox" data-action="toggle-fire" ${state.demoFire ? "checked" : ""} /><i></i></label></div>
      <div class="fire-copy"><span>开启右侧开关可演示「AI 识别火情」落点</span><span>${state.demoFire ? "火情演示中" : "无火情"}</span></div>
      <div class="iso-viewport"><div class="tower-wrap"><div class="tower-cube"><div class="cube-top"></div><div class="cube-front">${floors.map((item) => `<button class="tower-level ${floor === item.number ? "active" : ""} ${state.demoFire && item.number === 12 ? "on-fire" : ""}" data-action="select-floor" data-floor="${item.number}" data-id="${esc(item.id)}"><small>${item.number}F</small><span><i></i><i></i><i></i><i></i></span>${state.demoFire && item.number === 12 ? '<b>火</b>' : ""}</button>`).join("")}<div class="tower-lobby"><i></i></div></div><div class="cube-side">${floors.map((item) => `<i class="${floor === item.number ? "active" : ""}"></i>`).join("")}<b></b></div></div></div>
        <div class="floor-rail">${floors.filter((_, index) => index % 2 === 0 || floor === floors[index].number).map((item) => `<button class="${floor === item.number ? "active" : ""}" data-action="select-floor" data-floor="${item.number}" data-id="${esc(item.id)}">${item.number}F</button>`).join("")}</div></div>
      <div class="iso-legend"><span><i class="green"></i>安全通道</span><span><i class="red"></i>灭火器</span><span><i class="blue"></i>消防栓</span><span><i class="orange"></i>火情</span></div>
      <div class="tower-actions"><button class="emergency-entry" data-route="emergency"><img src="${A}/illustrations/emergency-call.png" alt="" /><strong>紧急求助</strong></button><div>
        <button data-route="building-chat"><span class="entry-icon blue">${icon("bell")}</span><span><strong>火情业主群</strong><small>实时互通 · AI 汇总火情</small></span><b>›</b></button>
        <button data-route="building-escape"><span class="entry-icon green">${icon("exit")}</span><span><strong>安全通道结构图</strong><small>出口与疏散示意</small></span><b>›</b></button>
        <button data-route="building-equipment"><span class="entry-icon red">${icon("shield")}</span><span><strong>灭火器 / 消防栓</strong><small>位置分布与使用流程</small></span><b>›</b></button>
      </div></div>
    </section>
    <p class="field-note">点击楼层查看状态 · 3D 为示意模型，火情点位后续由 AI 识别接入</p>
    <section class="building-stats card"><header><strong>${floor}层安全提示</strong><span>本地示例</span></header><div class="stats"><div><b>${(state.devices || []).length}</b><small>感知设备</small></div><div><b class="accent">${offline}</b><small>离线 / 未知</small></div><div><b>${online}</b><small>在线示例</small></div></div><button data-route="devices">查看本层感知设备 ›</button></section>
    <button class="secondary-button full-button" data-route="drill-start">模拟演练</button>
    <button class="ai-fab" data-route="building-chat"><img src="${A}/illustrations/ai-fab-fire.png" alt="AI 火情助手" /><span>AI 火情助手</span></button>
  </section>`;
}

export function meView(state) {
  const user = state.user || {};
  return `<section class="page me-page">
    <section class="me-cover"><img src="${A}/illustrations/me-gate-cover.jpg" alt="" /><div class="me-cover-veil"></div><div class="me-profile">${icon("user-white", false, "avatar-icon")}<h1>${esc(user.nickname || "匿名体验")}</h1><p>${esc(user.bindings?.find((item) => item.isCurrent)?.address || "评审匿名演示住户")}</p></div></section>
    <div class="me-sheet"><div class="me-stats"><div><b>${state.reportStats?.total || 0}</b><span>我的上报</span></div><i></i><div><b>${state.reportStats?.processing || 0}</b><span>处理中</span></div><i></i><div><b>${state.reportStats?.completed || 0}</b><span>已完成</span></div></div>
      <div class="me-sync"><span class="status-dot ${state.backendHealthy === true ? "online" : ""}"></span><span>${state.backendHealthy === true ? `服务器记录已同步 · ${syncTime(state.lastSyncedAt)}` : "服务器暂未连接，已填写内容仍保留"}</span></div>
      <div class="me-menu">${[
        ["user", "个人资料", "profile"], ["report", "我的上报", "my-reports"], ["pin", "楼栋与设备", "building"], ["bell", "社区通知", "notices"], ["phone", "应急电话", "emergency"], ["drill", "演练记录", "drill-records"], ["settings", "设置与帮助", "help"],
      ].map(([name, label, route]) => `<button data-route="${route}">${icon(name)}<span>${label}</span><b>›</b></button>`).join("")}</div>
      <button class="logout-button" data-action="logout">退出当前体验</button><p class="legal-line">隐私政策　·　用户协议</p>
    </div>
  </section>`;
}

export function devicesView(state) {
  const items = state.devices || [];
  const floors = state.building?.units?.[0]?.floors || [];
  return `<section class="page"><div class="page-intro"><h1>楼栋感知设备</h1><p>所有状态均为固定演示数据，不代表真实环境安全。</p></div><label class="floor-select"><span>1号楼 · 1单元</span><select data-action="floor-select">${floors.map((item) => `<option value="${esc(item.id)}" data-floor="${item.number}" ${item.number === state.floorNumber ? "selected" : ""}>${item.number}层</option>`).join("")}</select></label>
    <div class="device-grid">${items.map((item) => `<article class="device-card"><header><span>${icon("device")}</span><div><strong>${esc(item.name)}</strong><small>${esc(item.location)}</small></div>${badge(item.connectionStatus)}</header><div class="device-reading"><span>最近读数</span><b>${item.reading ? `${esc(item.reading.value)} ${esc(item.reading.unit)}` : "暂无"}</b></div><p>${item.reading ? `${item.reading.freshness === "stale" ? "过期数据" : "固定演示读数"} · ${dateText(item.reading.collectedAt)}` : "采集状态未知"}</p><em>来源：${esc(item.source || "demo")} · 非真实监测</em></article>`).join("")}</div>
  </section>`;
}

function reportRow(item) {
  return `<button class="record-row" data-action="open-report" data-id="${esc(item.id)}"><img src="${reportCover(item)}" alt="" /><span><strong>${esc(reportTitle(item))}</strong><small>${esc(item.location)} · ${dateText(item.createdAt)}</small><em>${esc(item.number)}</em></span>${badge(item.status)}<b>›</b></button>`;
}

function drillRow(item) {
  return `<button class="record-row" data-action="open-drill" data-id="${esc(item.id)}" data-status="${esc(item.status)}"><span class="record-symbol">△</span><span><strong>${esc(item.snapshot?.title || "楼栋线上模拟演练")}</strong><small>${esc(item.snapshot?.buildingName || "1号楼")} · ${esc(item.snapshot?.floorNumber || 6)}层 · ${dateText(item.completedAt || item.startedAt)}</small><em>${durationText(item.durationSeconds)} · ${item.completedSteps?.length || 0}/2 步骤</em></span>${badge(item.status)}<b>›</b></button>`;
}

export function historyView(state, mode = "all") {
  const reports = state.reports || [];
  const drills = state.drills || [];
  return `<section class="page history-page"><div class="page-intro"><h1>${mode === "reports" ? "我的上报" : mode === "drills" ? "演练记录" : "历史记录"}</h1><p>这里只显示当前匿名体验会话保存的私人记录。</p></div>
    <div class="history-stats"><div><b>${state.reportStats?.total || 0}</b><span>上报</span></div><div><b>${state.drillStats?.completedCount || 0}</b><span>完成演练</span></div><div><b>${durationText(state.drillStats?.durationSeconds)}</b><span>累计时长</span></div></div>
    ${mode !== "drills" ? `<div class="section-heading"><h2>最近上报</h2><button data-route="report">继续上报</button></div>${reports.length ? `<div class="record-list">${reports.map(reportRow).join("")}</div>` : empty("还没有上报记录")}` : ""}
    ${mode !== "reports" ? `<div class="section-heading spaced"><h2>演练记录</h2><button data-route="drill-start">开始演练</button></div>${drills.length ? `<div class="record-list">${drills.map(drillRow).join("")}</div>` : empty("还没有演练记录")}` : ""}
  </section>`;
}

export function reportDetailView(state) {
  const item = state.reportDetail;
  if (!item) return empty("记录不存在");
  return `<section class="page detail-page"><div class="success-circle">${icon("check", true)}</div><h1 class="center">${state.reportJustCreated ? "模拟上报成功" : reportTitle(item)}</h1><p class="center muted">${state.reportJustCreated ? "你的这份关心，让社区多一份安心" : "演示处理进度"}</p>
    <section class="card"><div class="detail-pair"><span>演示编号</span><b>${esc(item.number)}</b></div><div class="detail-pair"><span>当前状态</span>${badge(item.status)}</div><div class="detail-pair"><span>提交时间</span><b>${dateText(item.createdAt)}</b></div></section>
    <section class="card report-detail-card"><header><img src="${reportCover(item)}" alt="" /><div><h2>${esc(reportTitle(item))}</h2><p>${esc(item.location)}</p></div></header><p>${esc(reportBody(item))}</p><small>联系方式：${item.contact === "00000" ? "未填写" : esc(item.contact || "未填写")}</small></section>
    <section class="card"><h2>处理进度</h2><div class="timeline">${(item.events || []).map((event) => `<div><i></i><span><strong>${esc(event.message)}</strong><small>${dateText(event.occurredAt)}</small></span></div>`).join("")}</div></section>
    <div class="safety-note">已保存到评审演示服务器，不会触发真实物业告警。</div><div class="button-row"><button class="secondary-button" data-route="report">继续上报</button><button class="primary-button" data-route="my-reports">查看我的全部上报</button></div>
  </section>`;
}

export function drillStartView() {
  return `<section class="page drill-page"><div class="page-intro"><h1>楼栋线上模拟演练</h1><p>先认识本层安全出口，再认识社区集合点</p></div><section class="step-guide"><span>线上模拟 · 两步完成</span><h2>请先观察示意图，再逐步确认</h2><p>不会触发真实警报，也不代表已经实际疏散。</p></section><div class="floor-plan"><div class="room exit">安全出口</div><div class="room">601</div><div class="room">602</div><div class="corridor">← 楼层通道示意 →</div><div class="room">603</div><div class="room">电梯厅</div><div class="room">604</div></div><ol class="drill-steps"><li><b>1</b>认识本层安全出口</li><li><b>2</b>认识社区集合点</li></ol><button class="primary-button full-button" data-action="start-drill">开始两步演练</button></section>`;
}

export function drillView(state) {
  const item = state.drill;
  if (!item) return empty("演练会话不存在");
  if ((state.drillStep || 1) === 1) return `<section class="page drill-page"><div class="step-label">STEP 01 / 02</div><h1>认识本层安全出口</h1><p class="muted">${esc(item.snapshot.exitText)}</p><div class="floor-plan large"><div class="room exit">安全出口</div><div class="room">${item.snapshot.floorNumber}01</div><div class="room">${item.snapshot.floorNumber}02</div><div class="corridor">← 楼层通道示意 →</div><div class="room">${item.snapshot.floorNumber}03</div><div class="room">电梯厅</div><div class="room">${item.snapshot.floorNumber}04</div></div><p class="diagram-caption">线上认知示意 · 非现场实测平面图</p><div class="warning-box">真实紧急情况下请遵循现场标识和工作人员指引。</div><button class="primary-button full-button" data-action="drill-next" ${state.busy ? "disabled" : ""}>${state.busy ? "正在保存进度…" : "已了解，下一步"}</button></section>`;
  return `<section class="page drill-page"><div class="step-label">STEP 02 / 02</div><h1>认识社区集合点</h1><p class="muted">${esc(item.snapshot.meetingPoint)}</p><div class="campus-map"><div class="road-v"></div><div class="road-h"></div><span class="campus-building nw">1号楼</span><span class="campus-building ne">2号楼</span><span class="campus-building se">社区服务</span><span class="meeting">集合点</span><i class="you">你</i></div><p class="diagram-caption">线上示意图 · 非实际导航路线</p><ul class="confirm-list"><li>已了解本层安全出口位置</li><li>已了解演示社区集合点</li><li>知道线上确认不等于实际疏散</li></ul><button class="primary-button full-button" data-action="drill-finish" ${state.busy ? "disabled" : ""}>${state.busy ? "正在保存总结…" : "结束演练，查看总结"}</button></section>`;
}

export function summaryView(state) {
  const item = state.drillSummary;
  if (!item) return empty("演练总结不存在");
  return `<section class="page summary-page"><div class="success-circle">${icon("check", true)}</div><h1 class="center">本次演练已结束</h1><p class="center muted">线上模拟演练总结</p><div class="summary-stats"><div><b>${durationText(item.durationSeconds)}</b><span>参与时长</span></div><div><b>${item.completedSteps?.length || 0} / 2</b><span>完成步骤</span></div></div><section class="card"><h2>演练详情</h2><div class="detail-pair"><span>演练场景</span><b>${esc(item.snapshot.title)}</b></div><div class="detail-pair"><span>楼栋位置</span><b>${esc(item.snapshot.buildingName)} · ${esc(item.snapshot.floorNumber)}层</b></div><div class="detail-pair"><span>结束时间</span><b>${dateText(item.completedAt)}</b></div></section><div class="safety-note">记录已由服务器保存，关闭并重新打开应用后仍可查看。</div><div class="button-row"><button class="secondary-button" data-action="repeat-drill">再次演练</button><button class="primary-button" data-route="drill-records">查看历史记录</button></div></section>`;
}

export function equipmentView() {
  return `<section class="page guide-page"><div class="page-intro"><h1>灭火器 / 消防栓</h1><p>6层位置示意 · 使用流程</p></div>${[["本层位置分布", "equip-location-map.png"], ["灭火器的使用方法", "guide-extinguisher.png"], ["认识消防栓 · 使用方法", "guide-hydrant.png"], ["灭火毯如何使用", "guide-blanket.png"]].map(([title, file]) => `<section class="card guide-card"><header><strong>${title}</strong><span class="pill">点击放大</span></header><button data-action="preview-image" data-src="${A}/illustrations/${file}"><img src="${A}/illustrations/${file}" alt="${title}" /></button></section>`).join("")}</section>`;
}

export function escapeView() {
  return `<section class="page guide-page"><div class="page-intro"><h1>安全通道结构图</h1><p>6层 · 消防疏散示意图</p></div><section class="card guide-card"><header><strong>疏散平面图</strong><span class="pill">可点击放大</span></header><button data-action="preview-image" data-src="${A}/illustrations/guide-escape-plan.png"><img src="${A}/illustrations/guide-escape-plan.png" alt="疏散平面图" /></button><p>请以楼内实际标识为准</p></section><section class="card escape-tips"><h2>疏散要点</h2><p>1. 保持冷静，沿出口标识向最近楼梯撤离</p><p>2. 勿乘坐电梯，低姿前行，湿毛巾捂口鼻</p><p>3. 到达社区集合点后清点人数并等候指引</p></section></section>`;
}

export function chatView(state) {
  return `<section class="page chat-page"><section class="ai-summary"><header><b>AI 汇总</b><time>刚刚更新</time></header><h1>当前火情速览</h1><p>${esc(state.aiSummary)}</p><div><span>2号楼</span><span>3层明火</span><span>5层浓烟</span><span>勿乘电梯</span></div></section><p class="chat-tip">本群为演示火情互通 · 消息不会真实发送</p><div class="chat-list">${state.chatMessages.map((item) => `<div class="chat-row ${item.mine ? "mine" : ""}"><i class="${item.role}">${esc(item.avatar)}</i><span><small>${item.mine ? "" : `${esc(item.name)} · ${esc(item.floor)}`}</small><b class="${item.role}">${esc(item.text)}</b><time>${esc(item.time)}</time></span></div>`).join("")}</div><form id="chat-form" class="chat-composer"><input name="message" maxlength="120" value="${esc(state.chatDraft)}" placeholder="补充你看到的火情位置…" /><button type="submit">发送</button></form></section>`;
}

export function noticesView(state) {
  const items = state.home?.announcements || [];
  return `<section class="page"><div class="page-intro"><h1>社区通知</h1><p>固定演示公告</p></div><div class="notice-list">${items.map((item) => `<article class="card"><h2>${esc(item.title)}</h2><p>${esc(item.body)}</p><time>${dateText(item.publishedAt)}</time></article>`).join("")}</div></section>`;
}

export function profileView(state) {
  const binding = state.user?.bindings?.find((item) => item.isCurrent);
  return `<section class="page profile-page"><div class="page-intro"><h1>个人资料</h1><p>管理演示昵称与当前住址</p></div><form id="profile-form" class="card"><label class="form-field"><span>昵称</span><input name="nickname" maxlength="30" required value="${esc(state.user?.nickname || "")}" /></label><button class="primary-button" type="submit">保存昵称</button></form><section class="card"><h2>住户资料</h2><p>${esc(binding?.address || "当前匿名会话暂无住址")}</p><span class="pill">演示资料</span></section><div class="safety-note">无需提供头像或手机号。上报时可单独填写必要联系信息。</div></section>`;
}

export function emergencyView() {
  return `<section class="page emergency-page"><div class="page-intro"><h1>紧急求助</h1><p>测试中不会实际拨号或发送告警</p></div><section class="contact-card fire"><div><small>公共紧急电话</small><strong>119</strong><p>如遇真实紧急情况，请离开应用并使用系统电话。</p></div><button data-action="safe-call" data-label="119">演示拨号</button></section><section class="contact-card"><div><small>物业服务中心</small><strong>400-000-0000</strong><p>比赛演示号码，不对应真实物业。</p></div><button data-action="safe-call" data-label="物业">演示联系</button></section></section>`;
}

export function helpView() {
  return `<section class="page help-page"><div class="page-intro"><h1>设置与帮助</h1><p>安居云枢评委体验版</p></div><section class="card"><h2>体验说明</h2><p>本应用使用受限匿名演示会话。隐患上报和演练记录会保存到演示服务器，并与其他评委隔离。</p></section><section class="warning-box"><strong>重要边界</strong><p>设备状态、读数、告警、楼栋、AI 汇总和群聊消息均为演示，不连接真实消防设备，不拨打电话，不发送真实告警。</p></section><section class="card"><h2>建议体验顺序</h2><ol><li>查看楼栋和设备状态</li><li>拍照提交一条演示隐患</li><li>完成两步线上演练</li><li>关闭并重开应用后查看记录</li></ol></section></section>`;
}

export function errorView(error) {
  return `<section class="page"><div class="error-box">${esc(error)}<button data-action="retry-page">重试</button></div></section>`;
}
