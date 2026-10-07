#!/usr/bin/env python3
"""Capture IMX219 frames, run the local fire/smoke YOLO model, and upload JPEGs.

This agent never declares a verified fire and never sends an emergency alert. It
publishes test-only model observations for a logged-in human operator to review.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import signal
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass

import cv2
from picamera2 import Picamera2
from ultralytics import YOLO


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(message)s",
)
LOG = logging.getLogger("anju-camera")
RUNNING = True


def env_float(name: str, default: float) -> float:
    return float(os.getenv(name, str(default)))


def env_int(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)))


@dataclass(frozen=True)
class Config:
    base_url: str
    ingest_key: str
    camera_id: str
    model_path: str
    fps: float
    width: int
    height: int
    rotation_degrees: int
    image_size: int
    inference_confidence: float
    decision_threshold: float
    confirm_frames: int
    clear_frames: int
    jpeg_quality: int
    timeout_seconds: float

    @classmethod
    def load(cls) -> "Config":
        config = cls(
            base_url=os.environ.get("CAMERA_SERVER_URL", "").rstrip("/"),
            ingest_key=os.environ.get("CAMERA_INGEST_KEY", ""),
            camera_id=os.getenv("CAMERA_ID", "CAM-RPI-01"),
            model_path=os.getenv(
                "YOLO_MODEL_PATH", "/home/pi/models/fire-smoke/yolov8n-fire-smoke.onnx"
            ),
            fps=env_float("CAMERA_FPS", 4.0),
            width=env_int("CAMERA_WIDTH", 640),
            height=env_int("CAMERA_HEIGHT", 480),
            rotation_degrees=env_int("CAMERA_ROTATION", 0),
            image_size=env_int("YOLO_IMAGE_SIZE", 416),
            inference_confidence=env_float("YOLO_INFERENCE_CONFIDENCE", 0.25),
            decision_threshold=env_float("YOLO_DECISION_THRESHOLD", 0.60),
            confirm_frames=env_int("YOLO_CONFIRM_FRAMES", 3),
            clear_frames=env_int("YOLO_CLEAR_FRAMES", 8),
            jpeg_quality=env_int("CAMERA_JPEG_QUALITY", 78),
            timeout_seconds=env_float("CAMERA_UPLOAD_TIMEOUT", 8.0),
        )
        if not config.base_url.startswith("https://"):
            raise ValueError("CAMERA_SERVER_URL must use HTTPS")
        if len(config.ingest_key) < 24:
            raise ValueError("CAMERA_INGEST_KEY is missing or too short")
        if not os.path.isfile(config.model_path):
            raise ValueError(f"YOLO model does not exist: {config.model_path}")
        if not 0.05 <= config.fps <= 15:
            raise ValueError("CAMERA_FPS must be between 0.05 and 15")
        if config.rotation_degrees not in {0, 90, 180, 270}:
            raise ValueError("CAMERA_ROTATION must be one of 0, 90, 180 or 270")
        if config.decision_threshold < config.inference_confidence:
            raise ValueError("YOLO_DECISION_THRESHOLD must not be below inference confidence")
        return config


class AlarmState:
    def __init__(self, confirm_frames: int, clear_frames: int) -> None:
        self.confirm_frames = confirm_frames
        self.clear_frames = clear_frames
        self.hits = 0
        self.misses = 0
        self.state = "clear"

    def update(self, positive: bool) -> str:
        if positive:
            self.hits += 1
            self.misses = 0
            self.state = "confirmed" if self.hits >= self.confirm_frames else "candidate"
        else:
            self.hits = 0
            if self.state == "confirmed":
                self.misses += 1
                if self.misses >= self.clear_frames:
                    self.state = "clear"
                    self.misses = 0
            else:
                self.state = "clear"
                self.misses = 0
        return self.state


def sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as model_file:
        for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def encode_metadata(metadata: dict) -> str:
    raw = json.dumps(metadata, ensure_ascii=False, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def upload(config: Config, jpeg: bytes, metadata: dict) -> None:
    target = (
        f"{config.base_url}/api/camera-ingest/v1/cameras/"
        f"{urllib.parse.quote(config.camera_id, safe='')}/frame"
    )
    request = urllib.request.Request(
        target,
        data=jpeg,
        method="POST",
        headers={
            "Content-Type": "image/jpeg",
            "X-Camera-Key": config.ingest_key,
            "X-Camera-Metadata": encode_metadata(metadata),
            "User-Agent": "anju-rpi-camera/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=config.timeout_seconds) as response:
        if response.status != 202:
            raise RuntimeError(f"server returned HTTP {response.status}")


def install_signal_handlers() -> None:
    def stop(_signum, _frame) -> None:
        global RUNNING
        RUNNING = False

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)


def rotate_frame(frame, rotation_degrees: int):
    """Apply camera mounting correction before inference and annotation."""
    rotations = {
        90: cv2.ROTATE_90_CLOCKWISE,
        180: cv2.ROTATE_180,
        270: cv2.ROTATE_90_COUNTERCLOCKWISE,
    }
    if rotation_degrees == 0:
        return frame
    return cv2.rotate(frame, rotations[rotation_degrees])


def main() -> int:
    config = Config.load()
    install_signal_handlers()
    model_sha = sha256_file(config.model_path)
    model = YOLO(config.model_path, task="detect")
    picam = Picamera2()
    camera_config = picam.create_video_configuration(
        main={"size": (config.width, config.height), "format": "RGB888"},
        controls={"FrameRate": min(config.fps, 15.0)},
        buffer_count=3,
    )
    picam.configure(camera_config)
    picam.start()
    time.sleep(1.0)

    boot_id = str(uuid.uuid4())
    sequence = 0
    state = AlarmState(config.confirm_frames, config.clear_frames)
    next_frame_at = time.monotonic()
    upload_failures = 0
    LOG.info(
        "camera agent started id=%s size=%sx%s rotation=%s fps=%.1f model_sha256=%s",
        config.camera_id,
        config.width,
        config.height,
        config.rotation_degrees,
        config.fps,
        model_sha,
    )
    try:
        while RUNNING:
            delay = next_frame_at - time.monotonic()
            if delay > 0:
                time.sleep(delay)
            next_frame_at = max(next_frame_at + 1.0 / config.fps, time.monotonic())
            captured_epoch = time.time()
            # Picamera2 exposes libcamera RGB888 as a BGR NumPy array (its
            # request FORMAT_TABLE maps RGB888 -> BGR), which already matches
            # OpenCV and Ultralytics. Converting RGB -> BGR again would swap
            # red and blue and give the live picture a strong blue cast.
            bgr = picam.capture_array("main")
            bgr = rotate_frame(bgr, config.rotation_degrees)
            frame_height, frame_width = bgr.shape[:2]
            infer_started = time.monotonic()
            result = model.predict(
                source=bgr,
                imgsz=config.image_size,
                conf=config.inference_confidence,
                verbose=False,
            )[0]
            inference_ms = (time.monotonic() - infer_started) * 1000
            detections = []
            highest = 0.0
            if result.boxes is not None:
                for box in result.boxes:
                    class_index = int(box.cls[0].item())
                    class_name = str(result.names.get(class_index, class_index)).lower()
                    if class_name not in {"fire", "smoke"}:
                        continue
                    confidence = float(box.conf[0].item())
                    coords = [float(v) for v in box.xyxy[0].tolist()]
                    coords[0] = max(0.0, min(coords[0], frame_width - 1.0))
                    coords[1] = max(0.0, min(coords[1], frame_height - 1.0))
                    coords[2] = max(coords[0] + 1.0, min(coords[2], float(frame_width)))
                    coords[3] = max(coords[1] + 1.0, min(coords[3], float(frame_height)))
                    detections.append(
                        {"class": class_name, "confidence": confidence, "box": coords}
                    )
                    highest = max(highest, confidence)
                    color = (30, 70, 230) if class_name == "fire" else (20, 180, 230)
                    x1, y1, x2, y2 = (int(value) for value in coords)
                    cv2.rectangle(bgr, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(
                        bgr,
                        f"{class_name} {confidence:.2f}",
                        (x1, max(18, y1 - 5)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        color,
                        2,
                        cv2.LINE_AA,
                    )
            alarm_state = state.update(highest >= config.decision_threshold)
            cv2.putText(
                bgr,
                f"TEST / HUMAN REVIEW  state={alarm_state}",
                (10, frame_height - 14),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.48,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )
            ok, encoded = cv2.imencode(
                ".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, config.jpeg_quality]
            )
            if not ok:
                LOG.warning("JPEG encoding failed; frame skipped")
                continue
            sequence += 1
            metadata = {
                "bootId": boot_id,
                "sequence": sequence,
                "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(captured_epoch))
                + f".{int(captured_epoch % 1 * 1000):03d}Z",
                "width": frame_width,
                "height": frame_height,
                "source": "raspberry-pi-yolo-demo",
                "isTest": True,
                "model": {
                    "name": "yolov8n-fire-smoke",
                    "version": "local-existing-weight",
                    "sha256": model_sha,
                },
                "threshold": config.decision_threshold,
                "inferenceMs": round(inference_ms, 2),
                "alarmState": alarm_state,
                "consecutiveHits": state.hits,
                "detections": detections[:20],
            }
            try:
                upload(config, encoded.tobytes(), metadata)
                if upload_failures:
                    LOG.info("server upload recovered after %s failures", upload_failures)
                upload_failures = 0
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, RuntimeError) as error:
                upload_failures += 1
                if upload_failures == 1 or upload_failures % 20 == 0:
                    LOG.warning("frame upload failed count=%s error=%s", upload_failures, error)
    finally:
        picam.stop()
        picam.close()
        LOG.info("camera agent stopped")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        LOG.error("camera agent could not start: %s", exc)
        sys.exit(1)
