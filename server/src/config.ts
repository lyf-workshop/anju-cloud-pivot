import path from "node:path";
import fs from "node:fs";

export type Settings = ReturnType<typeof settings>;
export function settings(env: NodeJS.ProcessEnv = process.env) {
  const mode = env.DATA_MODE || "demo";
  if (!["demo", "production"].includes(mode))
    throw new Error("DATA_MODE must be demo or production");
  const production = env.NODE_ENV === "production";
  if (production && mode !== "production")
    throw new Error("Production forbids demo mode");
  const dbPath = path.resolve(
    env.DATABASE_PATH || `server/data/${mode}.sqlite`,
  );
  const legal = env.LEGAL_FILE
    ? JSON.parse(fs.readFileSync(env.LEGAL_FILE, "utf8"))
    : null;
  return {
    mode,
    production,
    dbPath,
    uploadDir: `${dbPath}.uploads`,
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 3000),
    appId: env.WECHAT_APP_ID || "",
    appSecret: env.WECHAT_APP_SECRET || "",
    sessionHours: Number(env.SESSION_TTL_HOURS || 168),
    onlineSeconds: Number(env.DEVICE_ONLINE_SECONDS || 300),
    freshSeconds: Number(env.READING_FRESH_SECONDS || 600),
    propertyPhone:
      env.PROPERTY_PHONE_VERIFIED === "true" ? env.PROPERTY_PHONE || "" : "",
    propertyUpdatedAt: env.PROPERTY_UPDATED_AT || null,
    legalApproved:
      env.LEGAL_APPROVED === "true" && !!legal?.terms && !!legal?.privacy,
    legalVersion: env.LEGAL_VERSION || "draft-2026-09",
    legal,
    catalogFile: env.CATALOG_FILE || "",
    ingestKey: env.DEVICE_INGEST_KEY || "",
  };
}
