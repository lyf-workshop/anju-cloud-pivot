import type { FastifyInstance, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import type { ServerResponse } from "node:http";
import sharp from "sharp";
import { z } from "zod";
import type { Settings } from "./config.js";
import type { Store } from "./db.js";
import { fail, hash, now } from "./core.js";

const cameraId = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/);
const metadataSchema = z.object({
  bootId: z.string().trim().min(8).max(80),
  sequence: z.number().int().nonnegative(),
  capturedAt: z.iso.datetime(),
  width: z.number().int().min(160).max(1920),
  height: z.number().int().min(120).max(1080),
  source: z.string().trim().min(1).max(80),
  isTest: z.literal(true),
  model: z.object({
    name: z.string().trim().min(1).max(100),
    version: z.string().trim().min(1).max(60),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
  threshold: z.number().min(0).max(1),
  inferenceMs: z.number().nonnegative().max(60000),
  alarmState: z.enum(["clear", "candidate", "confirmed"]),
  consecutiveHits: z.number().int().nonnegative().max(100000),
  detections: z.array(z.object({
    class: z.enum(["fire", "smoke"]),
    confidence: z.number().min(0).max(1),
    box: z.tuple([
      z.number().nonnegative(),
      z.number().nonnegative(),
      z.number().nonnegative(),
      z.number().nonnegative(),
    ]),
  }).strict()).max(20),
}).strict();

type FrameMetadata = z.infer<typeof metadataSchema>;
type LatestFrame = {
  cameraId: string;
  jpeg: Buffer;
  metadata: FrameMetadata;
  receivedAt: string;
};

const sameSecret = (provided: string, configured: string) => {
  const actual = Buffer.from(hash(provided));
  const expected = Buffer.from(hash(configured));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export function registerCamera(
  app: FastifyInstance,
  deps: { db: Store; cfg: Settings },
) {
  const { db, cfg } = deps;
  const frames = new Map<string, LatestFrame>();
  const streams = new Set<ServerResponse>();

  app.addHook("preClose", async () => {
    for (const stream of streams) {
      if (!stream.destroyed) stream.end();
    }
    streams.clear();
  });

  app.addContentTypeParser(
    "image/jpeg",
    { parseAs: "buffer", bodyLimit: cfg.cameraMaxFrameBytes },
    (_request, body, done) => done(null, body),
  );

  const staffMember = (req: FastifyRequest) => {
    const token = req.cookies.anju_session || "";
    if (!token) return null;
    return db.one(
      `SELECT u.id,m.role FROM users u
       JOIN sessions s ON s.user_id=u.id
       JOIN staff_accounts a ON a.user_id=u.id AND a.active=1
       JOIN staff_memberships m ON m.user_id=u.id
       WHERE s.token_hash=? AND s.expires_at>? AND m.community_id=?`,
      hash(token),
      now(),
      cfg.cameraCommunityId,
    );
  };
  const requireStaff = (req: FastifyRequest) => {
    if (!req.cookies.anju_session)
      fail(401, "SESSION_EXPIRED", "请先登录物业工作台");
    const member = staffMember(req);
    if (!member) fail(403, "COMMUNITY_SCOPE", "无权查看该社区摄像头");
    return member;
  };

  const getLatest = (id: string) => {
    cameraId.parse(id);
    return frames.get(id) || fail(503, "CAMERA_NO_FRAME", "摄像头尚未上传画面");
  };
  const isOnline = (frame: LatestFrame) =>
    Date.now() - Date.parse(frame.receivedAt) <= cfg.cameraStaleSeconds * 1000;
  const publicMetadata = (frame: LatestFrame) => ({
    cameraId: frame.cameraId,
    online: isOnline(frame),
    staleAfterSeconds: cfg.cameraStaleSeconds,
    receivedAt: frame.receivedAt,
    ...frame.metadata,
    frameUrl: `/api/staff/cameras/${encodeURIComponent(frame.cameraId)}/frame.jpg`,
    streamUrl: `/api/staff/cameras/${encodeURIComponent(frame.cameraId)}/stream.mjpg`,
    reviewRequired: frame.metadata.alarmState !== "clear",
  });

  app.post(
    "/api/camera-ingest/v1/cameras/:id/frame",
    { bodyLimit: cfg.cameraMaxFrameBytes },
    async (req: any, reply) => {
      if (!cfg.cameraIngestKey)
        fail(503, "CAMERA_INGEST_DISABLED", "摄像头接入尚未配置");
      const provided = String(req.headers["x-camera-key"] || "");
      if (!provided || !sameSecret(provided, cfg.cameraIngestKey))
        fail(401, "CAMERA_KEY_INVALID", "摄像头接入凭据无效");
      const id = cameraId.parse(req.params.id);
      const encoded = String(req.headers["x-camera-metadata"] || "");
      if (!encoded || encoded.length > 12000)
        fail(400, "CAMERA_METADATA_REQUIRED", "缺少摄像头帧元数据");
      let parsed: unknown;
      try {
        parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      } catch {
        fail(400, "CAMERA_METADATA_INVALID", "摄像头帧元数据格式无效");
      }
      const metadata = metadataSchema.parse(parsed);
      if (Date.parse(metadata.capturedAt) > Date.now() + 60_000)
        fail(400, "CAMERA_TIME_INVALID", "摄像头采集时间不能晚于服务器时间");
      const jpeg = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8)
        fail(415, "CAMERA_FRAME_INVALID", "仅接受有效 JPEG 画面");
      const image: sharp.Metadata = await sharp(jpeg).metadata().catch(() =>
        fail(415, "CAMERA_FRAME_INVALID", "JPEG 画面无法解析"),
      );
      if (
        image.format !== "jpeg" ||
        image.width !== metadata.width ||
        image.height !== metadata.height ||
        (image.width || 0) > 1920 ||
        (image.height || 0) > 1080
      )
        fail(400, "CAMERA_DIMENSIONS_INVALID", "画面尺寸与元数据不一致");
      for (const detection of metadata.detections) {
        const [x1, y1, x2, y2] = detection.box;
        if (x2 <= x1 || y2 <= y1 || x2 > metadata.width || y2 > metadata.height)
          fail(400, "CAMERA_BOX_INVALID", "检测框超出画面范围");
      }
      const previous = frames.get(id);
      if (
        previous &&
        previous.metadata.bootId === metadata.bootId &&
        metadata.sequence <= previous.metadata.sequence
      )
        fail(409, "CAMERA_FRAME_OUT_OF_ORDER", "重复或乱序的摄像头帧");
      const receivedAt = now();
      frames.set(id, { cameraId: id, jpeg, metadata, receivedAt });
      reply.code(202);
      return { data: { cameraId: id, sequence: metadata.sequence, receivedAt } };
    },
  );

  app.get("/api/staff/cameras/:id/status", async (req: any) => {
    requireStaff(req);
    return { data: publicMetadata(getLatest(req.params.id)) };
  });

  app.get("/api/camera-access/v1/cameras/:id", async (req: any) => {
    if (!staffMember(req)) return { data: { authenticated: false } };
    return {
      data: { authenticated: true, ...publicMetadata(getLatest(req.params.id)) },
    };
  });

  app.get("/api/staff/cameras/:id/frame.jpg", async (req: any, reply) => {
    requireStaff(req);
    const frame = getLatest(req.params.id);
    if (!isOnline(frame)) fail(503, "CAMERA_OFFLINE", "摄像头画面已过期");
    return reply
      .header("Content-Type", "image/jpeg")
      .header("Cache-Control", "private, no-store")
      .send(frame.jpeg);
  });

  app.get("/api/staff/cameras/:id/stream.mjpg", async (req: any, reply) => {
    requireStaff(req);
    let frame = getLatest(req.params.id);
    if (!isOnline(frame)) fail(503, "CAMERA_OFFLINE", "摄像头画面已过期");
    reply.hijack();
    const raw = reply.raw;
    streams.add(raw);
    raw.statusCode = 200;
    raw.setHeader("Content-Type", "multipart/x-mixed-replace; boundary=frame");
    raw.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
    raw.setHeader("Pragma", "no-cache");
    raw.setHeader("X-Accel-Buffering", "no");
    let sent = "";
    const write = () => {
      const latest = frames.get(req.params.id);
      if (!latest || !isOnline(latest)) return;
      const key = `${latest.metadata.bootId}:${latest.metadata.sequence}`;
      if (key === sent || raw.destroyed) return;
      sent = key;
      frame = latest;
      raw.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.jpeg.length}\r\n\r\n`);
      raw.write(frame.jpeg);
      raw.write("\r\n");
    };
    write();
    const timer = setInterval(write, 200);
    const close = () => {
      clearInterval(timer);
      streams.delete(raw);
    };
    raw.on("close", close);
    raw.on("error", close);
  });
}
