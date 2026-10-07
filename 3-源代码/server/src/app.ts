import Fastify, { type FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import staticFiles from "@fastify/static";
import cors from "@fastify/cors";
import { z, ZodError } from "zod";
import {
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { Store } from "./db.js";
import { settings, type Settings } from "./config.js";
import { ApiError, fail, hash, id, now, text } from "./core.js";
import { registerStaff } from "./staff.js";
import { registerCamera } from "./camera.js";
import { residentAssistSchema, runResidentAgent } from "./resident-agent.js";
const key = text(8, 100);
const iso = z.iso.datetime();
const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z
    .enum(["pending", "processing", "completed", "in_progress", "aborted"])
    .optional(),
  communityId: text().optional(),
  buildingId: text().optional(),
  floorId: text().optional(),
});
const reportSchema = z
  .object({
    idempotencyKey: key,
    floorId: text(),
    deviceId: text().optional(),
    type: z.enum(["fire", "obstruction", "equipment", "electrical", "other"]),
    location: text(2, 160),
    description: text(5, 2000),
    contact: z
      .string()
      .trim()
      .regex(/^[0-9+()\- ]{5,30}$/),
    attachmentIds: z.array(z.uuid()).max(3).default([]),
  })
  .strict();
const progressSchema = z
  .object({
    durationMs: z.number().int().min(0).max(86400000),
    completedSteps: z.array(z.enum(["exit", "assembly"])).max(2),
  })
  .strict();
const draftTerms =
  "安居云枢用户协议（待业务审核草稿）\n本服务提供社区信息、隐患上报及线上安全知识演练。线上演练不证明已经到达现场，不替代应急部门指挥。上报不等于救援受理；紧急情况请主动拨打公共紧急电话。正式运营主体、服务范围、争议解决和联系方式须由运营方审核配置。";
const draftPrivacy =
  "隐私说明（待业务审核草稿）\n登录使用微信身份标识建立业务账户，不强制获取手机号或头像。主动提交的住址、联系信息、图片和描述用于处理上报；演练记录用于个人历史回看。上报附件仅限本人和本社区授权物业访问，社区列表不公开联系方式或私人位置。图片由服务端重编码移除元数据。本地联调请使用测试资料。保存期限、删除渠道、运营主体及第三方处理情况须由运营方审核配置。";

export async function buildApp(cfg: Settings = settings()) {
  const app = Fastify({ logger: false, bodyLimit: 128 * 1024 });
  const db = new Store(cfg);
  app.addHook("onClose", async () => db.close());
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 240,
    timeWindow: "1 minute",
    // HTML, CSS, images and byte-range video requests are public static
    // resources. Keep the shared limiter for API traffic only.
    allowList: (req) => !req.url.startsWith("/api/"),
  });
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || cfg.clientOrigins.includes(origin)) callback(null, true);
      else callback(null, false);
    },
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Data-Mode",
      "X-Anju-Client",
    ],
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS"],
    maxAge: 86400,
  });
  app.addHook("onRequest", async (req) => {
    const requested = req.headers["x-data-mode"];
    if (requested && requested !== cfg.mode)
      fail(409, "MODE_MISMATCH", "客户端与后端数据模式不一致，请检查配置");
    // Browser writes are same-origin and carry a non-simple header. No CORS wildcard.
    // Protect login too, to prevent login CSRF; bearer requests from wx do not use cookies.
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        (req.cookies.anju_session || req.url.startsWith("/api/staff/"))) {
      if (req.headers["x-anju-request"] !== "1" ||
          (req.headers.origin && !cfg.webOrigins.includes(req.headers.origin)))
        fail(403, "CSRF_REJECTED", "网页请求来源无效，请从本地站点重新打开");
    }
  });
  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "same-origin");
    reply.header("X-Frame-Options", "DENY");
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    return payload;
  });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  });
  app.setErrorHandler((err, req, reply) => {
    const e = err as any;
    const status =
      e instanceof ZodError ? 400 : e.status || e.statusCode || 500;
    const code =
      e instanceof ZodError ? "VALIDATION_ERROR" : e.code || "INTERNAL_ERROR";
    reply.code(status).send({
      error: {
        code,
        message:
          e instanceof ZodError
            ? "输入信息不完整或格式不正确"
            : status >= 500 && !(e instanceof ApiError)
              ? "服务暂不可用，请稍后重试"
              : e.message,
        requestId: req.id,
      },
    });
  });
  const auth = (req: FastifyRequest): any => {
    const token = req.headers.authorization?.replace(/^Bearer /, "") || req.cookies.anju_session || "";
    const user = db.one(
      "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
      hash(token),
      now(),
    );
    return user || fail(401, "SESSION_EXPIRED", "登录已过期，请重新登录");
  };
  const floor = (floorId: string) =>
    db.one(
      `SELECT f.*,u.name unit_name,u.building_id,b.name building_name,b.community_id,c.name community_name,c.meeting_point FROM floors f JOIN units u ON f.unit_id=u.id JOIN buildings b ON u.building_id=b.id JOIN communities c ON b.community_id=c.id WHERE f.id=?`,
      floorId,
    ) || fail(404, "NOT_FOUND", "楼层不存在");
  const scope = (userId: string, floorId: string) => {
    const f = floor(floorId);
    if (db.one("SELECT m.user_id FROM staff_memberships m JOIN staff_accounts a ON a.user_id=m.user_id WHERE m.user_id=? AND m.community_id=? AND m.role IN ('manager','operator') AND a.active=1", userId, f.community_id)) return f;
    const binding = db.one(
      "SELECT bi.id FROM bindings bi JOIN residences r ON bi.residence_id=r.id JOIN floors f ON r.floor_id=f.id JOIN units u ON f.unit_id=u.id WHERE bi.user_id=? AND u.building_id=? AND bi.verification<>'rejected'" + (cfg.mode === "production" ? " AND bi.verification='verified'" : ""),
      userId,
      f.building_id,
    );
    if (!binding)
      fail(403, "BUILDING_SCOPE", cfg.mode === "production" ? "请先绑定并通过该楼栋住址审核" : "请先绑定该楼栋住址；绑定不代表住户认证");
    return f;
  };
  const bindings = (userId: string) =>
    db
      .all(
        `SELECT bi.id,bi.verification,bi.is_current isCurrent,r.room,f.id floorId,f.number floorNumber,u.id unitId,u.name unitName,b.id buildingId,b.name buildingName,c.id communityId,c.name communityName FROM bindings bi JOIN residences r ON bi.residence_id=r.id JOIN floors f ON r.floor_id=f.id JOIN units u ON f.unit_id=u.id JOIN buildings b ON u.building_id=b.id JOIN communities c ON b.community_id=c.id WHERE bi.user_id=? ORDER BY bi.is_current DESC,bi.created_at DESC`,
        userId,
      )
      .map((x) => ({
        ...x,
        address: `${x.communityName} ${x.buildingName} ${x.unitName} ${x.floorNumber}层 ${x.room}`,
      }));
  const userView = (u: any) => ({
    id: u.id,
    nickname: u.nickname,
    bindings: bindings(u.id),
    mode: cfg.mode,
  });
  const issueSession = (user: any, hours = cfg.sessionHours) => {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();
    db.run(
      "INSERT INTO sessions VALUES (?,?,?)",
      hash(token),
      user.id,
      expiresAt,
    );
    return { token, expiresAt, user: userView(user) };
  };
  const login = (identity: string, version: string) => {
    let user = db.one("SELECT * FROM users WHERE identity=?", identity);
    if (!user) {
      db.run(
        "INSERT INTO users VALUES (?,?,?,?,?)",
        id(),
        identity,
        "社区居民",
        now(),
        version,
      );
      user = db.one("SELECT * FROM users WHERE identity=?", identity);
    }
    db.run("UPDATE users SET legal_version=? WHERE id=?", version, user.id);
    return issueSession(user);
  };
  const ownReport = (userId: string, reportId: string) =>
    db.one(
      "SELECT * FROM hazard_reports WHERE id=? AND user_id=?",
      reportId,
      userId,
    ) || fail(404, "NOT_FOUND", "记录不存在或无权访问");
  const reportView = (r: any) => ({
    id: r.id,
    number: r.number,
    type: r.type,
    location: r.location,
    description: r.description,
    contact: r.contact,
    status: r.status,
    createdAt: r.created_at,
    floorId: r.floor_id,
    deviceId: r.device_id,
    buildingName: floor(r.floor_id).building_name,
    communityId: floor(r.floor_id).community_id,
    source: cfg.mode,
    events: db.all(
      "SELECT status,message,occurred_at occurredAt FROM report_events WHERE report_id=? ORDER BY occurred_at,id",
      r.id,
    ),
    attachmentIds: db
      .all(
        "SELECT attachment_id id FROM report_attachments WHERE report_id=?",
        r.id,
      )
      .map((a) => a.id),
  });
  const ownDrill = (userId: string, drillId: string) =>
    db.one(
      "SELECT * FROM drill_sessions WHERE id=? AND user_id=?",
      drillId,
      userId,
    ) || fail(404, "NOT_FOUND", "演练不存在或无权访问");
  const drillView = (s: any) => ({
    id: s.id,
    drillSessionId: s.id,
    status: s.status,
    startedAt: s.started_at,
    completedAt: s.completed_at,
    durationMs: s.duration_ms,
    durationSeconds: Math.floor(s.duration_ms / 1000),
    snapshot: JSON.parse(s.snapshot),
    stepVersion: s.step_version,
    totalSteps: 2,
    completedSteps: db.all(
      "SELECT step_id id,confirmed_at confirmedAt FROM drill_steps WHERE session_id=? ORDER BY CASE step_id WHEN 'exit' THEN 1 ELSE 2 END",
      s.id,
    ),
    saved: true,
  });
  const saveProgress = (
    userId: string,
    drillId: string,
    input: any,
    action: "progress" | "complete" | "abort",
  ) =>
    db.tx(() => {
      const s = ownDrill(userId, drillId);
      if (s.status !== "in_progress") {
        if (
          (action === "complete" && s.status === "completed") ||
          (action === "abort" && s.status === "aborted") ||
          action === "progress"
        )
          return drillView(s);
        fail(409, "DRILL_STATE", "演练已经结束，无法改变结束状态");
      }
      const p = progressSchema.parse(input);
      if (
        p.durationMs >
        Math.max(0, Date.now() - Date.parse(s.started_at)) + 2000
      )
        fail(400, "INVALID_DURATION", "参与时长不能超过会话经过的时间");
      const known = new Set(
        db
          .all("SELECT step_id FROM drill_steps WHERE session_id=?", s.id)
          .map((x) => x.step_id),
      );
      p.completedSteps.forEach((x) => known.add(x));
      if (known.has("assembly") && !known.has("exit"))
        fail(400, "STEP_ORDER", "请先确认本层安全出口");
      if (action === "complete" && known.size !== 2)
        fail(409, "STEPS_INCOMPLETE", "请确认两个线上演练步骤后结束");
      for (const step of p.completedSteps)
        db.run(
          "INSERT OR IGNORE INTO drill_steps VALUES (?,?,?)",
          s.id,
          step,
          now(),
        );
      db.run(
        "UPDATE drill_sessions SET duration_ms=MAX(duration_ms,?),status=?,completed_at=? WHERE id=?",
        p.durationMs,
        action === "complete"
          ? "completed"
          : action === "abort"
            ? "aborted"
            : "in_progress",
        action === "progress" ? null : now(),
        s.id,
      );
      return drillView(ownDrill(userId, s.id));
    });
  const deviceView = (d: any) => {
    const reading = db.one(
      "SELECT value,unit,collected_at collectedAt,source,is_test isTest FROM readings WHERE device_id=? ORDER BY collected_at DESC,id DESC LIMIT 1",
      d.id,
    );
    const event = db.one(
      "SELECT event_id eventId,event_type eventType,severity,occurred_at occurredAt,source,is_test isTest FROM device_events WHERE device_id=? AND event_type IN ('alarm','clear') ORDER BY occurred_at DESC,event_id DESC LIMIT 1",
      d.id,
    );
    return {
      id: d.id,
      name: d.name,
      type: d.type,
      floorId: d.floor_id,
      location: d.location,
      lastSeenAt: d.last_seen_at,
      source: d.source,
      connectionStatus: !d.last_seen_at
        ? "unknown"
        : Date.now() - Date.parse(d.last_seen_at) <= cfg.onlineSeconds * 1000
          ? "online"
          : "offline",
      reading: reading
        ? {
            ...reading,
            freshness:
              Date.now() - Date.parse(reading.collectedAt) <=
              cfg.freshSeconds * 1000
                ? "fresh"
                : "stale",
          }
        : null,
      event: event || null,
      eventStatus: !event
        ? "unknown"
        : event.eventType === "alarm"
          ? "alarm"
          : event.eventType === "clear"
            ? "cleared"
            : "unknown",
    };
  };
  const route = (
    method: any,
    url: string,
    fn: (r: any, p: any) => any,
    options: Record<string, unknown> = {},
  ) =>
    app.route({
      method,
      url: "/api" + url,
      ...options,
      handler: async (r, p) => {
        const out = await fn(r, p);
        if (!p.sent) return { data: out };
      },
    });
  const homePayload = (communityId?: string) => {
    const c = communityId
      ? db.one("SELECT * FROM communities WHERE id=?", communityId)
      : db.one("SELECT * FROM communities ORDER BY id LIMIT 1");
    if (!c)
      return {
        community: null,
        buildings: [],
        announcements: [],
        reportCount: 0,
        deviceCount: 0,
      };
    return {
      community: { id: c.id, name: c.name, source: c.source },
      buildings: db.all(
        "SELECT id,name FROM buildings WHERE community_id=?",
        c.id,
      ),
      announcements: db.all(
        "SELECT id,title,body,published_at publishedAt,source FROM announcements WHERE community_id=? ORDER BY published_at DESC LIMIT 3",
        c.id,
      ),
      reportCount: db.one(
        "SELECT COUNT(*) n FROM hazard_reports h JOIN floors f ON h.floor_id=f.id JOIN units u ON f.unit_id=u.id JOIN buildings b ON u.building_id=b.id WHERE b.community_id=?",
        c.id,
      ).n,
      deviceCount: db.one(
        "SELECT COUNT(*) n FROM devices d JOIN floors f ON d.floor_id=f.id JOIN units u ON f.unit_id=u.id JOIN buildings b ON u.building_id=b.id WHERE b.community_id=?",
        c.id,
      ).n,
    };
  };
  const reportStatsPayload = (userId: string) => {
    const out: any = { total: 0, pending: 0, processing: 0, completed: 0 };
    for (const row of db.all(
      "SELECT status,COUNT(*) n FROM hazard_reports WHERE user_id=? GROUP BY status",
      userId,
    )) {
      out[row.status] = row.n;
      out.total += row.n;
    }
    return out;
  };
  const drillStatsPayload = (userId: string) => {
    const stats = db.one(
      "SELECT COUNT(*) completedCount,COALESCE(SUM(duration_ms),0) durationMs FROM drill_sessions WHERE user_id=? AND status='completed'",
      userId,
    );
    return {
      ...stats,
      durationSeconds: Math.floor(stats.durationMs / 1000),
      completedSteps: db.one(
        "SELECT COUNT(*) n FROM drill_steps st JOIN drill_sessions d ON st.session_id=d.id WHERE d.user_id=? AND d.status='completed'",
        userId,
      ).n,
    };
  };
  route("GET", "/health", () => ({ status: "ok", mode: cfg.mode }));
  route("GET", "/config", () => ({
    mode: cfg.mode,
    publicDemo: cfg.publicDemo,
    demoExperience: cfg.demoExperience,
    developmentLogin: cfg.mode === "demo" && !cfg.production && !cfg.publicDemo,
    staffDemoLogin: cfg.mode === "demo" && !cfg.production && !cfg.publicDemo,
    legalVersion: cfg.legalVersion,
    legalApproved: cfg.legalApproved,
    terms: cfg.legal?.terms || draftTerms,
    privacy: cfg.legal?.privacy || draftPrivacy,
    propertyPhone: cfg.propertyPhone,
    propertyUpdatedAt: cfg.propertyUpdatedAt,
    emergencyPhone: "119",
    help: "紧急求助拨号需您确认。上报提交不等于救援受理。线上演练仅记录知识查看与确认，不代表实际到达集合点。当前未接入订阅消息和真实硬件推送，请勿依赖本程序承诺全天候告警。",
    onlineSeconds: cfg.onlineSeconds,
    freshSeconds: cfg.freshSeconds,
  }));
  route(
    "POST",
    "/auth/demo-session",
    (r) => {
      if (!cfg.demoExperience)
        fail(403, "DEMO_EXPERIENCE_DISABLED", "当前环境未开放匿名体验");
      const p = z
        .object({
          installationKey: z
            .string()
            .regex(/^[A-Za-z0-9_-]{32,128}$/),
          platform: z.enum(["windows", "android", "web"]),
          clientVersion: text(1, 40),
        })
        .strict()
        .parse(r.body);
      const installHash = hash(p.installationKey);
      const user = db.tx(() => {
        let row = db.one(
          "SELECT u.* FROM demo_installations d JOIN users u ON u.id=d.user_id WHERE d.install_hash=?",
          installHash,
        );
        if (!row) {
          const userId = id();
          const createdAt = now();
          db.run(
            "INSERT INTO users VALUES (?,?,?,?,?)",
            userId,
            "demoapp:" + id(),
            `评委体验 ${userId.slice(0, 4).toUpperCase()}`,
            createdAt,
            "demo-experience",
          );
          const demoFloor = floor("floor-1-1-6");
          const room = `体验-${userId.slice(0, 8)}`;
          const residenceId = id();
          db.run(
            "INSERT INTO residences VALUES (?,?,?)",
            residenceId,
            demoFloor.id,
            room,
          );
          db.run(
            "INSERT INTO bindings VALUES (?,?,?,?,?,?)",
            id(),
            userId,
            residenceId,
            "demo",
            1,
            createdAt,
          );
          db.run(
            "INSERT INTO demo_installations VALUES (?,?,?,?,?,?)",
            installHash,
            userId,
            p.platform,
            p.clientVersion,
            createdAt,
            createdAt,
          );
          row = db.one("SELECT * FROM users WHERE id=?", userId);
        } else {
          db.run(
            "UPDATE demo_installations SET platform=?,client_version=?,last_seen_at=? WHERE install_hash=?",
            p.platform,
            p.clientVersion,
            now(),
            installHash,
          );
        }
        db.run("DELETE FROM sessions WHERE expires_at<=?", now());
        db.run("DELETE FROM sessions WHERE user_id=?", row.id);
        return row;
      });
      return issueSession(user, cfg.demoSessionHours);
    },
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
  );
  const loginBody = z
    .object({
      agreed: z.literal(true),
      legalVersion: text(),
      code: text().optional(),
      demoAccount: z.enum(["resident-a", "resident-b"]).optional(),
    })
    .strict();
  route("POST", "/auth/dev-login", (r) => {
    if (cfg.mode !== "demo" || cfg.production || cfg.publicDemo)
      fail(403, "DEV_LOGIN_DISABLED", "正式环境禁止演示登录");
    const p = loginBody.parse(r.body);
    if (p.legalVersion !== cfg.legalVersion)
      fail(409, "LEGAL_VERSION", "协议已更新，请重新阅读");
    return login("demo:" + (p.demoAccount || "resident-a"), p.legalVersion);
  });
  route("POST", "/auth/login", async (r) => {
    const p = loginBody.parse(r.body);
    if (cfg.mode !== "production")
      fail(400, "MODE_MISMATCH", "真实微信登录须连接正式数据模式");
    if (!cfg.legalApproved)
      fail(503, "LEGAL_NOT_CONFIGURED", "正式协议尚未配置审核");
    if (p.legalVersion !== cfg.legalVersion)
      fail(409, "LEGAL_VERSION", "协议已更新，请重新阅读");
    if (!p.code) fail(400, "LOGIN_CODE_REQUIRED", "缺少微信登录凭证");
    if (!cfg.appId || !cfg.appSecret)
      fail(503, "WECHAT_NOT_CONFIGURED", "服务端尚未配置微信登录凭据");
    let result: any;
    try {
      const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
      url.search = new URLSearchParams({
        appid: cfg.appId,
        secret: cfg.appSecret,
        js_code: p.code!,
        grant_type: "authorization_code",
      }).toString();
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error();
      result = await res.json();
    } catch {
      fail(502, "WECHAT_UNAVAILABLE", "微信身份服务暂不可用，请重试");
    }
    if (!result.openid || result.errcode)
      fail(401, "WECHAT_LOGIN_FAILED", "微信登录凭证失效，请重试");
    return login("wx:" + result.openid, p.legalVersion);
  });
  route("GET", "/me", (r) => userView(auth(r)));
  route("GET", "/agent/resident-radar", (r) => {
    const u = auth(r);
    const list = bindings(u.id);
    const binding = list.find((item) => item.isCurrent) || list[0];
    const stats = reportStatsPayload(u.id);
    const openReports =
      Number(stats.pending || 0) + Number(stats.processing || 0);
    const home = homePayload(binding?.communityId);
    const notice = home.announcements?.[0]?.title || "";
    return {
      configured: Boolean(cfg.llmApiKey),
      address: binding
        ? `${binding.communityName} ${binding.buildingName}${binding.unitName}${binding.floorNumber}层${binding.room || ""}`
        : "",
      openReports,
      notice,
      advice: binding
        ? openReports
          ? "您有待跟进的上报，可让助手整理下一步，或查看我的上报。"
          : "本址暂无待办隐患。发现通道占用、设施遮挡可随时问助手或上报。"
        : "绑定住址后，助手会结合本楼信息给出更贴身的建议。",
    };
  });
  app.post(
    "/api/agent/resident-assist",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (r) => {
      const u = auth(r);
      const p = residentAssistSchema.parse(r.body);
      const list = bindings(u.id);
      const binding = list.find((item) => item.isCurrent) || list[0];
      const stats = reportStatsPayload(u.id);
      const home = homePayload(binding?.communityId);
      return {
        data: await runResidentAgent(
          {
            cfg,
            address: binding
              ? `${binding.communityName} ${binding.buildingName}${binding.unitName}${binding.floorNumber}层`
              : "",
            openReports:
              Number(stats.pending || 0) + Number(stats.processing || 0),
            notice: home.announcements?.[0]?.title || "",
          },
          p,
        ),
      };
    },
  );
  route("GET", "/app/bootstrap", (r) => {
    const user = auth(r);
    const query = z.object({ communityId: text().optional() }).parse(r.query);
    return {
      user: userView(user),
      home: homePayload(query.communityId),
      reportStats: reportStatsPayload(user.id),
      drillStats: drillStatsPayload(user.id),
      serverTime: now(),
      mode: cfg.mode,
    };
  });
  route("PATCH", "/me", (r) => {
    const u = auth(r);
    const p = z
      .object({ nickname: text(1, 30) })
      .strict()
      .parse(r.body);
    db.run("UPDATE users SET nickname=? WHERE id=?", p.nickname, u.id);
    return userView({ ...u, nickname: p.nickname });
  });
  route("POST", "/auth/logout", (r) => {
    auth(r);
    db.run(
      "DELETE FROM sessions WHERE token_hash=?",
      hash(r.headers.authorization?.replace(/^Bearer /, "") || r.cookies.anju_session || ""),
    );
    return { loggedOut: true };
  });
  route("GET", "/bindings", (r) => bindings(auth(r).id));
  route("POST", "/bindings", (r) => {
    const u = auth(r),
      p = z
        .object({
          floorId: text(),
          room: text(1, 20).regex(/^[\p{L}\p{N} -]+$/u),
        })
        .strict()
        .parse(r.body);
    floor(p.floorId);
    return db.tx(() => {
      db.run(
        "INSERT OR IGNORE INTO residences VALUES (?,?,?)",
        id(),
        p.floorId,
        p.room,
      );
      const residence = db.one(
        "SELECT id FROM residences WHERE floor_id=? AND room=?",
        p.floorId,
        p.room,
      );
      db.run("UPDATE bindings SET is_current=0 WHERE user_id=?", u.id);
      db.run(
        "INSERT INTO bindings VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,residence_id) DO UPDATE SET is_current=1",
        id(),
        u.id,
        residence.id,
        "pending",
        1,
        now(),
      );
      return bindings(u.id);
    });
  });
  route("PUT", "/bindings/:id/current", (r) => {
    const u = auth(r);
    if (
      !db.one(
        "SELECT id FROM bindings WHERE id=? AND user_id=?",
        r.params.id,
        u.id,
      )
    )
      fail(404, "NOT_FOUND", "住址不存在");
    return db.tx(() => {
      db.run("UPDATE bindings SET is_current=0 WHERE user_id=?", u.id);
      db.run("UPDATE bindings SET is_current=1 WHERE id=?", r.params.id);
      return bindings(u.id);
    });
  });
  route("GET", "/communities", () =>
    db.all(
      "SELECT id,name,meeting_point meetingPoint,source FROM communities ORDER BY id",
    ),
  );
  route("GET", "/buildings", (r) => {
    const q = z.object({ communityId: text() }).parse(r.query);
    return db.all(
      "SELECT id,name,community_id communityId FROM buildings WHERE community_id=? ORDER BY id",
      q.communityId,
    );
  });
  route("GET", "/buildings/:id", (r) => {
    const b = db.one(
      "SELECT id,name,community_id communityId FROM buildings WHERE id=?",
      r.params.id,
    );
    if (!b) fail(404, "NOT_FOUND", "楼栋不存在");
    return {
      ...b,
      units: db
        .all("SELECT id,name FROM units WHERE building_id=? ORDER BY id", b.id)
        .map((u) => ({
          ...u,
          floors: db.all(
            "SELECT id,number,exit_text exitText FROM floors WHERE unit_id=? ORDER BY number",
            u.id,
          ),
        })),
    };
  });
  route("GET", "/announcements", (r) => {
    const q = paging.parse(r.query);
    const where = q.communityId ? "WHERE community_id=?" : "";
    const args = q.communityId ? [q.communityId] : [];
    return {
      items: db.all(
        `SELECT id,title,body,published_at publishedAt,source FROM announcements ${where} ORDER BY published_at DESC LIMIT ? OFFSET ?`,
        ...args,
        q.pageSize,
        (q.page - 1) * q.pageSize,
      ),
      total: db.one(`SELECT COUNT(*) n FROM announcements ${where}`, ...args).n,
      page: q.page,
      pageSize: q.pageSize,
    };
  });
  route("GET", "/home", (r) => {
    const q = z.object({ communityId: text().optional() }).parse(r.query);
    return homePayload(q.communityId);
  });
  route("POST", "/attachments", async (r) => {
    const u = auth(r);
    if (u.identity.startsWith("demoapp:")) {
      const recent = db.one(
        "SELECT COUNT(*) n FROM attachments WHERE user_id=? AND created_at>?",
        u.id,
        new Date(Date.now() - 3600000).toISOString(),
      ).n;
      const stored = db.one(
        "SELECT COALESCE(SUM(size),0) n FROM attachments WHERE user_id=?",
        u.id,
      ).n;
      if (recent >= 20)
        fail(429, "UPLOAD_RATE", "体验会话每小时最多上传20张图片");
      if (stored >= 25 * 1024 * 1024)
        fail(413, "UPLOAD_QUOTA", "体验会话图片空间已达25MB上限");
    }
    const part = await r.file();
    if (!part) fail(400, "FILE_REQUIRED", "请选择图片");
    if (!["image/jpeg", "image/png", "image/webp"].includes(part.mimetype))
      fail(415, "FILE_TYPE", "仅支持 JPG、PNG、WebP 图片");
    const input = await part.toBuffer();
    if (part.file.truncated)
      fail(413, "FILE_TOO_LARGE", "单张图片不能超过 5MB");
    let output: Buffer;
    try {
      const meta = await sharp(input, {
        limitInputPixels: 25000000,
      }).metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format || ""))
        throw new Error();
      output = await sharp(input, { limitInputPixels: 25000000 })
        .rotate()
        .resize({
          width: 2000,
          height: 2000,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      fail(415, "INVALID_IMAGE", "图片文件损坏或格式不受支持");
    }
    const aid = id(),
      filename = aid + ".jpg";
    fs.writeFileSync(path.join(cfg.uploadDir, filename), output!);
    try {
      db.run(
        "INSERT INTO attachments VALUES (?,?,?,?,?,?)",
        aid,
        u.id,
        filename,
        "image/jpeg",
        output!.length,
        now(),
      );
    } catch (e) {
      fs.unlinkSync(path.join(cfg.uploadDir, filename));
      throw e;
    }
    return { id: aid, mime: "image/jpeg", size: output!.length };
  }, { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } });
  route("GET", "/attachments/:id", async (r, p) => {
    const u = auth(r);
    const a = db.one("SELECT * FROM attachments WHERE id=?", r.params.id);
    if (!a) fail(404, "NOT_FOUND", "图片不存在或无权访问");
    if (a.user_id !== u.id && !db.one(`SELECT ra.attachment_id FROM report_attachments ra
      JOIN hazard_reports h ON h.id=ra.report_id JOIN floors f ON f.id=h.floor_id
      JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id
      JOIN staff_memberships m ON m.community_id=b.community_id
      JOIN staff_accounts sa ON sa.user_id=m.user_id
      WHERE ra.attachment_id=? AND m.user_id=? AND sa.active=1`, a.id, u.id))
      fail(404, "NOT_FOUND", "图片不存在或无权访问");
    p.header("Cache-Control", "private, no-store")
      .type(a.mime)
      .send(fs.readFileSync(path.join(cfg.uploadDir, a.storage_name)));
  });
  route("POST", "/reports", (r) => {
    const u = auth(r),
      p = reportSchema.parse(r.body),
      signature = hash(JSON.stringify(p));
    return db.tx(() => {
      const existing = db.one(
        "SELECT * FROM hazard_reports WHERE user_id=? AND idempotency_key=?",
        u.id,
        p.idempotencyKey,
      );
      if (existing) {
        if (existing.request_hash !== signature)
          fail(
            409,
            "IDEMPOTENCY_CONFLICT",
            "此提交标识已用于不同内容，请刷新记录",
          );
        return reportView(existing);
      }
      if (
        u.identity.startsWith("demoapp:") &&
        db.one(
          "SELECT COUNT(*) n FROM hazard_reports WHERE user_id=? AND created_at>?",
          u.id,
          new Date(Date.now() - 86400000).toISOString(),
        ).n >= 30
      )
        fail(429, "REPORT_RATE", "体验会话每天最多提交30条隐患记录");
      scope(u.id, p.floorId);
      if (
        p.deviceId &&
        !db.one(
          "SELECT id FROM devices WHERE id=? AND floor_id=?",
          p.deviceId,
          p.floorId,
        )
      )
        fail(400, "DEVICE_LOCATION", "设备与位置不匹配");
      if (new Set(p.attachmentIds).size !== p.attachmentIds.length)
        fail(400, "DUPLICATE_ATTACHMENT", "图片不能重复");
      for (const aid of p.attachmentIds)
        if (
          !db.one(
            "SELECT id FROM attachments WHERE id=? AND user_id=? AND id NOT IN (SELECT attachment_id FROM report_attachments)",
            aid,
            u.id,
          )
        )
          fail(403, "ATTACHMENT_ACCESS", "图片无权使用或已经关联其他记录");
      const rid = id(),
        date = now(),
        number =
          "AJ" +
          date.slice(0, 10).replaceAll("-", "") +
          "-" +
          rid.slice(0, 8).toUpperCase();
      db.run(
        "INSERT INTO hazard_reports VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        rid,
        number,
        u.id,
        p.floorId,
        p.deviceId || null,
        p.type,
        p.location,
        p.description,
        p.contact,
        "pending",
        date,
        p.idempotencyKey,
        signature,
      );
      p.attachmentIds.forEach((a) =>
        db.run("INSERT INTO report_attachments VALUES (?,?)", rid, a),
      );
      db.run(
        "INSERT INTO report_events VALUES (?,?,?,?,?)",
        id(),
        rid,
        "pending",
        "已收到上报，等待物业处理",
        date,
      );
      return reportView(ownReport(u.id, rid));
    });
  });
  route("GET", "/reports/community", (r) => {
    const q = paging.parse(r.query);
    let w = "1=1",
      args: any[] = [];
    if (q.communityId) {
      w += " AND b.community_id=?";
      args.push(q.communityId);
    }
    if (q.status) {
      w += " AND h.status=?";
      args.push(q.status);
    }
    const join =
      "FROM hazard_reports h JOIN floors f ON h.floor_id=f.id JOIN units u ON f.unit_id=u.id JOIN buildings b ON u.building_id=b.id";
    // Intentionally excludes description, room, contact, attachments, and reporter identity.
    return {
      items: db.all(
        `SELECT h.id,h.number,h.type,h.status,h.created_at createdAt,b.name buildingName ${join} WHERE ${w} ORDER BY h.created_at DESC,h.id DESC LIMIT ? OFFSET ?`,
        ...args,
        q.pageSize,
        (q.page - 1) * q.pageSize,
      ),
      total: db.one(`SELECT COUNT(*) n ${join} WHERE ${w}`, ...args).n,
      page: q.page,
      pageSize: q.pageSize,
    };
  });
  route("GET", "/reports/mine", (r) => {
    const u = auth(r),
      q = paging.parse(r.query);
    const w = q.status ? "user_id=? AND status=?" : "user_id=?",
      args = q.status ? [u.id, q.status] : [u.id];
    return {
      items: db
        .all(
          `SELECT * FROM hazard_reports WHERE ${w} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,
          ...args,
          q.pageSize,
          (q.page - 1) * q.pageSize,
        )
        .map(reportView),
      total: db.one(`SELECT COUNT(*) n FROM hazard_reports WHERE ${w}`, ...args)
        .n,
      page: q.page,
      pageSize: q.pageSize,
    };
  });
  route("GET", "/reports/stats", (r) => {
    return reportStatsPayload(auth(r).id);
  });
  route("GET", "/reports/submission/:key", (r) => {
    const u = auth(r),
      record = db.one(
        "SELECT * FROM hazard_reports WHERE user_id=? AND idempotency_key=?",
        u.id,
        r.params.key,
      );
    if (!record) fail(404, "NOT_FOUND", "该提交尚未创建记录");
    return reportView(record);
  });
  // Public detail is a separate projection: never share private report/attachment handlers.
  route("GET", "/reports/public/:id", (r) => {
    const report = db.one(`SELECT h.id,h.number,h.type,h.status,h.created_at createdAt,b.name buildingName
      FROM hazard_reports h JOIN floors f ON f.id=h.floor_id JOIN units un ON un.id=f.unit_id
      JOIN buildings b ON b.id=un.building_id WHERE h.id=?`, r.params.id);
    if (!report) fail(404, "NOT_FOUND", "记录不存在");
    return { ...report, public: true, events: [], attachmentIds: [] };
  });
  route("GET", "/reports/:id", (r) =>
    reportView(ownReport(auth(r).id, r.params.id)),
  );
  route("GET", "/devices", (r) => {
    const u = auth(r),
      q = paging.parse(r.query);
    if (!q.floorId) fail(400, "FLOOR_REQUIRED", "请选择楼层");
    scope(u.id, q.floorId!);
    const args = [q.floorId, q.pageSize, (q.page - 1) * q.pageSize];
    return {
      items: db
        .all(
          "SELECT * FROM devices WHERE floor_id=? ORDER BY id LIMIT ? OFFSET ?",
          ...args,
        )
        .map(deviceView),
      total: db.one(
        "SELECT COUNT(*) n FROM devices WHERE floor_id=?",
        q.floorId,
      ).n,
      page: q.page,
      pageSize: q.pageSize,
    };
  });
  route("GET", "/devices/:id", (r) => {
    const u = auth(r),
      d = db.one("SELECT * FROM devices WHERE id=?", r.params.id);
    if (!d) fail(404, "NOT_FOUND", "设备不存在");
    scope(u.id, d.floor_id);
    return deviceView(d);
  });
  route("POST", "/drills", (r) => {
    const u = auth(r),
      p = z
        .object({ floorId: text(), idempotencyKey: key })
        .strict()
        .parse(r.body),
      signature = hash(JSON.stringify(p));
    return db.tx(() => {
      const existing = db.one(
        "SELECT * FROM drill_sessions WHERE user_id=? AND idempotency_key=?",
        u.id,
        p.idempotencyKey,
      );
      if (existing) {
        if (existing.request_hash !== signature)
          fail(409, "IDEMPOTENCY_CONFLICT", "重复标识对应其他场景");
        return drillView(existing);
      }
      if (
        u.identity.startsWith("demoapp:") &&
        db.one(
          "SELECT COUNT(*) n FROM drill_sessions WHERE user_id=? AND started_at>?",
          u.id,
          new Date(Date.now() - 86400000).toISOString(),
        ).n >= 30
      )
        fail(429, "DRILL_RATE", "体验会话每天最多创建30次演练");
      const f = scope(u.id, p.floorId),
        did = id();
      const snapshot = {
        communityId: f.community_id,
        communityName: f.community_name,
        buildingId: f.building_id,
        buildingName: f.building_name,
        unitName: f.unit_name,
        floorId: f.id,
        floorNumber: f.number,
        exitText: f.exit_text,
        meetingPoint: f.meeting_point,
        source: cfg.mode === "demo" ? "demo" : "configured",
        title: "楼栋线上疏散认知演练",
        steps: [
          { id: "exit", title: "认识本层安全出口" },
          { id: "assembly", title: "认识社区集合点" },
        ],
        notice:
          "线上查看与确认，不代表已实际到达；示意路线不能作为真实火场实时路线。",
      };
      db.run(
        "INSERT INTO drill_sessions VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        did,
        u.id,
        p.floorId,
        "in_progress",
        now(),
        null,
        0,
        JSON.stringify(snapshot),
        "online-v1.1",
        p.idempotencyKey,
        signature,
      );
      return drillView(ownDrill(u.id, did));
    });
  });
  route("PUT", "/drills/:id/progress", (r) =>
    saveProgress(auth(r).id, r.params.id, r.body, "progress"),
  );
  route("POST", "/drills/:id/complete", (r) =>
    saveProgress(auth(r).id, r.params.id, r.body, "complete"),
  );
  route("POST", "/drills/:id/abort", (r) =>
    saveProgress(auth(r).id, r.params.id, r.body, "abort"),
  );
  route("GET", "/drills/stats", (r) => {
    return drillStatsPayload(auth(r).id);
  });
  route("GET", "/drills", (r) => {
    const u = auth(r),
      q = paging.parse(r.query);
    const w = q.status ? "user_id=? AND status=?" : "user_id=?",
      args = q.status ? [u.id, q.status] : [u.id];
    return {
      items: db
        .all(
          `SELECT * FROM drill_sessions WHERE ${w} ORDER BY started_at DESC,id DESC LIMIT ? OFFSET ?`,
          ...args,
          q.pageSize,
          (q.page - 1) * q.pageSize,
        )
        .map(drillView),
      total: db.one(`SELECT COUNT(*) n FROM drill_sessions WHERE ${w}`, ...args)
        .n,
      page: q.page,
      pageSize: q.pageSize,
    };
  });
  route("GET", "/drills/:id", (r) =>
    drillView(ownDrill(auth(r).id, r.params.id)),
  );
  route("POST", "/device-events", (r) => {
    const secret = String(r.headers["x-device-key"] || "");
    if (
      !cfg.ingestKey ||
      !timingSafeEqual(
        Buffer.from(hash(secret)),
        Buffer.from(hash(cfg.ingestKey)),
      )
    )
      fail(401, "DEVICE_AUTH", "设备接入凭据无效");
    const p = z
      .object({
        eventId: text(),
        deviceId: text(),
        occurredAt: iso,
        eventType: z.enum(["alarm", "clear", "heartbeat", "reading"]),
        severity: z.enum(["info", "warning", "critical"]),
        payload: z
          .object({
            value: z.number().finite().optional(),
            unit: text(1, 20).optional(),
          })
          .catchall(z.unknown()),
        source: z.enum(["hardware", "demo"]),
        isTest: z.boolean(),
      })
      .strict()
      .parse(r.body);
    if (
      (cfg.mode === "production" && (p.source !== "hardware" || p.isTest)) ||
      (cfg.mode === "demo" && (p.source !== "demo" || !p.isTest))
    )
      fail(400, "SOURCE_MISMATCH", "事件来源与数据库模式不符");
    if (Date.parse(p.occurredAt) > Date.now() + 300000)
      fail(400, "EVENT_TIME", "事件采集时间超前");
    if (
      p.eventType === "reading" &&
      (p.payload.value === undefined || !p.payload.unit)
    )
      fail(400, "READING_REQUIRED", "读数需要 value 与 unit");
    if (!db.one("SELECT id FROM devices WHERE id=?", p.deviceId))
      fail(404, "NOT_FOUND", "设备未登记");
    return db.tx(() => {
      const old = db.one(
        "SELECT * FROM device_events WHERE event_id=?",
        p.eventId,
      );
      if (old) {
        if (
          old.device_id !== p.deviceId ||
          old.occurred_at !== p.occurredAt ||
          old.event_type !== p.eventType ||
          old.severity !== p.severity ||
          old.payload !== JSON.stringify(p.payload) ||
          old.source !== p.source ||
          old.is_test !== Number(p.isTest)
        )
          fail(409, "EVENT_CONFLICT", "事件 ID 与已保存内容不一致");
        return { eventId: p.eventId, duplicate: true };
      }
      const receivedAt = now();
      db.run(
        "INSERT INTO device_events VALUES (?,?,?,?,?,?,?,?,?)",
        p.eventId,
        p.deviceId,
        p.occurredAt,
        receivedAt,
        p.eventType,
        p.severity,
        JSON.stringify(p.payload),
        p.source,
        Number(p.isTest),
      );
      db.run(
        "UPDATE devices SET last_seen_at=CASE WHEN last_seen_at IS NULL OR last_seen_at<? THEN ? ELSE last_seen_at END WHERE id=?",
        p.occurredAt,
        p.occurredAt,
        p.deviceId,
      );
      if (p.eventType === "reading")
        db.run(
          "INSERT INTO readings VALUES (?,?,?,?,?,?,?)",
          id(),
          p.deviceId,
          p.payload.value,
          p.payload.unit,
          p.occurredAt,
          p.source,
          Number(p.isTest),
        );
      return { eventId: p.eventId, receivedAt, duplicate: false };
    });
  });
  const cameras = registerCamera(app, { db, cfg });
  registerStaff(app, {
    db,
    cfg,
    auth,
    reportView,
    deviceView,
    drillView,
    cameraInspect: cameras.inspect,
  });
  app.get("/", async (_req, reply) => reply.redirect("/index.html"));
  if (fs.existsSync(cfg.webRoot)) await app.register(staticFiles, {
    root: cfg.webRoot,
    prefix: "/",
    index: "index.html",
    allowedPath: (name) => /\.(html|css|js|png|jpg|jpeg|svg|webp|ico|mp4)$/i.test(name),
  });
  app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: { code: "NOT_FOUND", message: "地址不存在", requestId: req.id } }));
  return app;
}
