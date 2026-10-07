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
  const publicDemo = env.PUBLIC_DEMO === "true";
  if (publicDemo && (production || mode !== "demo"))
    throw new Error("PUBLIC_DEMO requires development demo mode");
  if (publicDemo && (!env.DEMO_STAFF_PASSWORD || env.DEMO_STAFF_PASSWORD.length < 16))
    throw new Error("PUBLIC_DEMO requires a unique DEMO_STAFF_PASSWORD of at least 16 characters");
  const demoExperience = env.DEMO_EXPERIENCE === "true" || publicDemo;
  if (demoExperience && (production || mode !== "demo"))
    throw new Error("DEMO_EXPERIENCE requires development demo mode");
  const dbPath = path.resolve(
    env.DATABASE_PATH || `server/data/${mode}.sqlite`,
  );
  const legal = env.LEGAL_FILE
    ? JSON.parse(fs.readFileSync(env.LEGAL_FILE, "utf8"))
    : null;
  return {
    mode,
    production,
    publicDemo,
    demoExperience,
    dbPath,
    uploadDir: `${dbPath}.uploads`,
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 3000),
    appId: env.WECHAT_APP_ID || "",
    appSecret: env.WECHAT_APP_SECRET || "",
    sessionHours: Number(env.SESSION_TTL_HOURS || 168),
    staffSessionHours: Number(env.STAFF_SESSION_TTL_HOURS || 12),
    staffRememberSessionHours: Number(env.STAFF_REMEMBER_SESSION_TTL_HOURS || 168),
    staffLockAttempts: Number(env.STAFF_LOCK_ATTEMPTS || 5),
    staffLockMinutes: Number(env.STAFF_LOCK_MINUTES || 15),
    demoSessionHours: Number(env.DEMO_SESSION_TTL_HOURS || 2160),
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
    cameraIngestKey: env.CAMERA_INGEST_KEY || "",
    cameraCommunityId: env.CAMERA_COMMUNITY_ID || "community-demo",
    cameraStaleSeconds: Number(env.CAMERA_STALE_SECONDS || 10),
    cameraMaxFrameBytes: Number(env.CAMERA_MAX_FRAME_BYTES || 512 * 1024),
    webRoot: path.resolve(env.WEB_ROOT || "安居云枢网页端(1)/textcursor"),
    webOrigins: (
      env.WEB_ORIGINS || "http://127.0.0.1:3000,http://localhost:3000"
    )
      .split(",")
      .map((s) => s.trim()),
    clientOrigins: (
      env.CLIENT_ORIGINS ||
      "app://anju,https://localhost,http://localhost,http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:5173,http://localhost:5173"
    )
      .split(",")
      .map((s) => s.trim()),
    demoStaffPassword: env.DEMO_STAFF_PASSWORD || "AnjuLocal2026!",
    llmApiKey: env.ZHIZENGZENG_API_KEY || env.LLM_API_KEY || "",
    llmBaseUrl: (env.LLM_BASE_URL || "https://api.zhizengzeng.com/v1").replace(
      /\/$/,
      "",
    ),
    llmModel: env.LLM_MODEL || "qwen-plus",
    agentCameraId: env.AGENT_CAMERA_ID || "CAM-RPI-01",
  };
}
