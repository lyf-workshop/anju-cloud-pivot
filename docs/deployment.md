# 公网演示部署（更新于 2026-10-07）

服务部署在 `us-vps-01`，入口为 <https://xn--9kqy92aeqav77a.com/>，客户端 API 为 `https://xn--9kqy92aeqav77a.com/api`。这是**公网演示环境**：Windows 1.5.0 是需要物业账号的网页工作台；Android 1.5.0 和微信小程序是自动领取隔离匿名会话的住户端。默认浏览器首页保留小组成员版展示，`/login.html` 是真实物业登录入口。数据库是服务器上的独立 SQLite 演示库；它不是已投入使用的消防监控系统，也没有接入真实微信登录或真实住户数据。

## 当前服务器布局

| 项目 | 位置 |
| --- | --- |
| systemd 服务 | `anju-cloud-pivot.service` |
| 当前代码 | `/opt/anju-cloud-pivot/current` → `/opt/anju-cloud-pivot/releases/20261007-auth-role-v17` |
| 网页静态目录 | release 内 `site` → `安居云枢网页端(1)/textcursor` |
| 数据库和附件 | `/var/lib/anju-cloud-pivot/` |
| 服务端配置 | `/etc/anju-cloud-pivot/anju.env`（`root:anju`，权限 `640`） |
| 物业演示密码 | `/etc/anju-cloud-pivot/staff-password`（`root`，权限 `600`） |
| 摄像头接入密钥 | `/etc/anju-cloud-pivot/camera-ingest-key`（`root`，权限 `600`） |
| 摄像头服务配置 | `/etc/anju-cloud-pivot/anju.env` 内的 `CAMERA_*`；密钥不输出到响应 |
| Caddy 配置 | `/etc/caddy/Caddyfile`，本域名 API/网页反向代理到 `127.0.0.1:3101`，另有受控下载 handle；其他站点保留 |
| 原 Caddy 备份 | `/etc/caddy/Caddyfile.anju-pre-20260929-092721` |
| 每日备份 | `anju-cloud-pivot-backup.timer`，每日 03:20 UTC；`/var/backups/anju-cloud-pivot/` |
| 受控下载 | `/srv/anju-cloud-pivot-downloads/judge-downloads/`；Caddy Basic Auth；密码仅在服务器 `/etc/anju-cloud-pivot/judge-download-password` |

可以在本机 PowerShell 执行 `ssh us-vps-01`，然后在服务器里执行：

```sh
systemctl status anju-cloud-pivot --no-pager
curl -fsS http://127.0.0.1:3101/api/health
curl -fsS https://xn--9kqy92aeqav77a.com/api/health
journalctl -u anju-cloud-pivot -n 50 --no-pager
systemctl status anju-cloud-pivot-backup.timer --no-pager
ssh raspberrypi-via-aliyun "systemctl status anju-camera-agent --no-pager"
```

联调账号为 `property-demo`。密码在服务器上随机生成，不写入仓库或网页；服务器管理员可执行 `cat /etc/anju-cloud-pivot/staff-password` 查看。公开域名使用 `PUBLIC_DEMO=true`，居民开发登录被拒绝、网页不显示默认口令、物业会话 Cookie 带 `Secure`。演示数据和操作不得当作真实告警或住户资料。不要把此环境的演示数据库切换为正式业务库。

评委下载页不在公开首页展示，路径为 `/judge-downloads/`，用户名 `reviewer`。当前提供 Windows 物业工作台 `Anju-Property-Windows-1.5.0-Setup.exe` 和 Android 住户端 `Anju-CloudPivot-Android-1.5.0.apk`；旧 1.4.0 已移到站点外 `/srv/anju-cloud-pivot-downloads/archive/`。密码随机生成且不写入仓库，可由服务器管理员执行 `sudo cat /etc/anju-cloud-pivot/judge-download-password` 获取，并通过与链接不同的渠道发给评委。Caddy 对该路径设置 Basic Auth、`Cache-Control: private, no-store` 和 `X-Robots-Tag: noindex, nofollow`。1.5.0 已实测未授权 401、授权索引 200、两个安装包分段请求 206，服务器端 SHA-256 与本地构建一致。评审结束后应撤下文件、轮换下载密码并按保留政策清理演示数据。

备份脚本 `/usr/local/sbin/anju-cloud-pivot-backup` 使用 SQLite `VACUUM INTO` 生成一致数据库副本，再归档附件并写入 SHA-256/`COMPLETE` 标记；首个实际备份位于 `/var/backups/anju-cloud-pivot/20260929T183113Z`。自动备份不等于恢复演练，正式运营前仍应在隔离目录执行定期恢复测试。

## 后续更新与恢复

当前 release 为 `/opt/anju-cloud-pivot/releases/20261007-auth-role-v17`；上一版 `/opt/anju-cloud-pivot/releases/20261007-nav-v16` 保留为回退点。切换前已生成一致数据库备份 `/var/backups/anju-cloud-pivot/20261007T144150Z`。本轮 schema 4 只新增物业独立会话、登录审计及账号锁定字段；原账号密码、居民数据、附件、Caddy 其他站点、树莓派服务和 `/var/lib/anju-cloud-pivot/` 均未覆盖。物业会话默认12小时，“保持登录”默认7天；可用 `STAFF_SESSION_TTL_HOURS`、`STAFF_REMEMBER_SESSION_TTL_HOURS`、`STAFF_LOCK_ATTEMPTS`、`STAFF_LOCK_MINUTES` 配置。外部模型密钥当前未配置，居民和物业智能体使用明确标注的本地安全规则。

回退时仅切换 `current` 软链接并重启 `anju-cloud-pivot`，不要改动 Caddy 中其他站点。例如将 `<上一个可用版本>` 替换为实际目录：

```sh
ln -sfn /opt/anju-cloud-pivot/releases/<上一个可用版本> /opt/anju-cloud-pivot/current
systemctl restart anju-cloud-pivot
```

若要接正式业务，需先准备正式微信 AppID/AppSecret、审核后的协议、真实社区/楼栋目录、物业联系信息及小程序合法域名，再部署 `NODE_ENV=production`、`DATA_MODE=production` 与独立数据库。正式模式不会加载演示种子或允许开发登录。当前没有执行这些步骤；摄像头方案见 [树莓派摄像头接入](raspberry-pi-camera.md)。

## 实际验证边界

服务已在服务器上运行；Caddy 对域名的 HTTPS 证书校验通过。成员版 8 个页面、登录页和健康接口返回 200，121 MB 演示视频支持 HTTP 206 分段读取；真实 Chromium 打开值班台并跳转“制度责任”，控制台 0 错误。远端评委冒烟通过匿名会话创建/恢复、会话隔离、上报、个人记录、演练完成及重启读回。物业登录返回 200，摄像头状态和最新帧返回 200（640×480 JPEG），实时元数据明确标记 `raspberry-pi-yolo-demo` 与 `isTest=true`；截图见 [本次公网成员版值班台](../output/playwright/deployed-member-home-20260929.png) 和 [实时值班台](../output/playwright/raspberry-live-dashboard-final.png)。原 `codetether.org` 站点继续保留。Windows/Android 安装验证见 [verification.md](verification.md)。这些结果不等于小程序真机、真实微信登录、模型精度或正式消防处置验收。
