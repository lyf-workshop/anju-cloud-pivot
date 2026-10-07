# 本地双端联调

> 网页恢复更新：网站默认显示原HTML/CSS与Mock交互。以下物业处理、审核等操作请从 `login.html` 进入独立的接口联调视图；该视图通过 `?mode=api` 显式选择，不再替换默认网页。居民小程序及后端不变。

本轮只在开发电脑运行，没有连接 SSH 主机、安装远程软件或部署生产服务。默认后端 Fastify + TypeScript + SQLite，网页和居民小程序读取同一份持久数据；保留原生小程序与原网页目录。

## 依赖和启动

Node.js ≥22.13（建议24 LTS）。本轮实际环境是 Windows PowerShell、Node.js 25.8.2、npm 11.11.1。不需要 Docker、PostgreSQL、微信密钥或云开发。

在仓库根目录执行：

```powershell
npm ci
# 可选：需要改变端口、密码、数据路径时再复制。不要覆盖已有 server/.env。
Copy-Item server/.env.example server/.env
npm run backend:db:init
npm run dev
```

默认没有 `.env` 也可启动；看到 `server/.env not found` 提示后仍会继续使用开发默认值。服务监听 `127.0.0.1:3000`，只供本机调试。`npm run dev` 有代码热重载。若启动失败先检查端口占用，不要强行结束其他项目进程。更改端口时同时更新客户端 API 地址与 `WEB_ORIGINS`。

默认网页打开 `http://127.0.0.1:3000/index.html`；物业接口联调打开 `http://127.0.0.1:3000/login.html`；API 健康检查 `http://127.0.0.1:3000/api/health`。

- 物业账号：`property-demo`
- 本地演示默认密码：`AnjuLocal2026!`
- 首次初始化可通过 `DEMO_STAFF_PASSWORD` 自定义。已有账号不会在重启时被覆盖或自动改密码。
- 默认账号只在 `DATA_MODE=demo` 且非 production 时种入；正式数据库没有此账号。

需要第二个物业账号或只读账号时，在忽略的 `server/.env` 中配置 `STAFF_USERNAME`、`STAFF_PASSWORD`（至少12字符）、`STAFF_NICKNAME`、`STAFF_COMMUNITY_ID`、`STAFF_ROLE=manager|operator|viewer`，执行 `npm run backend:staff:create`。该显式命令校验社区、不覆盖已有账号、不打印密码；执行后可以移除临时明文初始化密码。它也是未来正式账号的开通入口，正式环境须先配置真实社区目录。

编译后运行同一个后端：

```powershell
npm run backend:build
npm start
```

## 小程序连接

1. 执行 `npm run client:local`，设置 `config/index.js` 为 `local`、`http://127.0.0.1:3000/api`。
2. 微信开发者工具导入**仓库根目录**（包含 `app.json`、`project.config.json`），使用有开发权限的 AppID。本机基础库3.17.3。
3. 本地 HTTP 联调需在开发者工具「详情 → 本地设置」勾选“不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书”。本机现有私有配置已关闭 `urlCheck`；不要把此配置作为正式上线方式。
4. 编译小程序，勾选协议，点击“本地联调登录”。使用后端开发账户 `resident-a`，不调用真实 `wx.login`。可在非敏感配置中改为 `resident-b` 验证账户隔离。
5. 新用户先进入“我的 → 住址管理”，选择云栖花园、1号楼、1单元、6层，填写测试房号并保存。绑定初始为待审核，不自动套用示例住户。

API 模式下，会话和可恢复的上报草稿保存在按模式、后端地址、用户隔离的小程序本地存储。退出清理会话与私有缓存，数据库中的已保存记录不删除。设备/上报/演练需要绑定相应楼栋；本地 demo 允许待审核绑定，production 要求物业审核通过。

`127.0.0.1` 在手机上指手机本身，不能用于真机访问电脑。真机测试需显式绑定本地服务器到局域网地址，设置电脑局域网 API 地址和防火墙规则；本轮没有执行真机检查。正式体验/发布需要 HTTPS、合法域名与平台配置，开发登录在非 develop 小程序环境被阻止。

比赛真机演示可执行 `npm run client:remote-demo`，切换到现有 HTTPS 演示 API 和匿名设备会话；这种模式不调用 `/auth/dev-login`，无需电脑开放局域网端口，也不读取真实微信身份。它仍属于 demo 数据模式，只用于开发版真机调试和比赛演示。

## 推荐演示顺序

1. **居民上报**：小程序填写测试位置、描述和电话，最多3张图片；实际上传到本机后端。成功页、详情、我的上报和统计使用同一 ID。
2. **物业处理**：浏览器进入隐患工单，刷新找到刚才的编号；受理并填写处理说明，再标记完成。小程序详情刷新能看到对应状态和时间线。
3. **住址审核**：网页人员台账显示实际绑定，物业管理员填写审核理由；小程序“我的”刷新显示审核结果。未开发老人/儿童/健康档案采集，界面不再把旧硬编码人数当成实际台账。
4. **演练**：小程序楼栋 → 开始演练 → 确认出口 → 确认集合点 → 总结；我的演练记录可回看；网页值班台显示最近演练。再次演练生成新 ID，主动离开记为中止。
5. **物业日常**：网页登记巡查、安排值班、发布公告；刷新后保留，公告同步到小程序。巡查发现问题后可在工单中登记，本轮不自动生成重复工单。
6. **设备**：固定演示设备含离线、未知、过期读数与未解除事件。网页人工审核事件只记录处置，不修改原始告警，不向硬件发送指令。
7. **退出后求助**：小程序公共紧急求助、网页紧急联系方式无需有效会话；电话按钮只弹演示说明，不拨号。

## 数据与目录

| 路径 | 用途 |
|---|---|
| `server/src/app.ts` | 复用的居民 API、上传、设备事件、统一错误处理 |
| `server/src/staff.ts` | 物业账号、社区/角色权限、工单、审核、巡查、值班、公告 |
| `server/src/db.ts`、`migrations.ts` | SQLite 数据访问、基础目录种子、增量迁移 |
| `server/data/demo.sqlite` | 本地持久数据库，不进入 Git |
| `server/data/demo.sqlite.uploads/` | 经解码和重编码的私有附件，不作为网页静态资源公开 |
| `services/repository.js`、`api-repository.js` | 小程序统一入口与后端适配，无失败回退 |
| `services/showcase-repository.js`、`mock/` | 原离线展示数据和内存逻辑 |
| `安居云枢网页端(1)/textcursor/` | 保留的网页目录；`api.js` 请求适配，`connected.js` 渲染真实接口内容，复用原CSS与导航 |
| `config/index.js` | 客户端非敏感模式、API 地址、开发账户 |
| `server/.env.example` | 服务端配置模板；实际密钥仅放忽略的 `.env` |

默认网页由 `site.js` 加载原 `script.js`，保持原三栏值班台、CSS楼栋、台账、表单和模拟火情流程；数据均标为Mock，表单不上传、不写库，电话只提示。默认页面可以直接打开HTML或由普通静态服务器提供，原有外链监控示意图片已本地化。

需要真实本地数据时从 `login.html` 登录，进入 `index.html?mode=api`。此时才加载 `connected.css`、`api.js` 和 `connected.js`；导航、工单ID和刷新保持API模式。点击“返回原版网页”回到默认Mock页面。API视图仍必须由本地后端托管，接口失败不回退到Mock。HTTP接口说明见 [api.md](api.md)。

## 初始化、迁移和重置

`backend:db:init` 和正常启动可重复执行，增量迁移版本2，不清空既有用户、附件和业务记录；种子仅补充缺失的固定社区资料。默认不会替你创建已处理工单或演练记录，联调写入的记录会长期保留，直到显式重置。

需要从干净演示数据开始时，先 Ctrl+C 停止本地后端，再执行：

```powershell
npm run backend:db:reset
npm run dev
```

此命令显式清空默认 `server/data/demo.sqlite` 及其附件目录，只允许开发 demo 和该固定路径，不允许删除自定义/生产数据库。重置后重新登录；若小程序仍有旧ID的草稿，可退出清理本机私有缓存。备份数据库时先停止服务，再复制数据库及上传目录，避免只复制正在使用的SQLite主文件而遗漏 WAL。

## 模式切换与失败行为

```powershell
npm run client:showcase   # 原离线展示，不需要启动后端
npm run client:local      # 当前默认，本机后端 + 持久demo数据
node scripts/client-mode.cjs api https://你的域名/api
```

每次切换需重新编译小程序。`api` 对应后端 `DATA_MODE=production`，真实微信接口需要密钥和经过审核的协议；缺少配置会报错，不模拟登录成功。本轮未验证正式微信身份交换或正式数据环境。模式、后端地址不匹配返回错误，绝不静默加载离线示例。

上报提交遇到响应丢失，会先按原幂等键查询已创建记录，上传成功的附件ID保留用于重试。演练累计前台时长、隐藏暂停、本机检查点和结束待提交数据均保留；服务端确认完成后才显示已保存。清缓存或退出会清除尚未同步的本地内容，因此待保存时应先重试。

## 检查命令

```powershell
npm run check             # 小程序路由、语法、资源
npm test                  # 显式使用showcase适配的原离线流程
npm run backend:build     # TypeScript构建
npm run backend:test      # 隔离临时数据库：权限/幂等/时长/上传/持久化等
npm run backend:smoke     # 已启动后端上的真实HTTP；向demo写入标记的测试记录
npm run check:wechat      # 本机微信WXML/WXSS编译器
```

`backend:smoke` 默认使用 resident-b 和物业开发账号，写入标记为“HTTP冒烟”的上报与演练，不运行真实电话或硬件控制。设置 `API_BASE_URL` 可改变本地后端地址，`DEMO_STAFF_PASSWORD` 可使用自定义开发密码；检测到 production 会拒绝执行。

微信模拟器自动化需另行安装验收工具并开启开发者工具服务端口：

```powershell
npm install --prefix artifacts/devtools-runner --no-package-lock --no-audit --no-fund miniprogram-automator
& 'D:\DevTools\wechat_devtools\微信web开发者工具\cli.bat' auto --project (Get-Location).Path --auto-port 9420
node scripts/verify-connected-devtools.cjs
```

脚本只对本地 demo 执行，使用页面方法和 wx 导航，在真实微信模拟器中运行；关闭系统电话调用，截图先保存在临时目录，断开自动化后归档。运行时避免同时修改项目文件触发热重载。构建、接口测试、浏览器、微信模拟器和真机结论分别记录在 [verification.md](verification.md)。

## 本轮边界

- 已有真实微信登录服务端接入点，但本轮只使用开发登录，未验证微信凭据。
- 未接入真实硬件、摄像头/YOLO、自动疏散、订阅消息或真实告警。
- 尚未做服务器部署、HTTPS、域名配置、生产备份和恢复演练；正式物业账号须用上述显式命令在真实社区范围内开通，不能使用默认演示账号。
- 本地版本使用SQLite，不要求另装数据库。正式改用PostgreSQL需要迁移SQL/事务/驱动并回归验证，不能仅替换连接字符串。

## 实施参考

- [Node.js SQLite官方说明](https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html)：22.13起不再需要实验启动参数，本项目使用DatabaseSync；实际构建和测试环境为25.8.2。
- [Fastify Cookie插件](https://github.com/fastify/fastify-cookie)：核对Fastify 5兼容版本和Cookie注册时序，插件注册在读取Cookie的钩子之前。
- 微信[网络说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)和[wx.request](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html)本轮网页抓取不可用；因此没有声称已在线核对最新正文。接口另由已安装微信基础库3.17.3和真实模拟器HTTP流程验证，正式上线仍需核对平台合法域名配置。
