# 安居云枢 · 居民端 MVP

微信原生 JavaScript / WXML / WXSS 小程序，Fastify + TypeScript 后端，SQLite 持久化。保留原有工程、AppID、工具私有配置和日志示例；原始 app 与首页模板在 `docs/original-template/`。当前目录未初始化 Git。

已实现 15 个设计对应业务页面、5 个辅助页面，原生四项底部导航；登录、住址、隐患及附件、设备、前台计时演练、结束总结、历史和统计使用同一 HTTP 数据源。演示模式也需要本地后端，业务记录真实落盘，网络失败不会伪造成功。

## 快速运行（Windows PowerShell）

需要 Node.js **22.13+**（建议当前 Node LTS），npm、微信开发者工具。已在 Node 25.8.2 / npm 11.11.1 下验证。SQLite 使用 Node 内置 `node:sqlite`，不需要安装数据库服务。

```powershell
cd D:\DevTools\wechat_devtools\WeChatProjects\miniprogram-1
npm install
Copy-Item server/.env.example server/.env
npm run db:init
npm run dev
```

已有 `.env` 时直接编辑，**不要用上述复制命令覆盖自己的配置**。客户端已提供非敏感的 `config/local.js`，示例可参考 `config/local.example.js`；无隐藏配置降级。默认监听 `http://127.0.0.1:3000/api`。另开终端验证：

```powershell
npm run check
npm test
npm run build
npm run smoke
```

`smoke` 只允许演示后端，会真实生成一条带联调说明的上报及一条演练，打印编号。正式环境不会运行该写入流程。没有拨号、告警发送或硬件控制操作。

编译后启动后端：`npm run build` → `npm start`。先停止 `npm run dev` 再启动，避免端口占用。

## 微信开发者工具导入

导入**当前工程根目录**，即包含 `app.json` 和 `project.config.json` 的 `miniprogram-1`，不是 `server`、`dist` 或 `pages`。`miniprogramRoot` 为 `./`。保留现有 AppID `wxaf6c63bb40d31109`，是否有该 AppID 的开发权限需在微信工具里验证。

- 小程序不依赖 npm 运行时包，无需在微信工具执行“构建 npm”。后端和 node_modules 等已排除在小程序打包范围之外。
- 工具基础库配置为现有 **3.17.3**；原生导航栏与 tabBar 处理系统状态栏、胶囊和底部安全区域，页面不重复绘制系统 UI。
- **仅本地联调**：工具“详情 → 本地设置”勾选“不校验合法域名、web-view、TLS 版本及 HTTPS 证书”。当前用户私有配置保留原样，其 `urlCheck=true`，需在工具中按实际环境切换。生产保持域名校验。
- 真机无法访问电脑的 `127.0.0.1`。将服务端 `HOST=0.0.0.0`，客户端 URL 改为电脑可达的局域网地址；正式部署使用配置过的 HTTPS 域名，并分别配置 request / uploadFile / downloadFile 域名。
- 如使用 CLI / 自动化，在工具的“设置 → 安全设置”中开启服务端口。当前环境 CLI 返回服务端口关闭，尚未进行模拟器或真机验收。

可独立调用本机**真实微信编译器**验证所有模板和样式：

```powershell
$env:WECHAT_DEVTOOLS_PATH = 'D:/DevTools/wechat_devtools/微信web开发者工具'
npm run check:wechat
```

`npm run verify` 汇总构建、自动测试、微信编译器与依赖审计，将真实输出写入 `artifacts/verification/`。需本机可用的微信编译器路径；普通 CI 可分别执行 `npm run build` 和 `npm test`。

这只能证明 WXML / WXSS 编译通过，不能代替模拟器运行、隐私授权或真机布局验收。

## 演示操作

1. 启动后端并进入小程序，首页显示“演示环境”标识；点击“我的 → 登录”。默认未勾选协议不能提交，协议文本单独可读。
2. 勾选后使用演示账户登录。首次登录无住址。进入“住址管理”，选择云栖花园、1号楼、1单元、**6层**，自行填写房号。保存后显示“待审核”，不显示已认证。
3. “隐患上报”选择类型、楼层，填写至少2字具体位置、至少5字描述及联系方式，可添加0–3张图片。成功页显示服务端生成编号，进入详情看到真实待处理时间线；在“我的上报”和统计中同步可见。
4. “楼栋 → 1号楼/1单元/6层 → 感知设备”有固定过期读数、离线且告警未解除的设备，以及没有通信/读数的设备；不会显示虚假正常。其他楼层可验证空状态。
5. “楼栋 → 开始线上演练”，确认安全出口后进入集合点，确认结束后查看实际时长、2个确认步骤、场景快照、结束时间和保存状态；“我的 → 演练记录”可回看。
6. “再次演练”创建新 ID；“稍后继续”暂停并保留；“中止”保存独立中止状态，不计完成次数。切后台暂停计时。结束前停掉后端可验证保存失败，再启动服务重试保存，ID 不变。
7. 退出登录后可继续访问紧急求助。测试时**不要拨打真实 119**；物业号码未核实配置时按钮禁用。未绑定住址可以手动补充并复制。

演示用户固定为 `resident-a`；接口测试通过 `resident-b` 验证跨账户隔离。不能在体验版/正式版使用演示入口；客户端和服务器都有模式检查。

## 数据与配置

- `config/index.js`：默认非敏感配置；`config/local.js`：本地覆盖。`mode: 'demo'` 为开发演示，`mode: 'api'` 为真实微信登录与正式数据。
- `server/.env`：只放服务端参数和微信凭据；模板为 `server/.env.example`。AppSecret、session_key 从不进入客户端或接口响应，业务 token 仅在客户端会话存储，数据库存 token 哈希。
- 默认库 `server/data/demo.sqlite` / `server/data/production.sqlite`；数据库模式元数据阻止混用。附件存于对应的 `.sqlite.uploads/`，由服务端 UUID 命名，不可直接静态访问。
- `npm run db:init` 可重复执行，只补缺失表和种子，不覆盖业务数据。演示种子只提供固定社区/楼栋/楼层、公告、设备读数和演示事件，不给新用户绑定住址。
- 明确重置：**停止后端**，确认当前模式为 demo，再执行 `npm run db:reset:demo`。仅允许默认的本地 demo.sqlite 及其附件目录；拒绝生产、自定义数据库路径。重置后在微信工具清理本项目缓存并重新登录，避免本地待提交内容指向旧记录。
- 全部时间为 ISO 8601 UTC，客户端按手机本地时区显示。详情与历史保存场景快照，后续修改楼栋资料不会改写历史。

## 真实接入配置

1. 服务端 `NODE_ENV=production`、`DATA_MODE=production`；独立正式数据库，客户端 `mode='api'` 和 HTTPS API URL。
2. 配置 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`。客户端 `wx.login` 的 code 交由服务端 `jscode2session` 换身份，随后生成独立业务 token。`wx.checkSession` 不替代业务会话校验。
3. 配置审核后的 `LEGAL_FILE`、`LEGAL_VERSION`、`LEGAL_APPROVED=true`；文件格式见 `docs/legal.example.json`。缺少审核文本时真实登录返回 `LEGAL_NOT_CONFIGURED`，不假成功。
4. 配置 `CATALOG_FILE`，参见 `docs/production-catalog.example.json`。模板为空目录，正式环境不会加载演示社区。运营方填写稳定社区、楼栋、单元、楼层及设备 ID 后重复初始化。
5. 物业电话需设置 `PROPERTY_PHONE`、`PROPERTY_PHONE_VERIFIED=true` 与 `PROPERTY_UPDATED_AT`；否则不可拨打。填写核实过的出口/集合点资料与平台隐私保护指引；演练页仍明确标记为线上认知。
6. 如接入硬件，登记实际设备并设置服务端专用 `DEVICE_INGEST_KEY`，按 [接口文档](docs/api.md) 推送事件。没有提供硬件控制接口，演练不向设备下发指令。

正式上线还需微信平台隐私声明、AppID 开发权限、合法域名与证书，以及业务方对协议、住址认证流程、联系方式和场景资料的确认。本轮未发布。

## 验证与设计依据

实际结果见 [实施记录](docs/implementation-progress.md)、[验收矩阵](docs/verification.md) 和 `artifacts/` 中的日志。5组自动测试覆盖 API、真实页面控制器与数据层、计时/重试/隔离；模拟微信 API 的控制器测试**不代表微信运行时已验收**。

Figma 文件连接要求重新认证，未获得设计节点截图；工作区没有设计总览 PNG。本轮按需求中的浅灰/深蓝/暖红/绿色、390×844 基准、卡片及线性图标说明实现。`assets/icons` 为本地绘制 PNG，**不是 Figma 导出资源**；尚未进行原稿视觉比对。小屏和安全区已有响应式规则，真实设备视觉验收仍待执行。

官方接口参考：[微信 API typings](https://github.com/wechat-miniprogram/api-typings)、[wx.login](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html)、[wx.chooseMedia](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.chooseMedia.html)、[隐私授权](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)。本环境官方文档网页抓取失败，已核对官方 typings 包中的接口签名与兼容版本，并使用本机微信编译器验证语法。
