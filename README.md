# 安居云枢 · 居民小程序与物业网页

## 评委体验版（Windows / Android，2026-09-30）

本仓库现保留原生微信小程序，并新增一套共享居民前端 `apps/resident`：Windows 使用 Electron，Android 使用 Capacitor。它们不是把 WXML/WXSS 伪装成可直接打包，而是复用现有业务模型、接口和视觉后重新实现的响应式客户端。打开安装版可点“直接体验”，首次自动领取按安装隔离的匿名演示会话；之后自动恢复，无需账号、密码、协议勾选或绑定住址。

- Windows 安装包：`output/installers/windows/安居云枢-Windows-1.3.0-Setup.exe`
- Android APK：`output/installers/android/Anju-CloudPivot-Android-1.3.0.apk`
- 正式演示 API：`https://xn--9kqy92aeqav77a.com/api`
- 评委一页说明：[docs/judge-guide.md](docs/judge-guide.md)
- 发布边界：[docs/release-notes.md](docs/release-notes.md)

服务器当前 release 为 `/opt/anju-cloud-pivot/releases/20260930-mobile-v12`，systemd、Caddy HTTPS、SQLite 持久化、每日备份与受控下载均独立配置。匿名会话默认 90 天有效；服务端按安装键映射私有用户，客户端只保存随机安装键和会话令牌，不包含共享管理员密钥。1.3.0 已按队友小程序补齐登录后的两步住户登记与登记完成页，并通过 Windows 安装版和 Android 16 安装 APK 的完整闭环，详见 [验证记录](docs/verification.md)。

居民小程序与物业接口联调共用 Fastify / TypeScript / SQLite 后端。物业网页现以小组成员提供的 `安居云枢网页端(2).zip` 为默认界面，包含值班台、制度责任、数字孪生、人员台账、巡查台账、处置预案、隐患工单和紧急处置；成员版 Mock 交互继续保留，树莓派实时画面、物业登录和接口联调工作台由现有兼容层接入。小程序、本地数据库和现有接口继续保留。

公网演示入口：<https://xn--9kqy92aeqav77a.com/>。小组成员新版网页已部署在 `us-vps-01` 的独立服务上；摄像头区域已接入树莓派 IMX219 和树莓派本地 YOLO 火焰/烟雾模型，其余台账与统计仍明确使用 Mock。实时画面必须先登录物业账号。部署布局、运维和密码获取见 [部署记录](docs/deployment.md)，本次合并说明见 [成员网页合并记录](docs/member-web-merge.md)。

## 树莓派实时视频

树莓派运行 `edge/raspberry-pi/fire_camera_agent.py`：以 640×480、约 4 FPS 采集摄像头，在树莓派上用现有 `yolov8n-fire-smoke.onnx` 推理并绘制检测框，再通过 HTTPS 上传最新 JPEG 与元数据。服务端只在内存保留最新一帧，不录像、不把树莓派端口暴露到公网。网页登录后通过受控 MJPEG 端点查看；未登录只能看到登录提示。

连续 3 帧达到 0.60 阈值才进入 `confirmed`，连续 8 帧未命中才清除。界面中的 `confirmed` 仅表示“模型连续帧疑似，待人工复核”，不会自动拨号、派单或生成已核实火警。当前权重来源和准确率尚未完成独立验证，现场镜头画面偏暗，上线演示前应补光、清洁并重新对准镜头。

## 启动

需要 Node.js ≥22.13（建议24 LTS）。在项目根目录的 PowerShell 或终端执行：

```powershell
npm ci
npm run backend:db:init
npm run dev
```

成员版网页：<http://127.0.0.1:3000/index.html>，无需登录。接口联调入口：<http://127.0.0.1:3000/login.html>（进入后 URL 带 `?mode=api`）。本地演示物业账号 `property-demo`，默认密码 `AnjuLocal2026!`。服务端配置模板为 `server/.env.example`；不复制 `.env` 也可按开发默认值启动。不要覆盖已有 `.env`。克隆仓库后需安装 Git LFS 并执行 `git lfs pull`，以取得成员演示视频。

小程序比赛真机演示：执行 `npm run client:remote-demo`，微信开发者工具导入**当前仓库根目录**，开发基础库3.17.3。客户端通过现有 HTTPS 演示服务器自动领取按设备隔离的匿名会话，无需本机后端或真实微信登录；`npm run client:local` 仍用于本机 HTTP 联调。

## 后端联调闭环（显式进入API工作台）

1. 小程序上报隐患、选择图片，查看后端生成的编号和详情。
2. 接口联调工作台中“隐患工单”刷新，受理并填写处理说明，再标记完成。
3. 小程序详情刷新，读取同一条工单的最新状态和时间线。
4. 小程序“楼栋”完成两步演练，查看总结与历史；网页值班台读取演练统计。
5. 接口联调工作台可审核住址、登记巡查、安排值班、发布公告；重启后数据保留。

默认成员版网页的火情演练、台账、统计和上报表单均为 Mock，表单不会通知物业或写入后端；树莓派实时视频是独立受控数据源，登录后替换首页 Mock 视频。成员样式和 `script.js` 交互保留，可直接打开 HTML 或通过本地服务浏览。

设备为固定演示来源，离线、未知和过期分别展示。紧急联系方式可未登录访问；本轮电话按钮只弹提示，不实际拨号。

## 数据、检查与模式

- 数据库：`server/data/demo.sqlite`；私有图片：`server/data/demo.sqlite.uploads/`。两者不进入Git。
- 网页入口：`安居云枢网页端(1)/textcursor/site.js`，默认加载成员版 `script.js` 并在首页接入树莓派实时画面，仅 `?mode=api` 加载接口界面。
- API：`server/src/`；小程序适配：`services/api-repository.js`；网页接口适配：`安居云枢网页端(1)/textcursor/api.js` 和 `connected.js`。
- 离线数据仍在 `mock/`，执行 `npm run client:showcase` 可切回原展示版；API请求失败不会回退到它。
- 检查：`npm run check`、`npm test`、`npm run backend:build`、`npm run backend:test`、`npm run check:wechat`。
- 启动服务后执行 `npm run backend:smoke`，通过真实HTTP写入并检查标记的演示记录。
- 显式重置：先停止后端，再运行 `npm run backend:db:reset`。会清空默认开发数据库和图片；普通启动/初始化不清数据。

详细步骤、配置、Windows命令和后续接入边界见 [本地联调说明](docs/local-development.md)。接口见 [API文档](docs/api.md)，实际验证见 [验证记录](docs/verification.md)，进度见 [实施记录](docs/implementation-progress.md)。

需要交给队友或回收本机构建缓存时，使用 [队友接手与轻量打包](docs/handoff.md)。该说明列出了压缩包包含内容、隐私排除项、解压后的启动命令和可重复执行的安全清理脚本。

已完成公网演示部署及树莓派摄像头/YOLO 测试链路；真实微信登录、模型精度验收和正式消防告警仍未接入或验证。原展示版说明保存在 [历史README](docs/archive/showcase-README.md)。
