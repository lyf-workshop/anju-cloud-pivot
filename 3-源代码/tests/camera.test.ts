import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { buildApp } from "../server/src/app.js";
import { settings } from "../server/src/config.js";

test("camera ingest is keyed, ordered and only visible to scoped staff", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-camera-"));
  const cfg = settings({
    DATA_MODE: "demo",
    DATABASE_PATH: path.join(dir, "test.sqlite"),
    CAMERA_INGEST_KEY: "camera-test-key-with-enough-entropy",
  });
  const app = await buildApp(cfg);
  const jpeg = await sharp({
    create: { width: 320, height: 240, channels: 3, background: "#9b2f1f" },
  }).jpeg().toBuffer();
  const metadata = (sequence: number, bootId = "boot-session-0001") => ({
    bootId,
    sequence,
    capturedAt: new Date().toISOString(),
    width: 320,
    height: 240,
    source: "raspberry-pi-yolo-demo",
    isTest: true as const,
    model: {
      name: "yolov8n-fire-smoke",
      version: "local-existing-weight",
      sha256: "1".repeat(64),
    },
    threshold: 0.6,
    inferenceMs: 72,
    alarmState: "candidate" as const,
    consecutiveHits: 1,
    detections: [{ class: "smoke" as const, confidence: 0.67, box: [1, 2, 100, 120] }],
  });
  const ingest = (data: ReturnType<typeof metadata>, key = cfg.cameraIngestKey, payload = jpeg) =>
    app.inject({
      method: "POST",
      url: "/api/camera-ingest/v1/cameras/CAM-RPI-01/frame",
      headers: {
        "content-type": "image/jpeg",
        "x-camera-key": key,
        "x-camera-metadata": Buffer.from(JSON.stringify(data)).toString("base64url"),
      },
      payload,
    });
  try {
    assert.equal((await ingest(metadata(1), "wrong-key")).statusCode, 401);
    assert.equal((await ingest(metadata(1), cfg.cameraIngestKey, Buffer.from("not-jpeg"))).statusCode, 415);
    assert.equal((await ingest(metadata(1))).statusCode, 202);
    assert.equal((await ingest(metadata(1))).statusCode, 409);
    assert.equal((await ingest(metadata(0), cfg.cameraIngestKey)).statusCode, 409);
    assert.equal((await ingest(metadata(0, "boot-session-0002"))).statusCode, 202);

    assert.equal(
      (await app.inject({ url: "/api/staff/cameras/CAM-RPI-01/status" })).statusCode,
      401,
    );
    const access = await app.inject({ url: "/api/camera-access/v1/cameras/CAM-RPI-01" });
    assert.equal(access.statusCode, 200);
    assert.deepEqual(access.json().data, { authenticated: false });
    const login = await app.inject({
      method: "POST",
      url: "/api/staff/auth/login",
      headers: { "x-anju-request": "1", origin: "http://127.0.0.1:3000" },
      payload: { username: "property-demo", password: cfg.demoStaffPassword },
    });
    assert.equal(login.statusCode, 200);
    const cookie = String(login.headers["set-cookie"]).split(";")[0];
    const status = await app.inject({
      url: "/api/staff/cameras/CAM-RPI-01/status",
      headers: { cookie },
    });
    assert.equal(status.statusCode, 200);
    const view = status.json().data;
    assert.equal(view.online, true);
    assert.equal(view.alarmState, "candidate");
    assert.equal(view.reviewRequired, true);
    assert.equal(view.sequence, 0);
    assert.ok(!JSON.stringify(view).includes(cfg.cameraIngestKey));
    const browserAccess = await app.inject({
      url: "/api/camera-access/v1/cameras/CAM-RPI-01",
      headers: { cookie },
    });
    assert.equal(browserAccess.statusCode, 200);
    assert.equal(browserAccess.json().data.authenticated, true);
    assert.equal(browserAccess.json().data.cameraId, "CAM-RPI-01");

    const frame = await app.inject({
      url: "/api/staff/cameras/CAM-RPI-01/frame.jpg",
      headers: { cookie },
    });
    assert.equal(frame.statusCode, 200);
    assert.match(String(frame.headers["content-type"]), /^image\/jpeg/);
    assert.deepEqual(frame.rawPayload, jpeg);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("camera ingest stays disabled unless an explicit key is configured", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-camera-off-"));
  const app = await buildApp(settings({ DATA_MODE: "demo", DATABASE_PATH: path.join(dir, "test.sqlite") }));
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/camera-ingest/v1/cameras/CAM-RPI-01/frame",
      headers: { "content-type": "image/jpeg", "x-camera-key": "unused", "x-camera-metadata": "e30" },
      payload: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    assert.equal(response.statusCode, 503);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
