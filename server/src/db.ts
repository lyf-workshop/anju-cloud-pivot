import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { Settings } from "./config.js";
import { migrateProperty } from "./migrations.js";

export class Store {
  db: DatabaseSync;
  constructor(public cfg: Settings) {
    fs.mkdirSync(path.dirname(cfg.dbPath), { recursive: true });
    fs.mkdirSync(cfg.uploadDir, { recursive: true });
    this.db = new DatabaseSync(cfg.dbPath);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    const hasMetadata = this.one("SELECT name FROM sqlite_master WHERE type='table' AND name='metadata'");
    const mode = hasMetadata ? this.one("SELECT value FROM metadata WHERE key=?", "mode") : null;
    if (mode && mode.value !== cfg.mode) {
      this.close();
      throw new Error(
        "Database mode mismatch; demo and production must be isolated",
      );
    }
    this.migrate();
    this.run("INSERT OR IGNORE INTO metadata VALUES (?,?)", "mode", cfg.mode);
    if (cfg.mode === "demo") this.seed(demoCatalog);
    else if (cfg.catalogFile)
      this.seed(JSON.parse(fs.readFileSync(cfg.catalogFile, "utf8")));
  }
  run(sql: string, ...args: any[]) {
    return this.db.prepare(sql).run(...args);
  }
  one(sql: string, ...args: any[]): any {
    return this.db.prepare(sql).get(...args);
  }
  all(sql: string, ...args: any[]): any[] {
    return this.db.prepare(sql).all(...args);
  }
  tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL, nickname TEXT NOT NULL, created_at TEXT NOT NULL, legal_version TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS communities (id TEXT PRIMARY KEY, name TEXT NOT NULL, meeting_point TEXT NOT NULL, source TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS buildings (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, building_id TEXT NOT NULL REFERENCES buildings(id), name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS floors (id TEXT PRIMARY KEY, unit_id TEXT NOT NULL REFERENCES units(id), number INTEGER NOT NULL, exit_text TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS residences (id TEXT PRIMARY KEY, floor_id TEXT NOT NULL REFERENCES floors(id), room TEXT NOT NULL, UNIQUE(floor_id, room));
      CREATE TABLE IF NOT EXISTS bindings (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), residence_id TEXT NOT NULL REFERENCES residences(id), verification TEXT NOT NULL DEFAULT 'pending', is_current INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, UNIQUE(user_id,residence_id));
      CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), title TEXT NOT NULL, body TEXT NOT NULL, published_at TEXT NOT NULL, source TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), storage_name TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, floor_id TEXT NOT NULL REFERENCES floors(id), name TEXT NOT NULL, type TEXT NOT NULL, location TEXT NOT NULL, last_seen_at TEXT, source TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS readings (id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id), value REAL NOT NULL, unit TEXT NOT NULL, collected_at TEXT NOT NULL, source TEXT NOT NULL, is_test INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS device_events (event_id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id), occurred_at TEXT NOT NULL, received_at TEXT NOT NULL, event_type TEXT NOT NULL, severity TEXT NOT NULL, payload TEXT NOT NULL, source TEXT NOT NULL, is_test INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS hazard_reports (id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), floor_id TEXT NOT NULL REFERENCES floors(id), device_id TEXT REFERENCES devices(id), type TEXT NOT NULL, location TEXT NOT NULL, description TEXT NOT NULL, contact TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','processing','completed')), created_at TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, UNIQUE(user_id,idempotency_key));
      CREATE TABLE IF NOT EXISTS report_attachments (report_id TEXT NOT NULL REFERENCES hazard_reports(id), attachment_id TEXT UNIQUE NOT NULL REFERENCES attachments(id), PRIMARY KEY(report_id,attachment_id));
      CREATE TABLE IF NOT EXISTS report_events (id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES hazard_reports(id), status TEXT NOT NULL, message TEXT NOT NULL, occurred_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS drill_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), floor_id TEXT NOT NULL REFERENCES floors(id), status TEXT NOT NULL CHECK(status IN ('in_progress','completed','aborted')), started_at TEXT NOT NULL, completed_at TEXT, duration_ms INTEGER NOT NULL DEFAULT 0, snapshot TEXT NOT NULL, step_version TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, UNIQUE(user_id,idempotency_key));
      CREATE TABLE IF NOT EXISTS drill_steps (session_id TEXT NOT NULL REFERENCES drill_sessions(id), step_id TEXT NOT NULL, confirmed_at TEXT NOT NULL, PRIMARY KEY(session_id,step_id));
      CREATE INDEX IF NOT EXISTS hazard_user_time ON hazard_reports(user_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS drill_user_time ON drill_sessions(user_id,started_at DESC);
      CREATE INDEX IF NOT EXISTS device_reading_time ON readings(device_id,collected_at DESC);
    `);
    migrateProperty(this.db);
  }
  seed(catalog: any) {
    if (
      this.cfg.mode === "production" &&
      (catalog.source !== "configured" || !Array.isArray(catalog.communities))
    )
      throw new Error("Production catalog requires source=configured");
    this.tx(() => {
      for (const c of catalog.communities || []) {
        this.run(
          "INSERT OR IGNORE INTO communities VALUES (?,?,?,?)",
          c.id,
          c.name,
          c.meetingPoint,
          this.cfg.mode === "demo" ? "demo" : "configured",
        );
        for (const b of c.buildings || []) {
          this.run(
            "INSERT OR IGNORE INTO buildings VALUES (?,?,?)",
            b.id,
            c.id,
            b.name,
          );
          for (const u of b.units || []) {
            this.run(
              "INSERT OR IGNORE INTO units VALUES (?,?,?)",
              u.id,
              b.id,
              u.name,
            );
            for (const f of u.floors || []) {
              this.run(
                "INSERT OR IGNORE INTO floors VALUES (?,?,?,?)",
                f.id,
                u.id,
                f.number,
                f.exitText,
              );
              for (const d of f.devices || [])
                this.run(
                  "INSERT OR IGNORE INTO devices VALUES (?,?,?,?,?,?,?)",
                  d.id,
                  f.id,
                  d.name,
                  d.type,
                  d.location,
                  null,
                  this.cfg.mode === "demo" ? "demo" : "hardware",
                );
            }
          }
        }
        for (const a of c.announcements || [])
          this.run(
            "INSERT OR IGNORE INTO announcements VALUES (?,?,?,?,?,?)",
            a.id,
            c.id,
            a.title,
            a.body,
            a.publishedAt,
            this.cfg.mode === "demo" ? "demo" : "property",
          );
      }
      if (this.cfg.mode === "demo") {
        this.run(
          "INSERT OR IGNORE INTO devices VALUES (?,?,?,?,?,?,?)",
          "device-smoke-1",
          "floor-1-1-6",
          "走廊烟雾传感器",
          "smoke",
          "6层公共走廊东侧",
          "2026-09-22T01:00:00.000Z",
          "demo",
        );
        this.run(
          "INSERT OR IGNORE INTO devices VALUES (?,?,?,?,?,?,?)",
          "device-temp-1",
          "floor-1-1-6",
          "楼梯间温度传感器",
          "temperature",
          "6层楼梯间",
          null,
          "demo",
        );
        this.run(
          "INSERT OR IGNORE INTO readings VALUES (?,?,?,?,?,?,?)",
          "reading-demo-1",
          "device-smoke-1",
          0,
          "%",
          "2026-09-22T01:00:00.000Z",
          "demo",
          1,
        );
        this.run(
          "INSERT OR IGNORE INTO device_events VALUES (?,?,?,?,?,?,?,?,?)",
          "event-demo-1",
          "device-smoke-1",
          "2026-09-22T00:55:00.000Z",
          "2026-09-22T00:55:02.000Z",
          "alarm",
          "warning",
          JSON.stringify({ note: "固定演示事件，未收到解除事件" }),
          "demo",
          1,
        );
      }
    });
  }
}

const demoCatalog = {
  communities: [
    {
      id: "community-demo",
      name: "云栖花园（演示社区）",
      meetingPoint: "社区中心广场（线上示意，未核实为真实应急集合点）",
      buildings: [1, 2].map((n) => ({
        id: `building-${n}`,
        name: `${n}号楼`,
        units: [
          {
            id: `unit-${n}-1`,
            name: "1单元",
            floors: Array.from({ length: 18 }, (_, i) => ({
              id: `floor-${n}-1-${i + 1}`,
              number: i + 1,
              exitText:
                "本层东西两侧楼梯间安全出口。仅用于线上认知练习，请以现场标识和工作人员指引为准。",
            })),
          },
        ],
      })),
      announcements: [
        {
          id: "notice-demo-1",
          title: "让安全成为每一天的习惯",
          body: "请保持楼道畅通，不在公共区域堆放杂物。本社区资料与设备读数为固定演示数据，非实时监测。",
          publishedAt: "2026-09-22T01:00:00.000Z",
        },
      ],
    },
  ],
};
