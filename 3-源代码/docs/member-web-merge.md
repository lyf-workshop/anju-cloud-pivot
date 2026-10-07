# 小组成员网页合并记录

## 来源与目标

- 来源压缩包：项目根目录 `安居云枢网页端(2).zip`
- SHA-256：`96DF6B1D906FDBE48103862241C4AAA5FEE73FF32274AADAA4402B9C0D07A129`
- 本地成员源码副本：`artifacts/member-web-merge-20260929/member-package/`（合并证据，不提交 Git）
- 合并目标：`安居云枢网页端(1)/textcursor/`
- 本地合并前备份：`artifacts/member-web-merge-20260929/premerge-current-web/`（不提交 Git）

默认网页的 HTML、`script.js`、`styles.css`、Logo、楼栋图片和演示视频均以成员压缩包为准。为了继续使用现有后端与实时摄像头，保留并适配了 `site.js`、`camera-live.js`、`api.js`、`connected.js`、`connected.css` 和 `login.html`。

## 树莓派保护边界

本次没有修改 `edge/raspberry-pi/`、树莓派 systemd 服务、模型、接入密钥或服务器摄像头数据契约。合并时记录的关键文件 SHA-256：

- `fire_camera_agent.py`：`B73932C0DFF227FEAA3BB8B59551230663429CA9DA0EDD6661E51F86291D9A7D`
- `anju-camera-agent.service`：`29C12746A94601B4A3A4231C3426C29ED0C87DD301C4AAFBF592F15CA5EEB014`
- `anju-camera-agent.env.example`：`20A450D6B645A5261095B16CC07D0BAE5C8EFFAB0B84DB72CBB806919247A32B`

网页摄像头区沿用原有行为：未登录只显示登录入口；物业会话有效时读取 `/api/camera-access/v1/cameras/CAM-RPI-01` 并显示受控 MJPEG；离线时明确报错，不回退成实时成功。

## 资源与运行

成员提供的 `assets/demo/fire-alert.mp4` 约 121 MB，仓库通过 Git LFS 管理 `*.mp4`。克隆仓库的机器需要安装 Git LFS 并执行 `git lfs pull`。本地运行仍使用项目根目录的 `npm run dev`，访问 `http://127.0.0.1:3000/index.html`。

本次合并已于 2026-09-29 部署为 `/opt/anju-cloud-pivot/releases/20260929-member-web-v1`，`current` 已切换到该 release；原 `20260929-judge-app-v1` 保留为回滚点。发布未修改服务器数据库、Caddy 其他站点或树莓派采集服务。实际公网检查见 `docs/verification.md`。
