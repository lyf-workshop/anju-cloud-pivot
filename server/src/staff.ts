import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Store } from "./db.js";
import type { Settings } from "./config.js";
import { fail, hash, id, now, text } from "./core.js";
import { agentChatSchema, runStaffAgent } from "./agent.js";

export const STAFF_SESSION_COOKIE = "anju_staff_session";
export const passwordHash = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
};
const passwordMatches = (password: string, stored: string) => {
  try {
    const [salt, expected] = stored.split(":");
    const actual = scryptSync(password, salt, 64);
    const target = Buffer.from(expected || "", "hex");
    return target.length === actual.length && timingSafeEqual(actual, target);
  } catch {
    return false;
  }
};
const staffPassword = z
  .string()
  .min(12, "密码至少需要 12 个字符")
  .max(200)
  .regex(/[a-z]/, "密码需要包含小写字母")
  .regex(/[A-Z]/, "密码需要包含大写字母")
  .regex(/[0-9]/, "密码需要包含数字")
  .regex(/[^A-Za-z0-9]/, "密码需要包含符号");
export function seedStaff(db: Store, cfg: Settings) {
  if (cfg.mode !== "demo" || cfg.production) return;
  if (
    db.one(
      "SELECT user_id FROM staff_accounts WHERE username=?",
      "property-demo",
    )
  )
    return;
  db.tx(() => {
    const uid = id();
    db.run(
      "INSERT INTO users VALUES (?,?,?,?,?)",
      uid,
      "staff:property-demo",
      "演示物业管理员",
      now(),
      cfg.legalVersion,
    );
    db.run(
      "INSERT INTO staff_accounts (user_id,username,password_hash,active,password_changed_at) VALUES (?,?,?,?,?)",
      uid,
      "property-demo",
      passwordHash(cfg.demoStaffPassword),
      1,
      now(),
    );
    db.run(
      "INSERT INTO staff_memberships VALUES (?,?,?)",
      uid,
      "community-demo",
      "manager",
    );
  });
}
type Dependencies = {
  db: Store;
  cfg: Settings;
  reportView: (row: any) => any;
  deviceView: (row: any) => any;
  drillView: (row: any) => any;
  cameraInspect: (id: string) => unknown;
};
export function registerStaff(app: FastifyInstance, deps: Dependencies) {
  const { db, cfg, reportView, deviceView, drillView, cameraInspect } =
    deps;
  seedStaff(db, cfg);
  const clientLabel = (r: FastifyRequest) => {
    const declared = String(r.headers["x-anju-client"] || "").trim();
    if (declared) return declared.slice(0, 100);
    const agent = String(r.headers["user-agent"] || "");
    if (/Electron/i.test(agent)) return "Windows 物业工作台";
    if (/Android/i.test(agent)) return "Android 浏览器";
    if (/Mobile/i.test(agent)) return "移动浏览器";
    return agent ? "桌面浏览器" : "未知客户端";
  };
  const ipHash = (r: FastifyRequest) => hash(r.ip || "unknown").slice(0, 24);
  const authEvent = (
    r: FastifyRequest,
    username: string,
    action: string,
    userId: string | null = null,
  ) =>
    db.run(
      "INSERT INTO staff_auth_events VALUES (?,?,?,?,?,?,?)",
      id(),
      userId,
      username,
      action,
      now(),
      clientLabel(r),
      ipHash(r),
    );
  const staff = (r: FastifyRequest) => {
    const token = r.cookies[STAFF_SESSION_COOKIE] || "";
    if (!token) fail(401, "SESSION_EXPIRED", "请先登录物业工作台");
    const u = db.one(
      `SELECT u.*,a.username,a.last_login_at,a.password_changed_at,
              s.id staff_session_id,s.expires_at staff_session_expires_at
       FROM staff_sessions s
       JOIN staff_accounts a ON a.user_id=s.user_id AND a.active=1
       JOIN users u ON u.id=s.user_id
       WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?`,
      hash(token),
      now(),
    );
    if (!u) fail(401, "SESSION_EXPIRED", "登录已过期，请重新登录");
    db.run(
      "UPDATE staff_sessions SET last_seen_at=? WHERE id=?",
      now(),
      u.staff_session_id,
    );
    return u;
  };
  const membership = (
    u: any,
    communityId: string,
    write = false,
    manager = false,
  ) => {
    const m = db.one(
      "SELECT role FROM staff_memberships WHERE user_id=? AND community_id=?",
      u.id,
      communityId,
    );
    if (
      !m ||
      (write && m.role === "viewer") ||
      (manager && m.role !== "manager")
    )
      fail(403, "COMMUNITY_SCOPE", "无权操作该社区或当前角色只读");
    return m;
  };
  const memberships = (uid: string) =>
    db.all(
      "SELECT m.community_id communityId,c.name communityName,m.role FROM staff_memberships m JOIN communities c ON c.id=m.community_id WHERE m.user_id=? ORDER BY c.id",
      uid,
    );
  const staffView = (u: any) => ({
    id: u.id,
    nickname: u.nickname,
    username: u.username,
    communities: memberships(u.id),
    security: {
      sessionId: u.staff_session_id || null,
      sessionExpiresAt: u.staff_session_expires_at || null,
      lastLoginAt: u.last_login_at || null,
      passwordChangedAt: u.password_changed_at || null,
    },
  });
  const route = (method: any, url: string, fn: (r: any, reply: any) => any) =>
    app.route({
      method,
      url: "/api/staff" + url,
      handler: async (r, reply) => ({ data: await fn(r, reply) }),
    });
  const pagination = z.object({
    communityId: text(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    status: text().optional(),
  });
  const pageQuery = (r: any) => {
    const q = pagination.parse(r.query);
    membership(staff(r), q.communityId);
    return q;
  };
  const list = (select: string, from: string, args: any[], q: any) => ({
    items: db.all(
      `${select} ${from} LIMIT ? OFFSET ?`,
      ...args,
      q.pageSize,
      (q.page - 1) * q.pageSize,
    ),
    total: db.one(
      `SELECT COUNT(*) n ${from.replace(/ ORDER BY[\s\S]+$/, "")}`,
      ...args,
    ).n,
    page: q.page,
    pageSize: q.pageSize,
  });
  const audit = (
    uid: string,
    cid: string,
    kind: string,
    rid: string,
    action: string,
  ) =>
    db.run(
      "INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?)",
      id(),
      uid,
      cid,
      kind,
      rid,
      action,
      now(),
    );
  const operation = (
    uid: string,
    key: string,
    payload: any,
    execute: () => string,
  ) =>
    db.tx(() => {
      const fingerprint = hash(JSON.stringify(payload));
      const old = db.one(
        "SELECT * FROM staff_operations WHERE user_id=? AND operation_key=?",
        uid,
        key,
      );
      if (old) {
        if (old.request_hash !== fingerprint)
          fail(409, "IDEMPOTENCY_CONFLICT", "重复操作标识对应不同内容");
        return old.resource_id as string;
      }
      const rid = execute();
      db.run(
        "INSERT INTO staff_operations VALUES (?,?,?,?)",
        uid,
        key,
        fingerprint,
        rid,
      );
      return rid;
    });
  const reportRow = (u: any, rid: string, write = false) => {
    const row = db.one(
      `SELECT h.*,b.community_id FROM hazard_reports h JOIN floors f ON f.id=h.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE h.id=?`,
      rid,
    );
    if (!row) fail(404, "NOT_FOUND", "上报不存在");
    membership(u, row.community_id, write);
    return row;
  };
  const workView = (row: any) => ({
    ...reportView(row),
    communityId: row.community_id,
    version:
      db.one("SELECT version FROM report_workflow WHERE report_id=?", row.id)
        ?.version || 0,
    assigneeId:
      db.one(
        "SELECT assignee_id FROM report_workflow WHERE report_id=?",
        row.id,
      )?.assignee_id || null,
  });
  const floorScope = (u: any, cid: string, fid: string) => {
    membership(u, cid, true);
    if (
      !db.one(
        "SELECT f.id FROM floors f JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE f.id=? AND b.community_id=?",
        fid,
        cid,
      )
    )
      fail(403, "COMMUNITY_SCOPE", "楼层不属于当前社区");
  };
  const opKey = text(8, 100);

  app.post(
    "/api/staff/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (r, reply) => {
      const p = z
        .object({
          username: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9_-]{3,60}$/),
          password: z.string().min(1).max(200),
          remember: z.boolean().default(false),
        })
        .strict()
        .parse(r.body);
      const account = db.one(
        "SELECT * FROM staff_accounts WHERE username=? AND active=1",
        p.username,
      );
      // A fixed dummy digest keeps the password derivation path for unknown accounts.
      const digest =
        account?.password_hash ||
        "0123456789abcdef0123456789abcdef:" + "00".repeat(64);
      const locked =
        account?.locked_until && Date.parse(account.locked_until) > Date.now();
      if (locked) {
        authEvent(r, p.username, "login_locked", account.user_id);
        fail(429, "LOGIN_LOCKED", "登录尝试过多，请稍后再试");
      }
      if (!passwordMatches(p.password, digest) || !account) {
        if (account) {
          const attempts = Number(account.failed_attempts || 0) + 1;
          const lockUntil =
            attempts >= cfg.staffLockAttempts
              ? new Date(
                  Date.now() + cfg.staffLockMinutes * 60_000,
                ).toISOString()
              : null;
          db.run(
            "UPDATE staff_accounts SET failed_attempts=?,locked_until=? WHERE user_id=?",
            lockUntil ? 0 : attempts,
            lockUntil,
            account.user_id,
          );
        }
        authEvent(r, p.username, "login_failed", account?.user_id || null);
        fail(401, "LOGIN_FAILED", "账号或密码不正确");
      }
      const token = randomBytes(32).toString("hex");
      const sessionId = id();
      const issuedAt = now();
      const hours = p.remember
        ? cfg.staffRememberSessionHours
        : cfg.staffSessionHours;
      const expiresAt = new Date(
        Date.now() + hours * 3600000,
      ).toISOString();
      if (r.cookies[STAFF_SESSION_COOKIE])
        db.run(
          "UPDATE staff_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL",
          issuedAt,
          hash(r.cookies[STAFF_SESSION_COOKIE]),
        );
      db.tx(() => {
        db.run(
          "DELETE FROM staff_sessions WHERE expires_at<=? OR revoked_at IS NOT NULL",
          issuedAt,
        );
        db.run(
          "INSERT INTO staff_sessions VALUES (?,?,?,?,?,?,?,?,?)",
          sessionId,
          hash(token),
          account.user_id,
          issuedAt,
          issuedAt,
          expiresAt,
          clientLabel(r),
          ipHash(r),
          null,
        );
        db.run(
          "UPDATE staff_accounts SET failed_attempts=0,locked_until=NULL,last_login_at=? WHERE user_id=?",
          issuedAt,
          account.user_id,
        );
        authEvent(r, p.username, "login_success", account.user_id);
      });
      reply.setCookie(STAFF_SESSION_COOKIE, token, {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: cfg.production || cfg.publicDemo,
        maxAge: hours * 3600,
      });
      reply.clearCookie("anju_session", { path: "/" });
      const user = db.one(
        `SELECT u.*,a.username,a.last_login_at,a.password_changed_at,
                ? staff_session_id,? staff_session_expires_at
         FROM users u JOIN staff_accounts a ON a.user_id=u.id WHERE u.id=?`,
        sessionId,
        expiresAt,
        account.user_id,
      );
      return {
        data: {
          user: staffView(user),
          expiresAt,
        },
      };
    },
  );
  route("GET", "/me", (r) => staffView(staff(r)));
  route("POST", "/auth/logout", (r, reply) => {
    const u = staff(r);
    db.run(
      "UPDATE staff_sessions SET revoked_at=? WHERE id=? AND revoked_at IS NULL",
      now(),
      u.staff_session_id,
    );
    authEvent(r, u.username, "logout", u.id);
    reply.clearCookie(STAFF_SESSION_COOKIE, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: cfg.production || cfg.publicDemo,
    });
    return { loggedOut: true };
  });
  route("GET", "/auth/sessions", (r) => {
    const u = staff(r);
    return db
      .all(
        `SELECT id,created_at createdAt,last_seen_at lastSeenAt,
                expires_at expiresAt,client_label client
         FROM staff_sessions
         WHERE user_id=? AND revoked_at IS NULL AND expires_at>?
         ORDER BY last_seen_at DESC`,
        u.id,
        now(),
      )
      .map((session) => ({
        ...session,
        current: session.id === u.staff_session_id,
      }));
  });
  route("POST", "/auth/sessions/revoke", (r, reply) => {
    const u = staff(r);
    const p = z.object({ sessionId: z.uuid() }).strict().parse(r.body);
    const result = db.run(
      "UPDATE staff_sessions SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL",
      now(),
      p.sessionId,
      u.id,
    );
    if (!result.changes) fail(404, "NOT_FOUND", "登录会话不存在或已经退出");
    authEvent(r, u.username, "session_revoked", u.id);
    if (p.sessionId === u.staff_session_id)
      reply.clearCookie(STAFF_SESSION_COOKIE, {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: cfg.production || cfg.publicDemo,
      });
    return { revoked: true, current: p.sessionId === u.staff_session_id };
  });
  route("POST", "/auth/logout-all", (r, reply) => {
    const u = staff(r);
    db.run(
      "UPDATE staff_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
      now(),
      u.id,
    );
    authEvent(r, u.username, "logout_all", u.id);
    reply.clearCookie(STAFF_SESSION_COOKIE, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: cfg.production || cfg.publicDemo,
    });
    return { loggedOut: true };
  });
  route("POST", "/auth/change-password", (r) => {
    const u = staff(r);
    const p = z
      .object({ currentPassword: z.string().max(200), newPassword: staffPassword })
      .strict()
      .parse(r.body);
    const account = db.one(
      "SELECT password_hash FROM staff_accounts WHERE user_id=?",
      u.id,
    );
    if (!account || !passwordMatches(p.currentPassword, account.password_hash))
      fail(401, "PASSWORD_INCORRECT", "当前密码不正确");
    if (passwordMatches(p.newPassword, account.password_hash))
      fail(409, "PASSWORD_REUSED", "新密码不能与当前密码相同");
    const changedAt = now();
    db.tx(() => {
      db.run(
        "UPDATE staff_accounts SET password_hash=?,password_changed_at=?,failed_attempts=0,locked_until=NULL WHERE user_id=?",
        passwordHash(p.newPassword),
        changedAt,
        u.id,
      );
      db.run(
        "UPDATE staff_sessions SET revoked_at=? WHERE user_id=? AND id<>? AND revoked_at IS NULL",
        changedAt,
        u.id,
        u.staff_session_id,
      );
      authEvent(r, u.username, "password_changed", u.id);
    });
    return { changedAt, otherSessionsRevoked: true };
  });
  route("GET", "/members", (r) => {
    const q = pageQuery(r);
    return db.all(
      "SELECT s.user_id id,u.nickname,m.role FROM staff_memberships m JOIN staff_accounts s ON s.user_id=m.user_id JOIN users u ON u.id=m.user_id WHERE m.community_id=? AND s.active=1",
      q.communityId,
    );
  });
  route("GET", "/overview", (r) => {
    const q = pageQuery(r);
    const count = (sql: string) => db.one(sql, q.communityId).n;
    return {
      community: db.one(
        "SELECT id,name,source FROM communities WHERE id=?",
        q.communityId,
      ),
      reports: count(
        "SELECT COUNT(*) n FROM hazard_reports h JOIN floors f ON f.id=h.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE b.community_id=?",
      ),
      pending: count(
        "SELECT COUNT(*) n FROM hazard_reports h JOIN floors f ON f.id=h.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE b.community_id=? AND h.status='pending'",
      ),
      residents: count(
        "SELECT COUNT(DISTINCT bi.user_id) n FROM bindings bi JOIN residences res ON res.id=bi.residence_id JOIN floors f ON f.id=res.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE b.community_id=?",
      ),
      completedDrills: count(
        "SELECT COUNT(*) n FROM drill_sessions d JOIN floors f ON f.id=d.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE b.community_id=? AND d.status='completed'",
      ),
      devices: count(
        "SELECT COUNT(*) n FROM devices d JOIN floors f ON f.id=d.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE b.community_id=?",
      ),
      mode: cfg.mode,
      hardwareConnected: false,
    };
  });
  route("GET", "/reports", (r) => {
    const q = pageQuery(r);
    if (q.status && !["pending", "processing", "completed"].includes(q.status))
      fail(400, "VALIDATION_ERROR", "未知处理状态");
    const args = q.status ? [q.communityId, q.status] : [q.communityId];
    const result = list(
      "SELECT h.*,b.community_id",
      `FROM hazard_reports h JOIN floors f ON f.id=h.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE b.community_id=? ${q.status ? "AND h.status=?" : ""} ORDER BY h.created_at DESC,h.id DESC`,
      args,
      q,
    );
    return { ...result, items: result.items.map(workView) };
  });
  route("GET", "/reports/:id", (r) =>
    workView(reportRow(staff(r), r.params.id)),
  );
  route("POST", "/reports/:id/actions", (r) => {
    const u = staff(r);
    const p = z
      .object({
        idempotencyKey: opKey,
        expectedVersion: z.number().int().min(0),
        status: z.enum(["processing", "completed"]),
        message: text(2, 1000),
        assigneeId: z.uuid().optional(),
      })
      .strict()
      .parse(r.body);
    const row = reportRow(u, r.params.id, true);
    const rid = operation(
      u.id,
      p.idempotencyKey,
      { route: "report-action", id: row.id, ...p },
      () => {
        const current = workView(reportRow(u, row.id, true));
        if (current.version !== p.expectedVersion)
          fail(409, "VERSION_CONFLICT", "其他工作人员已更新记录，请刷新后重试");
        if (
          row.status === "completed" ||
          (row.status === "pending" && p.status !== "processing")
        )
          fail(409, "REPORT_STATE", "请先受理工单；已完成工单不能再次处理");
        const assignee = p.assigneeId || current.assigneeId || u.id;
        if (
          !db.one(
            "SELECT a.user_id FROM staff_accounts a JOIN staff_memberships m ON m.user_id=a.user_id WHERE a.user_id=? AND a.active=1 AND m.community_id=? AND m.role IN ('manager','operator')",
            assignee,
            row.community_id,
          )
        )
          fail(403, "ASSIGNEE_SCOPE", "处理人不属于当前社区或没有处理权限");
        db.run(
          "UPDATE hazard_reports SET status=? WHERE id=?",
          p.status,
          row.id,
        );
        db.run(
          "INSERT INTO report_workflow VALUES (?,?,?) ON CONFLICT(report_id) DO UPDATE SET version=excluded.version,assignee_id=excluded.assignee_id",
          row.id,
          current.version + 1,
          assignee,
        );
        db.run(
          "INSERT INTO report_events VALUES (?,?,?,?,?)",
          id(),
          row.id,
          p.status,
          `${u.nickname}：${p.message}`,
          now(),
        );
        audit(u.id, row.community_id, "report", row.id, p.status);
        return row.id;
      },
    );
    return workView(reportRow(u, rid));
  });
  route("GET", "/residents", (r) => {
    const q = pageQuery(r);
    return list(
      "SELECT bi.id,bi.verification,usr.nickname,usr.id userId,res.room,f.number floorNumber,un.name unitName,b.name buildingName",
      "FROM bindings bi JOIN users usr ON usr.id=bi.user_id JOIN residences res ON res.id=bi.residence_id JOIN floors f ON f.id=res.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE b.community_id=? ORDER BY b.name,f.number,res.room,bi.id",
      [q.communityId],
      q,
    );
  });
  route("PATCH", "/bindings/:id", (r) => {
    const u = staff(r);
    const p = z
      .object({
        verification: z.enum(["verified", "rejected"]),
        reason: text(2, 500),
      })
      .strict()
      .parse(r.body);
    const bi = db.one(
      "SELECT bi.*,b.community_id FROM bindings bi JOIN residences res ON res.id=bi.residence_id JOIN floors f ON f.id=res.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE bi.id=?",
      r.params.id,
    );
    if (!bi) fail(404, "NOT_FOUND", "绑定不存在");
    membership(u, bi.community_id, true, true);
    db.tx(() => {
      db.run(
        "UPDATE bindings SET verification=? WHERE id=?",
        p.verification,
        bi.id,
      );
      audit(
        u.id,
        bi.community_id,
        "binding",
        bi.id,
        `${p.verification}: ${p.reason}`,
      );
    });
    return { id: bi.id, verification: p.verification };
  });
  route("GET", "/devices", (r) => {
    const q = pageQuery(r);
    const result = list(
      "SELECT d.*",
      "FROM devices d JOIN floors f ON f.id=d.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE b.community_id=? ORDER BY d.id",
      [q.communityId],
      q,
    );
    return { ...result, items: result.items.map(deviceView) };
  });
  route("GET", "/drills", (r) => {
    const q = pageQuery(r);
    const result = list(
      "SELECT d.*,usr.nickname",
      "FROM drill_sessions d JOIN users usr ON usr.id=d.user_id JOIN floors f ON f.id=d.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE b.community_id=? ORDER BY d.started_at DESC,d.id DESC",
      [q.communityId],
      q,
    );
    return {
      ...result,
      items: result.items.map((d) => ({
        ...drillView(d),
        nickname: d.nickname,
      })),
    };
  });
  route("GET", "/events", (r) => {
    const q = pageQuery(r);
    return list(
      "SELECT e.event_id eventId,e.device_id deviceId,d.name deviceName,e.occurred_at occurredAt,e.received_at receivedAt,e.event_type eventType,e.severity,e.source,e.is_test isTest,COALESCE(rv.status,'unreviewed') reviewStatus,COALESCE(rv.version,0) version,rv.note",
      "FROM device_events e JOIN devices d ON d.id=e.device_id JOIN floors f ON f.id=d.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id LEFT JOIN event_reviews rv ON rv.event_id=e.event_id WHERE b.community_id=? ORDER BY e.occurred_at DESC,e.event_id DESC",
      [q.communityId],
      q,
    );
  });
  route("POST", "/events/:id/review", (r) => {
    const u = staff(r);
    const p = z
      .object({
        idempotencyKey: opKey,
        expectedVersion: z.number().int().min(0),
        status: z.enum(["acknowledged", "closed", "false_positive"]),
        note: text(2, 1000),
      })
      .strict()
      .parse(r.body);
    const event = db.one(
      "SELECT e.*,b.community_id FROM device_events e JOIN devices d ON d.id=e.device_id JOIN floors f ON f.id=d.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE e.event_id=?",
      r.params.id,
    );
    if (!event) fail(404, "NOT_FOUND", "事件不存在");
    membership(u, event.community_id, true);
    operation(
      u.id,
      p.idempotencyKey,
      { route: "event-review", id: event.event_id, ...p },
      () => {
        const old = db.one(
          "SELECT * FROM event_reviews WHERE event_id=?",
          event.event_id,
        );
        if ((old?.version || 0) !== p.expectedVersion)
          fail(409, "VERSION_CONFLICT", "事件处置已更新，请刷新");
        if (["closed", "false_positive"].includes(old?.status))
          fail(409, "EVENT_STATE", "事件审核已经结束");
        db.run(
          "INSERT INTO event_reviews VALUES (?,?,?,?,?,?) ON CONFLICT(event_id) DO UPDATE SET status=excluded.status,note=excluded.note,actor_id=excluded.actor_id,updated_at=excluded.updated_at,version=excluded.version",
          event.event_id,
          p.status,
          p.note,
          u.id,
          now(),
          p.expectedVersion + 1,
        );
        audit(u.id, event.community_id, "event", event.event_id, p.status);
        return event.event_id;
      },
    );
    return db.one(
      "SELECT event_id eventId,status,note,version FROM event_reviews WHERE event_id=?",
      event.event_id,
    );
  });
  route("GET", "/inspections", (r) => {
    const q = pageQuery(r);
    return list(
      "SELECT i.id,i.floor_id floorId,i.location,i.result,i.description,i.created_at createdAt,u.nickname",
      "FROM inspections i JOIN users u ON u.id=i.created_by WHERE i.community_id=? ORDER BY i.created_at DESC,i.id DESC",
      [q.communityId],
      q,
    );
  });
  route("POST", "/inspections", (r) => {
    const u = staff(r);
    const p = z
      .object({
        idempotencyKey: opKey,
        communityId: text(),
        floorId: text(),
        location: text(2, 160),
        result: z.enum(["clear", "issue"]),
        description: text(2, 1000),
      })
      .strict()
      .parse(r.body);
    floorScope(u, p.communityId, p.floorId);
    const rid = operation(
      u.id,
      p.idempotencyKey,
      { route: "inspection", ...p },
      () => {
        const rid = id();
        db.run(
          "INSERT INTO inspections VALUES (?,?,?,?,?,?,?,?)",
          rid,
          p.communityId,
          p.floorId,
          p.location,
          p.result,
          p.description,
          u.id,
          now(),
        );
        audit(u.id, p.communityId, "inspection", rid, "created");
        return rid;
      },
    );
    return { id: rid, saved: true };
  });
  route("GET", "/duties", (r) => {
    const q = pageQuery(r);
    return list(
      "SELECT s.id,s.title,s.starts_at startsAt,s.ends_at endsAt,s.note,s.assignee_id assigneeId,u.nickname",
      "FROM duty_shifts s JOIN users u ON u.id=s.assignee_id WHERE s.community_id=? ORDER BY s.starts_at DESC,s.id DESC",
      [q.communityId],
      q,
    );
  });
  route("POST", "/duties", (r) => {
    const u = staff(r);
    const p = z
      .object({
        idempotencyKey: opKey,
        communityId: text(),
        title: text(2, 100),
        assigneeId: z.uuid(),
        startsAt: z.iso.datetime(),
        endsAt: z.iso.datetime(),
        note: text(0, 500).default(""),
      })
      .strict()
      .parse(r.body);
    membership(u, p.communityId, true, true);
    if (Date.parse(p.endsAt) <= Date.parse(p.startsAt))
      fail(400, "SHIFT_TIME", "结束时间须晚于开始时间");
    if (
      !db.one(
        "SELECT m.user_id FROM staff_memberships m JOIN staff_accounts a ON a.user_id=m.user_id WHERE m.user_id=? AND m.community_id=? AND a.active=1",
        p.assigneeId,
        p.communityId,
      )
    )
      fail(403, "ASSIGNEE_SCOPE", "值班员不属于当前社区");
    const rid = operation(
      u.id,
      p.idempotencyKey,
      { route: "duty", ...p },
      () => {
        const rid = id();
        db.run(
          "INSERT INTO duty_shifts VALUES (?,?,?,?,?,?,?,?,?)",
          rid,
          p.communityId,
          p.title,
          p.assigneeId,
          p.startsAt,
          p.endsAt,
          p.note,
          u.id,
          now(),
        );
        audit(u.id, p.communityId, "duty", rid, "created");
        return rid;
      },
    );
    return { id: rid, saved: true };
  });
  route("POST", "/announcements", (r) => {
    const u = staff(r);
    const p = z
      .object({
        idempotencyKey: opKey,
        communityId: text(),
        title: text(2, 100),
        body: text(2, 4000),
      })
      .strict()
      .parse(r.body);
    membership(u, p.communityId, true, true);
    const rid = operation(
      u.id,
      p.idempotencyKey,
      { route: "announcement", ...p },
      () => {
        const rid = id();
        db.run(
          "INSERT INTO announcements VALUES (?,?,?,?,?,?)",
          rid,
          p.communityId,
          p.title,
          p.body,
          now(),
          cfg.mode === "demo" ? "demo" : "property",
        );
        audit(u.id, p.communityId, "announcement", rid, "created");
        return rid;
      },
    );
    return { id: rid, saved: true };
  });
  route("GET", "/agent/status", (r) => {
    staff(r);
    return {
      configured: Boolean(cfg.llmApiKey),
      model: cfg.llmModel,
      provider: "zhizengzeng",
    };
  });
  app.post(
    "/api/staff/agent/chat",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (r) => {
      const u = staff(r);
      const p = agentChatSchema.parse(r.body);
      const cid = p.communityId || memberships(u.id)[0]?.communityId || "";
      if (!cid) fail(403, "COMMUNITY_SCOPE", "未分配社区");
      membership(u, cid);
      const openStatuses = (status?: string) =>
        status ? [status] : ["pending", "processing"];
      return {
        data: await runStaffAgent(
          {
            cfg,
            communityId: cid,
            inspectCamera: (cameraId) => {
              if (cid !== cfg.cameraCommunityId)
                fail(403, "COMMUNITY_SCOPE", "无权查看该社区摄像头");
              return cameraInspect(cameraId);
            },
            listReports: (status) => {
              const statuses = openStatuses(status);
              return db
                .all(
                  `SELECT h.*,b.community_id FROM hazard_reports h JOIN floors f ON f.id=h.floor_id JOIN units un ON un.id=f.unit_id JOIN buildings b ON b.id=un.building_id WHERE b.community_id=? AND h.status IN (${statuses.map(() => "?").join(",")}) ORDER BY h.created_at DESC,h.id DESC LIMIT 20`,
                  cid,
                  ...statuses,
                )
                .map(workView);
            },
            getReport: (rid) => workView(reportRow(u, rid)),
          },
          p,
        ),
      };
    },
  );
}
