import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Store } from "./db.js";
import type { Settings } from "./config.js";
import { fail, hash, id, now, text } from "./core.js";

export const passwordHash = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
};
const passwordMatches = (password: string, stored: string) => {
  const [salt, expected] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  const target = Buffer.from(expected || "", "hex");
  return target.length === actual.length && timingSafeEqual(actual, target);
};
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
      "INSERT INTO staff_accounts VALUES (?,?,?,?)",
      uid,
      "property-demo",
      passwordHash(cfg.demoStaffPassword),
      1,
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
  auth: (req: FastifyRequest) => any;
  reportView: (row: any) => any;
  deviceView: (row: any) => any;
  drillView: (row: any) => any;
};
export function registerStaff(app: FastifyInstance, deps: Dependencies) {
  const { db, cfg, auth, reportView, deviceView, drillView } = deps;
  seedStaff(db, cfg);
  const staff = (r: FastifyRequest) => {
    const u = auth(r);
    if (
      !db.one(
        "SELECT user_id FROM staff_accounts WHERE user_id=? AND active=1",
        u.id,
      )
    )
      fail(403, "STAFF_REQUIRED", "此功能需要物业账号");
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
    communities: memberships(u.id),
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
        .object({ username: text(1, 60), password: z.string().min(1).max(200) })
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
      if (!passwordMatches(p.password, digest) || !account)
        fail(401, "LOGIN_FAILED", "账号或密码不正确");
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(
        Date.now() + cfg.sessionHours * 3600000,
      ).toISOString();
      if (r.cookies.anju_session)
        db.run(
          "DELETE FROM sessions WHERE token_hash=?",
          hash(r.cookies.anju_session),
        );
      db.run(
        "INSERT INTO sessions VALUES (?,?,?)",
        hash(token),
        account.user_id,
        expiresAt,
      );
      reply.setCookie("anju_session", token, {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: cfg.production || cfg.publicDemo,
        maxAge: cfg.sessionHours * 3600,
      });
      return {
        data: {
          user: staffView(
            db.one("SELECT * FROM users WHERE id=?", account.user_id),
          ),
          expiresAt,
        },
      };
    },
  );
  route("GET", "/me", (r) => staffView(staff(r)));
  route("POST", "/auth/logout", (r, reply) => {
    staff(r);
    db.run(
      "DELETE FROM sessions WHERE token_hash=?",
      hash(r.cookies.anju_session || ""),
    );
    reply.clearCookie("anju_session", {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: cfg.production || cfg.publicDemo,
    });
    return { loggedOut: true };
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
}
