# 树莓派实时视频与 YOLO 火焰识别

本项目已在 `raspberrypi-via-aliyun` 对应的 Raspberry Pi 5（8 GB、Debian 12）上接入 IMX219 CSI 摄像头。树莓派运行本地 ONNX 模型完成推理，再把标注后的 JPEG 和结构化元数据经 HTTPS 推送到 `https://xn--9kqy92aeqav77a.com`。服务器只中继最新一帧，不保存录像，也没有向公网开放树莓派 RTSP、摄像头或 SSH 端口。

## 已部署结构

| 项目 | 位置 / 值 |
|---|---|
| 树莓派服务 | `anju-camera-agent.service`（已启用开机启动） |
| 代理程序 | `/opt/anju-camera-agent/fire_camera_agent.py` |
| 树莓派配置 | `/etc/anju-camera-agent.env`，权限 `600` |
| 模型 | `/home/pi/models/fire-smoke/yolov8n-fire-smoke.onnx` |
| 模型 SHA-256 | `1b8d178782245ece810a4e56f918cb3b4c4d93d44a3f8f004dd7a4a1cb837d7d` |
| 摄像头 ID | `CAM-RPI-01` |
| 画面 | 640×480，目标 4 FPS，JPEG quality 78 |
| 服务端密钥 | `/etc/anju-cloud-pivot/camera-ingest-key`，不写入仓库或响应 |
| 网页入口 | 域名首页；物业登录后自动切换到受控 MJPEG |

仓库模板位于 `edge/raspberry-pi/`。需要重新安装时，将 `fire_camera_agent.py` 放到 `/opt/anju-camera-agent/`，将 unit 放到 `/etc/systemd/system/`，按 `anju-camera-agent.env.example` 创建受保护配置，然后执行：

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now anju-camera-agent
sudo systemctl status anju-camera-agent --no-pager
sudo journalctl -u anju-camera-agent -f
```

`CAMERA_INGEST_KEY` 必须与服务器一致，不能出现在网页、小程序、日志或 Git 中。树莓派仅需主动访问服务器 HTTPS；无需入站摄像头端口。

摄像头安装方向通过树莓派环境文件中的 `CAMERA_ROTATION` 调整，支持 `0`、`90`、`180`、`270`。旋转在 YOLO 推理前执行，因此网页画面、检测框和上传尺寸始终一致；当前部署的倒装摄像头配置为 `180`。

当前 Picamera2 将 libcamera 的 `RGB888` 以 BGR 通道顺序交给 NumPy，采集程序直接将该数组交给 OpenCV、YOLO 与 JPEG 编码。不要再次执行 `RGB→BGR` 转换，否则红蓝通道会互换并造成明显蓝色偏色。

## 检测与复核规则

模型推理的最低候选置信度是 0.25，业务判断阈值是 0.60。连续 3 帧达到阈值后状态从 `candidate` 变为 `confirmed`；`confirmed` 后连续 8 帧未命中才回到 `clear`。服务端拒绝无密钥、非法 JPEG、尺寸不符、越界检测框、同一启动会话的重复帧和乱序帧。

`confirmed` 的产品含义只能是“模型连续帧疑似检测，待人工复核”。它不代表火灾已经核实，不会触发 119、物业电话、派单、硬件控制或真实告警。网页处置按钮在实时模型模式下保持禁用。

模型目录附带的 `SOURCE_README.md` 声明来源为 `github.com/17tuanphamanh/YOLOv8n-FireDetection`，许可证文件为 MIT（Copyright 2025 Tuấn Anh Phạm）。运行时 ONNX 元数据的类别实际为 `0=smoke, 1=fire`，与来源 README 中描述的顺序相反；代理按模型返回的类别名称处理，不硬编码类别编号。随模型正样本在树莓派上离线推理得到 `smoke=0.7636` 和 `smoke=0.3874`，证明权重和类别输出可执行，证据图为 `output/raspberry-pi/yolo-sample-detected.jpg`。这张样例本身是聊天截图，单张样例不能证明准确率；目前仍没有训练集细目、精度、召回率或目标场景误报率报告，因此不能用于无人值守消防判断。

## HTTP 链路

树莓派向以下接口发送原始 JPEG：

```text
POST /api/camera-ingest/v1/cameras/CAM-RPI-01/frame
Content-Type: image/jpeg
X-Camera-Key: <独立密钥>
X-Camera-Metadata: <base64url JSON>
```

元数据包含 `bootId`、`sequence`、`capturedAt`、尺寸、来源、模型名/版本/SHA-256、阈值、推理耗时、`alarmState`、连续命中数和检测框。`isTest` 固定为 `true`。物业 Cookie 和社区权限校验通过后才能访问状态、单帧及 MJPEG。服务重启会主动关闭 MJPEG 客户端，避免长连接阻塞部署。

## 当前现场限制

摄像头已能稳定打开并持续上传，端到端浏览器确认 MJPEG 为 640×480，树莓派 ONNX 单帧推理实测约 60–90 ms。当前画面明显偏暗，早期取样还出现过镜头遮挡/偏色；展示前需要在树莓派现场完成以下操作：

1. 清洁镜头并确认保护膜、手指或外壳没有遮挡。
2. 将镜头对准光照稳定、可控且不会采集私人空间的位置，必要时补光。
3. 使用安全的烟火测试素材做人工复核，不在室内点真实明火，不用测试结果宣称模型已验收。
4. 长期运行前补齐摄像头安装告知、访问审计、保留期限和模型评估；当前实现不录像。

运维检查：

```sh
ssh raspberrypi-via-aliyun "systemctl is-active anju-camera-agent"
ssh raspberrypi-via-aliyun "journalctl -u anju-camera-agent -n 50 --no-pager"
ssh us-vps-01 "systemctl is-active anju-cloud-pivot"
```
