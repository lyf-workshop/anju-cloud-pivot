import type { DatabaseSync } from "node:sqlite";

// Version 1 is the existing resident schema. Never recreate or clear business rows.
export function migrateProperty(db: DatabaseSync) {
  let version = Number(
    (db.prepare("PRAGMA user_version").get() as any).user_version,
  );
  if (version < 2) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`
      CREATE TABLE staff_accounts (
        user_id TEXT PRIMARY KEY REFERENCES users(id), username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE staff_memberships (
        user_id TEXT NOT NULL REFERENCES staff_accounts(user_id), community_id TEXT NOT NULL REFERENCES communities(id),
        role TEXT NOT NULL CHECK(role IN ('manager','operator','viewer')), PRIMARY KEY(user_id,community_id)
      );
      CREATE TABLE report_workflow (
        report_id TEXT PRIMARY KEY REFERENCES hazard_reports(id), version INTEGER NOT NULL DEFAULT 0,
        assignee_id TEXT REFERENCES staff_accounts(user_id)
      );
      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), community_id TEXT NOT NULL REFERENCES communities(id),
        resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, action TEXT NOT NULL, occurred_at TEXT NOT NULL
      );
      CREATE TABLE staff_operations (
        user_id TEXT NOT NULL REFERENCES users(id), operation_key TEXT NOT NULL, request_hash TEXT NOT NULL,
        resource_id TEXT NOT NULL, PRIMARY KEY(user_id,operation_key)
      );
      CREATE TABLE duty_shifts (
        id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), title TEXT NOT NULL,
        assignee_id TEXT NOT NULL REFERENCES staff_accounts(user_id), starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
        note TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
      );
      CREATE TABLE inspections (
        id TEXT PRIMARY KEY, community_id TEXT NOT NULL REFERENCES communities(id), floor_id TEXT NOT NULL REFERENCES floors(id),
        location TEXT NOT NULL, result TEXT NOT NULL CHECK(result IN ('clear','issue')), description TEXT NOT NULL,
        created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
      );
      CREATE TABLE event_reviews (
        event_id TEXT PRIMARY KEY REFERENCES device_events(event_id), status TEXT NOT NULL CHECK(status IN ('acknowledged','closed','false_positive')),
        note TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL, version INTEGER NOT NULL
      );
      CREATE INDEX audit_community_time ON audit_logs(community_id,occurred_at DESC);
      CREATE INDEX inspection_community_time ON inspections(community_id,created_at DESC);
      PRAGMA user_version=2;
    `);
      db.exec("COMMIT");
      version = 2;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  if (version < 3) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`
        CREATE TABLE demo_installations (
          install_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
          platform TEXT NOT NULL CHECK(platform IN ('windows','android','web')),
          client_version TEXT NOT NULL,
          created_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL
        );
        PRAGMA user_version=3;
      `);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  if (version < 4) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`
        ALTER TABLE staff_accounts ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE staff_accounts ADD COLUMN locked_until TEXT;
        ALTER TABLE staff_accounts ADD COLUMN last_login_at TEXT;
        ALTER TABLE staff_accounts ADD COLUMN password_changed_at TEXT;
        CREATE TABLE staff_sessions (
          id TEXT PRIMARY KEY,
          token_hash TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL REFERENCES staff_accounts(user_id),
          created_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          client_label TEXT NOT NULL,
          ip_hash TEXT NOT NULL,
          revoked_at TEXT
        );
        CREATE TABLE staff_auth_events (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES staff_accounts(user_id),
          username TEXT NOT NULL,
          action TEXT NOT NULL CHECK(action IN ('login_success','login_failed','login_locked','logout','logout_all','password_changed','session_revoked')),
          occurred_at TEXT NOT NULL,
          client_label TEXT NOT NULL,
          ip_hash TEXT NOT NULL
        );
        CREATE INDEX staff_session_user_time ON staff_sessions(user_id,created_at DESC);
        CREATE INDEX staff_session_expiry ON staff_sessions(expires_at);
        CREATE INDEX staff_auth_user_time ON staff_auth_events(user_id,occurred_at DESC);
        PRAGMA user_version=4;
      `);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
