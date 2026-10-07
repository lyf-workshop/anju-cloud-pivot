import "./styles.css";
import { api, ApiError } from "./api.js";
import {
  platformName,
  readSession,
  writeSession,
  clearSession,
  randomKey,
  uuid,
  installBackHandler,
} from "./platform.js";
import {
  appShell,
  welcomeView,
  registerView,
  registerDoneView,
  homeView,
  hazardsView,
  assistView,
  reportView,
  buildingView,
  meView,
  devicesView,
  historyView,
  reportDetailView,
  drillStartView,
  drillView,
  summaryView,
  equipmentView,
  escapeView,
  chatView,
  noticesView,
  profileView,
  emergencyView,
  helpView,
  errorView,
  hazardCategories,
} from "./views.js";
import { localAssist, localRadar } from "./assistant.js";

const app = document.querySelector("#app");
const DRAFT_KEY = "anju-report-draft-v2";

function blankDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (saved && typeof saved === "object") return saved;
  } catch {}
  return {
    categoryId: "",
    hazardId: "",
    hazardName: "",
    customName: "",
    type: "other",
    location: "6层东侧公共走廊",
    description: "",
    contact: "",
  };
}

const seedMessages = [
  { id: "m1", name: "林先生", avatar: "林", floor: "2号楼3单元5层", role: "owner", text: "2号楼3单元5层走廊有浓烟，味道很呛，已经往楼梯口撤了。", time: "10:21" },
  { id: "m2", name: "王阿姨", avatar: "王", floor: "2号楼2单元3层", role: "owner", text: "2号楼3层东侧好像有明火，门口堆了纸箱，请物业尽快确认！", time: "10:22" },
  { id: "m3", name: "物业值班", avatar: "物", floor: "值班室", role: "property", text: "演示消息：请优先走安全楼梯，勿乘电梯；本页不会真实通知物业或拨打电话。", time: "10:23" },
  { id: "m4", name: "陈同学", avatar: "陈", floor: "2号楼1单元6层", role: "owner", text: "6层暂时还能见度，但楼梯间开始有烟味，大家低姿前行。", time: "10:24" },
];

const state = {
  route: "welcome",
  pageTitle: "安居云枢",
  online: navigator.onLine,
  backendHealthy: null,
  lastSyncedAt: "",
  serverMode: "demo",
  loading: false,
  busy: false,
  error: "",
  session: null,
  user: null,
  home: null,
  reportStats: null,
  drillStats: null,
  reports: [],
  drills: [],
  devices: [],
  building: null,
  floorId: "floor-1-1-6",
  floorNumber: 6,
  photos: [],
  reportDraft: blankDraft(),
  reportKey: "",
  reportAttempted: false,
  uploadedPhotos: new Map(),
  reportDetail: null,
  reportJustCreated: false,
  drill: null,
  drillSummary: null,
  drillStep: 1,
  hazardFilter: "",
  demoFire: false,
  heroIndex: 0,
  previewImage: "",
  chatDraft: "",
  chatMessages: seedMessages,
  aiSummary: "综合业主演示消息：火情主要集中在2号楼，3层有明火迹象，3单元5层出现浓烟；建议沿安全楼梯撤离，勿乘电梯，低姿捂口鼻。",
  assistRole: "identify",
  assistDraft: "",
  assistRadar: null,
  assistBusy: false,
  assistError: "",
  assistMessages: [
    {
      id: "assist-hello",
      role: "assistant",
      text: "我是业主助手。可先识险、再给处置建议，最后帮你写成上报描述。紧急情况请先保证安全。",
      card: null,
    },
  ],
  onboardingInitialized: false,
  onboardingStep: 1,
  onboardingErrors: {},
  onboardingDraft: {
    unitId: "",
    floorId: "",
    room: "",
    familyCount: "1",
    elderly: 0,
    children: 0,
    pets: 0,
    situations: [],
  },
  showOnboardingPrivacy: false,
  editingOnboarding: false,
};

function renderContent() {
  if (state.error && !["report", "register"].includes(state.route)) return errorView(state.error);
  if (state.route === "register") return registerView(state);
  if (state.route === "register-done") return registerDoneView(state);
  if (state.route === "home") return homeView(state);
  if (state.route === "hazards") return hazardsView(state);
  if (state.route === "assist") return assistView(state);
  if (state.route === "report") return reportView(state);
  if (state.route === "building") return buildingView(state);
  if (state.route === "me") return meView(state);
  if (state.route === "devices") return devicesView(state);
  if (state.route === "history") return historyView(state);
  if (state.route === "my-reports") return historyView(state, "reports");
  if (state.route === "drill-records") return historyView(state, "drills");
  if (state.route.startsWith("report/")) return reportDetailView(state);
  if (state.route === "drill-start") return drillStartView(state);
  if (state.route.startsWith("drill/")) return drillView(state);
  if (state.route.startsWith("summary/")) return summaryView(state);
  if (state.route === "building-equipment") return equipmentView(state);
  if (state.route === "building-escape") return escapeView(state);
  if (state.route === "building-chat") return chatView(state);
  if (state.route === "notices") return noticesView(state);
  if (state.route === "profile") return profileView(state);
  if (state.route === "emergency") return emergencyView(state);
  if (state.route === "help") return helpView(state);
  return homeView(state);
}

function render() {
  if (state.route === "welcome") {
    app.innerHTML = welcomeView(state);
    return;
  }
  app.innerHTML = appShell(
    state,
    state.loading
      ? '<div class="loading"><span></span>正在读取服务器数据…</div>'
      : renderContent(),
  );
}

function pageTitle(route) {
  if (route === "register") return state.editingOnboarding ? "编辑资料" : "住户信息登记";
  if (route === "register-done") return "登记完成";
  if (route === "home") return "安居云枢";
  if (route === "hazards") return "社区隐患";
  if (route === "assist") return "业主安全助手";
  if (route === "report") return "隐患上报";
  if (route === "building") return "楼栋安全";
  if (route === "me") return "我的";
  if (route === "devices") return "感知设备";
  if (route === "history") return "历史记录";
  if (route === "my-reports") return "我的上报";
  if (route === "drill-records") return "演练记录";
  if (route.startsWith("report/")) return "上报详情";
  if (route === "drill-start" || route.startsWith("drill/")) return "模拟演练";
  if (route.startsWith("summary/")) return "演练总结";
  if (route === "building-equipment") return "消防设施";
  if (route === "building-escape") return "安全通道";
  if (route === "building-chat") return "火情业主群";
  if (route === "notices") return "社区通知";
  if (route === "profile") return "个人资料";
  if (route === "emergency") return "紧急求助";
  if (route === "help") return "设置与帮助";
  return "安居云枢";
}

function currentHash() {
  return location.hash.replace(/^#\/?/, "") || "home";
}

function navigate(route, replace = false) {
  state.previewImage = "";
  const value = `#/${route}`;
  if (replace) history.replaceState({ route }, "", value);
  else if (location.hash !== value) history.pushState({ route }, "", value);
  loadRoute(route);
}

async function getBuilding() {
  if (!state.building) state.building = await api.get("/buildings/building-1");
  const floors = state.building.units?.[0]?.floors || [];
  let floor = floors.find((item) => item.id === state.floorId);
  if (!floor) floor = floors.find((item) => item.number === 6) || floors[0];
  if (floor) {
    state.floorId = floor.id;
    state.floorNumber = floor.number;
  }
  return floor;
}

async function loadDevices() {
  const floor = await getBuilding();
  if (!floor) return;
  const result = await api.get(`/devices?floorId=${encodeURIComponent(floor.id)}`);
  state.devices = result.items || [];
  markSynced();
}

async function prepareOnboarding() {
  const building = state.building || await api.get("/buildings/building-1");
  state.building = building;
  if (state.onboardingInitialized) return;
  const binding = state.user?.bindings?.find((item) => item.isCurrent)
    || state.user?.bindings?.[0];
  const unit = building.units?.find((item) => item.id === binding?.unitId)
    || building.units?.[0];
  const selectedFloor = unit?.floors?.find((item) => item.id === binding?.floorId)
    || unit?.floors?.find((item) => item.number === 6)
    || unit?.floors?.[0];
  const saved = state.session?.onboarding?.draft || {};
  state.onboardingDraft = {
    unitId: saved.unitId || unit?.id || "",
    floorId: saved.floorId || selectedFloor?.id || "",
    room: saved.room || String(binding?.room || "601").replace(/室$/, ""),
    familyCount: String(saved.familyCount || 1),
    elderly: Number(saved.elderly || 0),
    children: Number(saved.children || 0),
    pets: Number(saved.pets || 0),
    situations: Array.isArray(saved.situations) ? saved.situations.slice() : [],
  };
  state.floorId = state.onboardingDraft.floorId || state.floorId;
  state.floorNumber = Number(selectedFloor?.number || state.floorNumber);
  state.onboardingInitialized = true;
}

function onboardingErrors() {
  const draft = state.onboardingDraft;
  const errors = {};
  if (!draft.unitId) errors.unitId = "请选择单元";
  if (!draft.floorId) errors.floorId = "请选择层数";
  if (!String(draft.room || "").trim()) errors.room = "请输入房间号";
  const familyCount = Number(draft.familyCount);
  if (!Number.isFinite(familyCount) || familyCount < 1) errors.familyCount = "请输入家庭人数";
  return errors;
}

async function rememberOnboarding(skipped = false) {
  if (!state.session) return;
  state.session = {
    ...state.session,
    onboarding: {
      completed: true,
      skipped,
      completedAt: new Date().toISOString(),
      draft: { ...state.onboardingDraft, situations: state.onboardingDraft.situations.slice() },
    },
  };
  await writeSession(state.session);
}

async function saveOnboarding(skipOptional = false) {
  const errors = onboardingErrors();
  if (Object.keys(errors).length) {
    state.onboardingErrors = errors;
    state.onboardingStep = 1;
    render();
    return;
  }
  state.busy = true;
  state.error = "";
  if (skipOptional) {
    Object.assign(state.onboardingDraft, {
      elderly: 0,
      children: 0,
      pets: 0,
      situations: [],
    });
  }
  render();
  try {
    const result = await api.post("/bindings", {
      floorId: state.onboardingDraft.floorId,
      room: String(state.onboardingDraft.room).trim(),
    });
    if (state.user) state.user.bindings = result;
    state.floorId = state.onboardingDraft.floorId;
    const unit = state.building?.units?.find((item) => item.id === state.onboardingDraft.unitId);
    const floor = unit?.floors?.find((item) => item.id === state.onboardingDraft.floorId);
    if (floor) state.floorNumber = Number(floor.number);
    await rememberOnboarding(skipOptional);
    state.editingOnboarding = false;
    navigate("register-done", true);
  } catch (error) {
    state.backendHealthy = false;
    state.error = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

function markSynced(serverTime = new Date().toISOString()) {
  state.backendHealthy = true;
  state.lastSyncedAt = serverTime;
}

async function loadBootstrap() {
  try {
    const result = await api.get(
      "/app/bootstrap?communityId=community-demo",
      false,
    );
    Object.assign(state, {
      user: result.user,
      home: result.home,
      reportStats: result.reportStats,
      drillStats: result.drillStats,
      serverMode: result.mode || "demo",
    });
    markSynced(result.serverTime);
    return;
  } catch (error) {
    // Keep compatibility while an older controlled-test backend is being upgraded.
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }
  const [user, home, reportStats, drillStats] = await Promise.all([
    api.get("/me"),
    api.get("/home?communityId=community-demo"),
    api.get("/reports/stats"),
    api.get("/drills/stats"),
  ]);
  Object.assign(state, { user, home, reportStats, drillStats });
  markSynced();
}

async function loadHistory() {
  const [reports, drills, reportStats, drillStats] = await Promise.all([
    api.get("/reports/mine?pageSize=50"),
    api.get("/drills?pageSize=50"),
    api.get("/reports/stats"),
    api.get("/drills/stats"),
  ]);
  Object.assign(state, {
    reports: reports.items || [],
    drills: drills.items || [],
    reportStats,
    drillStats,
  });
  markSynced();
}

async function loadAssist() {
  state.assistError = "";
  try {
    state.assistRadar = await api.get("/agent/resident-radar");
    markSynced();
  } catch (error) {
    state.backendHealthy = false;
    state.assistRadar = localRadar(state.user);
    state.assistError = `服务器助手暂不可用：${error.message}。当前显示本地安全建议。`;
  }
}

async function loadRoute(route) {
  if (!state.session) {
    state.route = "welcome";
    render();
    return;
  }
  state.route = route;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  state.pageTitle = pageTitle(route);
  state.error = "";
  const staticRoutes = ["report", "register-done", "drill-start", "building-equipment", "building-escape", "building-chat", "emergency", "help"];
  state.loading = !staticRoutes.includes(route) && !route.startsWith("drill/");
  render();
  try {
    if (route === "register") {
      await prepareOnboarding();
    } else if (route === "home") {
      await loadBootstrap();
    } else if (route === "hazards") {
      const query = state.hazardFilter ? `&status=${encodeURIComponent(state.hazardFilter)}` : "";
      const reports = await api.get(`/reports/mine?pageSize=50${query}`);
      state.reports = reports.items || [];
      markSynced();
    } else if (route === "assist") {
      await loadAssist();
    } else if (route === "building") {
      await loadDevices();
    } else if (route === "me") {
      await loadBootstrap();
    } else if (route === "devices") {
      await loadDevices();
    } else if (["history", "my-reports", "drill-records"].includes(route)) {
      await loadHistory();
    } else if (route.startsWith("report/")) {
      state.reportDetail = await api.get(`/reports/${encodeURIComponent(route.split("/")[1])}`);
      markSynced();
    } else if (route.startsWith("drill/")) {
      const id = route.split("/")[1];
      if (!state.drill || state.drill.id !== id)
        state.drill = await api.get(`/drills/${encodeURIComponent(id)}`);
      state.drillStartedAt = Date.parse(state.drill.startedAt);
      state.drillStep = state.drill.completedSteps?.some((item) => item.id === "exit") ? 2 : 1;
      markSynced();
    } else if (route.startsWith("summary/")) {
      state.drillSummary = await api.get(`/drills/${encodeURIComponent(route.split("/")[1])}`);
      markSynced();
    } else if (route === "notices") {
      state.home ||= await api.get("/home?communityId=community-demo");
    } else if (route === "profile") {
      state.user = await api.get("/me");
      markSynced();
    }
  } catch (error) {
    if (error.status === 401) {
      await restoreOrIssue(true);
      return;
    }
    state.backendHealthy = false;
    state.error = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

async function issueSession(existing = null) {
  const installationKey = existing?.installationKey || randomKey();
  const issued = await api.post("/auth/demo-session", {
    installationKey,
    platform: platformName(),
    clientVersion: "1.4.0",
  });
  state.session = {
    ...issued,
    installationKey,
    ...(existing?.onboarding ? { onboarding: existing.onboarding } : {}),
  };
  state.user = issued.user;
  markSynced();
  api.setToken(issued.token);
  await writeSession(state.session);
}

async function restoreOrIssue(forceIssue = false) {
  state.busy = true;
  state.error = "";
  render();
  try {
    const stored = state.session || (await readSession());
    if (stored && !forceIssue && Date.parse(stored.expiresAt) > Date.now()) {
      api.setToken(stored.token);
      try {
        const user = await api.get("/me", false);
        state.session = stored;
        state.user = user;
        state.session.user = user;
        markSynced();
        await writeSession(state.session);
      } catch (error) {
        if (error.status !== 401) throw error;
        await issueSession(stored);
      }
    } else {
      await issueSession(stored);
    }
    navigate(state.session?.onboarding?.completed ? "home" : "register", true);
  } catch (error) {
    state.route = "welcome";
    state.error = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

function persistDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state.reportDraft));
  } catch {}
}

async function sendAssist(rawText) {
  const text = String(rawText || "").trim();
  if (!text || state.assistBusy) return;
  const userMessage = { id: `assist-u-${Date.now()}`, role: "user", text, card: null };
  state.assistMessages.push(userMessage);
  state.assistDraft = "";
  state.assistBusy = true;
  state.assistError = "";
  render();
  const history = state.assistMessages
    .filter((item) => item.id !== "assist-hello")
    .map((item) => ({ role: item.role, content: item.text }))
    .slice(-8);
  let result;
  try {
    result = await api.post("/agent/resident-assist", {
      role: state.assistRole,
      messages: history,
    });
    markSynced();
  } catch (error) {
    state.backendHealthy = false;
    const card = localAssist(state.assistRole, text, state.user);
    result = {
      reply: `${card.reply}（网络不可用，已使用本地安全建议）`,
      card,
    };
    state.assistError = `服务器助手暂不可用：${error.message}`;
  } finally {
    state.assistBusy = false;
  }
  state.assistMessages.push({
    id: `assist-a-${Date.now()}`,
    role: "assistant",
    text: result.reply || result.card?.reply || "已生成安全建议。",
    card: result.card || null,
  });
  render();
  requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
}

function openAssistStep(messageId, stepIndex) {
  const message = state.assistMessages.find((item) => item.id === messageId);
  const card = message?.card;
  const step = card?.nextSteps?.[Number(stepIndex)];
  if (!step) return;
  const routes = {
    "/pages/report/report": "report",
    "/pages/emergency/emergency": "emergency",
    "/pages/building-escape/building-escape": "building-escape",
    "/pages/my-reports/my-reports": "my-reports",
  };
  if (step.url === "/pages/report/report" && card.reportDraft) {
    const draft = card.reportDraft;
    Object.assign(state.reportDraft, {
      categoryId: "other",
      hazardId: "custom",
      hazardName: draft.hazardName || "助手建议",
      customName: draft.hazardName || "助手建议",
      type: draft.type || "other",
      location: draft.location || state.reportDraft.location,
      description: draft.description || "",
    });
    persistDraft();
  }
  navigate(routes[step.url] || "home");
}

function updateDraftFromForm(form) {
  const data = new FormData(form);
  for (const field of ["location", "description", "contact", "customName"])
    if (data.has(field)) state.reportDraft[field] = String(data.get(field) || "").trim();
  persistDraft();
}

async function submitReport(form) {
  updateDraftFromForm(form);
  const draft = state.reportDraft;
  const hazardName = draft.hazardId === "custom" ? draft.customName : draft.hazardName;
  if (!state.photos.length) {
    state.error = "请先拍摄或选择至少一张现场照片";
    render();
    return;
  }
  if (!draft.hazardId) {
    state.error = "请选择隐患类型";
    render();
    return;
  }
  if (!hazardName || hazardName.length < 2) {
    state.error = "请填写自定义隐患名称（至少2个字）";
    render();
    return;
  }
  if (draft.location.length < 2 || draft.description.length < 5) {
    state.error = "请填写具体位置和至少5字描述";
    render();
    return;
  }
  if (draft.contact && !/^[0-9+()\- ]{5,30}$/.test(draft.contact)) {
    state.error = "请填写有效联系电话，或留空";
    render();
    return;
  }

  state.busy = true;
  state.error = "";
  state.reportKey ||= `judge-report-${uuid()}`;
  render();
  try {
    if (state.reportAttempted) {
      try {
        const existing = await api.get(`/reports/submission/${encodeURIComponent(state.reportKey)}`, false);
        state.reportDetail = existing;
        state.reportJustCreated = true;
        navigate(`report/${existing.id}`);
        return;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
      }
    }
    state.reportAttempted = true;
    const attachmentIds = [];
    for (const item of state.photos) {
      const fingerprint = `${item.file.name}:${item.file.size}:${item.file.lastModified}`;
      let attachmentId = state.uploadedPhotos.get(fingerprint);
      if (!attachmentId) {
        attachmentId = (await api.upload(item.file)).id;
        state.uploadedPhotos.set(fingerprint, attachmentId);
      }
      attachmentIds.push(attachmentId);
    }
    const saved = await api.post("/reports", {
      idempotencyKey: state.reportKey,
      floorId: state.floorId || "floor-1-1-6",
      type: draft.type,
      location: draft.location,
      description: `【${hazardName}】${draft.description}`,
      contact: draft.contact || "00000",
      attachmentIds,
    });
    state.reportDetail = saved;
    state.reportJustCreated = true;
    state.photos.forEach((item) => URL.revokeObjectURL(item.preview));
    state.photos = [];
    state.reportDraft = {
      categoryId: "",
      hazardId: "",
      hazardName: "",
      customName: "",
      type: "other",
      location: draft.location,
      description: "",
      contact: "",
    };
    localStorage.removeItem(DRAFT_KEY);
    state.reportKey = "";
    state.reportAttempted = false;
    state.uploadedPhotos.clear();
    navigate(`report/${saved.id}`);
  } catch (error) {
    state.error = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

async function startDrill() {
  state.busy = true;
  state.error = "";
  render();
  try {
    const drill = await api.post("/drills", {
      floorId: state.floorId || "floor-1-1-6",
      idempotencyKey: `judge-drill-${uuid()}`,
    });
    Object.assign(state, { drill, drillStep: 1, drillStartedAt: Date.now() });
    navigate(`drill/${drill.id}`);
  } catch (error) {
    state.error = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

function drillDuration() {
  return Math.max(0, Math.min(86400000, Date.now() - (state.drillStartedAt || Date.now())));
}

async function advanceDrill(finish = false) {
  state.busy = true;
  state.error = "";
  render();
  try {
    if (!finish) {
      state.drill = await api.put(`/drills/${state.drill.id}/progress`, {
        durationMs: drillDuration(),
        completedSteps: ["exit"],
      });
      state.drillStep = 2;
    } else {
      const result = await api.post(`/drills/${state.drill.id}/complete`, {
        durationMs: drillDuration(),
        completedSteps: ["exit", "assembly"],
      });
      state.drillSummary = result;
      navigate(`summary/${result.id}`);
    }
  } catch (error) {
    state.error = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

async function updateFloor(id, number) {
  state.floorId = id;
  state.floorNumber = Number(number);
  state.loading = true;
  render();
  try {
    const result = await api.get(`/devices?floorId=${encodeURIComponent(id)}`);
    state.devices = result.items || [];
  } catch (error) {
    state.error = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}

app.addEventListener("click", async (event) => {
  const target = event.target.closest("button,[data-route],[data-action]");
  if (!target || target.disabled) return;
  const route = target.dataset.route;
  if (route) {
    if (route === "report") state.reportJustCreated = false;
    navigate(route);
    return;
  }
  const action = target.dataset.action;
  if (action === "direct") await restoreOrIssue(true);
  else if (action === "onboarding-home") {
    await rememberOnboarding(true);
    navigate("home", true);
  } else if (action === "onboarding-privacy") {
    state.showOnboardingPrivacy = false;
    render();
  } else if (action === "onboarding-back") {
    state.onboardingStep = 1;
    state.showOnboardingPrivacy = false;
    render();
  } else if (action === "onboarding-adjust") {
    const key = target.dataset.key;
    const delta = Number(target.dataset.delta || 0);
    if (!["elderly", "children", "pets"].includes(key)) return;
    state.onboardingDraft[key] = Math.max(0, Number(state.onboardingDraft[key] || 0) + delta);
    render();
  } else if (action === "onboarding-situation") {
    const id = target.dataset.id;
    const selected = new Set(state.onboardingDraft.situations || []);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    state.onboardingDraft.situations = [...selected];
    render();
  } else if (action === "onboarding-skip") await saveOnboarding(true);
  else if (action === "onboarding-save") await saveOnboarding(false);
  else if (action === "onboarding-enter-home") navigate("home", true);
  else if (action === "onboarding-edit") {
    state.editingOnboarding = true;
    state.onboardingStep = 1;
    navigate("register", true);
  }
  else if (action === "back") history.back();
  else if (action === "retry-page") await loadRoute(state.route);
  else if (action === "retry-report") document.querySelector("#report-form")?.requestSubmit();
  else if (action === "remove-photo") {
    const [removed] = state.photos.splice(Number(target.dataset.index), 1);
    if (removed) URL.revokeObjectURL(removed.preview);
    render();
  } else if (action === "preview-image") {
    state.previewImage = target.dataset.src;
    render();
  } else if (action === "close-preview") {
    state.previewImage = "";
    render();
  } else if (action === "filter-hazards") {
    state.hazardFilter = target.dataset.status || "";
    await loadRoute("hazards");
  } else if (action === "assist-role") {
    state.assistRole = target.dataset.role || "identify";
    state.assistError = "";
    render();
  } else if (action === "assist-quick") {
    await sendAssist(target.dataset.text);
  } else if (action === "assist-step") {
    openAssistStep(target.dataset.messageId, target.dataset.stepIndex);
  } else if (action === "select-hazard-category") {
    const category = hazardCategories.find((item) => item.id === target.dataset.id);
    if (!category) return;
    Object.assign(state.reportDraft, {
      categoryId: category.id,
      hazardId: "",
      hazardName: "",
      customName: "",
      type: category.legacyType,
    });
    persistDraft();
    render();
  } else if (action === "select-hazard") {
    for (const category of hazardCategories) {
      const hazard = category.items.find((item) => item.id === target.dataset.id);
      if (!hazard) continue;
      Object.assign(state.reportDraft, {
        categoryId: category.id,
        hazardId: hazard.id,
        hazardName: hazard.name,
        customName: hazard.custom ? state.reportDraft.customName : "",
        type: category.legacyType,
      });
      persistDraft();
      render();
      break;
    }
  } else if (action === "open-report") {
    state.reportJustCreated = false;
    navigate(`report/${target.dataset.id}`);
  } else if (action === "open-drill") {
    navigate(`${target.dataset.status === "in_progress" ? "drill" : "summary"}/${target.dataset.id}`);
  } else if (action === "start-drill" || action === "repeat-drill") await startDrill();
  else if (action === "drill-next") await advanceDrill(false);
  else if (action === "drill-finish") await advanceDrill(true);
  else if (action === "select-floor") await updateFloor(target.dataset.id, target.dataset.floor);
  else if (action === "placeholder") showToast(`${target.dataset.label}暂未开放，本次可体验隐患、楼栋和演练`);
  else if (action === "safe-call") showToast(`演示模式：不会实际联系${target.dataset.label}`);
  else if (action === "logout") {
    if (!confirm("退出后将清理本机匿名会话。服务器记录会保留，但新会话无法查看旧记录。确定退出吗？")) return;
    try { await api.post("/auth/logout", {}); } catch {}
    await clearSession();
    state.session = null;
    state.user = null;
    state.onboardingInitialized = false;
    state.onboardingStep = 1;
    state.onboardingErrors = {};
    api.setToken("");
    history.replaceState({}, "", "#/welcome");
    state.route = "welcome";
    render();
  }
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (event.target.id === "onboarding-form") {
    const data = new FormData(event.target);
    state.onboardingDraft.unitId = String(data.get("unitId") || "");
    state.onboardingDraft.floorId = String(data.get("floorId") || "");
    state.onboardingDraft.room = String(data.get("room") || "").trim();
    state.onboardingDraft.familyCount = String(data.get("familyCount") || "").trim();
    state.onboardingErrors = onboardingErrors();
    if (Object.keys(state.onboardingErrors).length) {
      render();
      return;
    }
    state.onboardingStep = 2;
    state.showOnboardingPrivacy = true;
    render();
  } else if (event.target.id === "report-form") await submitReport(event.target);
  else if (event.target.id === "assist-form") {
    await sendAssist(new FormData(event.target).get("message"));
  }
  else if (event.target.id === "profile-form") {
    const nickname = String(new FormData(event.target).get("nickname") || "").trim();
    if (!nickname) return;
    state.busy = true;
    render();
    try {
      state.user = await api.patch("/me", { nickname });
      showToast("资料已保存");
    } catch (error) {
      state.error = error.message;
    } finally {
      state.busy = false;
      render();
    }
  } else if (event.target.id === "chat-form") {
    const text = String(new FormData(event.target).get("message") || "").trim();
    if (!text) return;
    const now = new Date();
    state.chatMessages.push({
      id: `m-${Date.now()}`,
      name: "我",
      avatar: "我",
      floor: "本机",
      role: "mine",
      mine: true,
      text,
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    });
    state.chatDraft = "";
    state.aiSummary = `AI 已纳入你的演示补充：${text}。本页消息只保存在当前运行过程，不会真实发送。`;
    render();
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  }
});

app.addEventListener("input", (event) => {
  const onboardingField = event.target.dataset.onboardingField;
  if (onboardingField) {
    state.onboardingDraft[onboardingField] = event.target.value;
    delete state.onboardingErrors[onboardingField];
  }
  if (event.target.form?.id === "report-form" && event.target.name) {
    state.reportDraft[event.target.name] = event.target.value;
    persistDraft();
  }
  if (event.target.form?.id === "chat-form") state.chatDraft = event.target.value;
  if (event.target.form?.id === "assist-form") state.assistDraft = event.target.value;
});

app.addEventListener("change", async (event) => {
  if (event.target.dataset.action === "onboarding-unit") {
    state.onboardingDraft.unitId = event.target.value;
    const unit = state.building?.units?.find((item) => item.id === event.target.value);
    state.onboardingDraft.floorId = unit?.floors?.find((item) => item.number === 6)?.id
      || unit?.floors?.[0]?.id
      || "";
    delete state.onboardingErrors.unitId;
    delete state.onboardingErrors.floorId;
    render();
  } else if (event.target.dataset.action === "onboarding-floor") {
    state.onboardingDraft.floorId = event.target.value;
    delete state.onboardingErrors.floorId;
    render();
  } else if (event.target.dataset.action === "floor-select") {
    const option = event.target.selectedOptions[0];
    await updateFloor(event.target.value, option.dataset.floor);
  } else if (event.target.dataset.action === "toggle-fire") {
    state.demoFire = event.target.checked;
    render();
  } else if (event.target.dataset.action === "photos") {
    const selected = [...event.target.files];
    const accepted = [];
    for (const file of selected) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        showToast("仅支持 JPG、PNG、WebP 图片");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("单张图片不能超过 5 MB");
        continue;
      }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }
    const candidates = state.photos.concat(accepted);
    state.photos = candidates.slice(0, 3);
    candidates.slice(3).forEach((item) => URL.revokeObjectURL(item.preview));
    render();
  }
});

window.addEventListener("online", () => {
  state.online = true;
  render();
  showToast("网络已恢复");
});
window.addEventListener("offline", () => {
  state.online = false;
  state.backendHealthy = false;
  render();
});
window.addEventListener("popstate", () => loadRoute(currentHash()));

installBackHandler(() => {
  if (state.previewImage) {
    state.previewImage = "";
    render();
    return true;
  }
  if (state.route === "register" && state.onboardingStep === 2) {
    state.onboardingStep = 1;
    state.showOnboardingPrivacy = false;
    render();
    return true;
  }
  if (state.route === "register") {
    navigate("welcome", true);
    return true;
  }
  if (state.route === "register-done") {
    state.editingOnboarding = true;
    state.onboardingStep = 1;
    navigate("register", true);
    return true;
  }
  if (["home", "hazards", "assist", "building", "me"].includes(state.route)) return false;
  history.back();
  return true;
});

async function boot() {
  render();
  const stored = await readSession();
  if (!stored) return;
  state.session = stored;
  await restoreOrIssue(false);
}

boot();
