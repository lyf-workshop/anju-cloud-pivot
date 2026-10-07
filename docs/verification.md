# 当前验证：队友智能体合并与三端 1.4.0（2026-10-07）

- 在独立集成分支上选择性合并队友新增的居民安全助手、物业处置智能体与模型适配层；保留当前根目录原生小程序、住户登记流程、正式 AppID 配置、共享安装版和既有网页。没有复制队友旧包中假定 `mobile/website` 目录的构建配置。
- 原生小程序现为五个一级标签，新增“助手”页；`npm run check`、`npm test`、`npm run check:wechat` 全部通过，WCC 编译 34 个文件、WCSC 编译 37 个文件。后端构建通过，自动测试 13/13 通过，覆盖居民会话鉴权、物业社区范围、只生成待确认草稿和不自动写工单。
- 共享前端在 390×844 生产构建预览中完成“直接体验 → 登记可跳过 → 助手 → 风险卡 → 去上报 → 草稿预填”，在 1366×768 验证桌面侧栏与助手布局。手机截图见 [助手页面](../output/playwright/assistant-mobile-production.png)，桌面截图见 [Windows 布局](../output/playwright/assistant-windows-production.png)。
- 当前版本已发布到 `/opt/anju-cloud-pivot/releases/20261007-nav-v16`；公网健康、助手网页均为 200，居民/物业助手未登录均为 401。公网真实烟雾测试通过匿名会话恢复与隔离、助手 `obstruction` 草稿、上报 `AJ20261007-CDBB630D`、两步演练完成和历史读回。物业登录、智能体状态和对话均为 200；当前未配置外部模型密钥，明确返回 `local-fallback`，不会自动处理工单。
- 网页值班台在 1440×900 与 390×844 两种视口完成真实 Chromium 复验：桌面改为主监控、侧栏状态、底部资源卡结构；手机按主监控、状态、资源顺序纵向排列。两种视口均无横向溢出，移动菜单、恢复正常监控和火情处置弹窗可用，控制台 0 错误；公网截图为 `output/playwright/deployed-web-clarity-desktop.png` 与 `output/playwright/deployed-web-clarity-mobile.png`。
- 物业网页共 10 页，已统一为值班台、基础治理、巡查整改、处置支持、物业登录和紧急处置 6 个顶层操作；3 个业务分组支持互斥展开、当前页面标记、点击外部及 Esc 关闭。公网 10 页均返回 200；1440×900 下拉菜单与 390×844 折叠菜单通过真实 Chromium 操作，手机无横向溢出、控制台 0 错误。
- Windows 1.4.0 NSIS 实际安装退出码 0，已安装 EXE FileVersion 为 1.4.0。全新隔离用户数据实测登记、助手草稿预填、设备、图片上报 `AJ20261007-69E3F8A0`、个人记录、两步演练、关闭重开和历史恢复，控制台错误 0。
- Android 1.4.0 release APK 在 API 36 / Android 16 模拟器卸载旧版后全新安装；包名 `com.anjuyunshu.judge`、versionCode 5、versionName 1.4.0、minSdk 24、targetSdk 36。助手草稿、系统 Photo Picker、服务器上报 `AJ20261007-2130CE43`、演练及强制停止重开恢复全部通过，控制台错误 0。
- Android v2/v3 签名有效，证书 SHA-256 为 `225CE809425D1911115E84C923E149E34B4A01A40491BE79A2043F6372398601`。APK SHA-256 `135B0C630D08F95A6A9698F215EC9AE01D6064929FDD8B338814D37CABAC0131`，大小 10,619,555 bytes；Windows 安装包 SHA-256 `0E94D3CC9600F932B781364B3B2DB9D71837475942B9C108A3285903E8112A0D`，大小 126,795,899 bytes。
- 受控下载区已发布 1.4.0；服务器端校验两项 SHA-256，未授权 401、授权索引 200、两个安装包分段请求 206。旧 1.3.0 已移到站点外归档；Caddy 配置、数据库/附件、备份 timer、树莓派服务和其他站点未覆盖。

---

# 网页成员版合并验证（2026-09-29）

- 合并来源为根目录 `安居云枢网页端(2).zip`，SHA-256 `96DF6B1D906FDBE48103862241C4AAA5FEE73FF32274AADAA4402B9C0D07A129`；合并前网页完整备份在 `artifacts/member-web-merge-20260929/premerge-current-web/`。
- 成员版 8 个默认页面和物业登录页均通过本地 Fastify 静态服务返回 200。真实 Chromium 逐页打开值班台、制度责任、数字孪生、人员台账、巡查台账、处置预案、隐患工单与紧急处置，最终控制台 0 错误、0 警告。
- 首页摄像头未登录时显示受控访问和登录入口，不暴露实时帧；成员 Mock 视频不会在摄像头鉴权期间自动下载。MP4 与 favicon 静态响应均为 200，静态资源不消耗 API 共享限流额度。
- 隐患表单实测空提交提示必填错误，补齐位置、类型、描述和电话后显示明确的“本地演示、未上传服务器”成功提示；首页“处理火情”弹窗可打开并显示误报/火情分支。
- 本地物业登录成功后可以进入 `index.html?mode=api`，接口工作台读取统计、设备、公告与工单，控制台 0 错误。本机未配置摄像头接入密钥，因此登录后的本地实时画面按预期显示离线；公网树莓派服务未在本次前端合并中改动。
- `npm run backend:build` 通过，`npm run backend:test` 11/11 通过；成员 121 MB 演示 MP4 使用 Git LFS，避免 GitHub 普通对象的 100 MB 单文件限制。合并后截图为 [成员版首页](../output/playwright/member-web-home-merged.png)。
- 公网已切换到 `/opt/anju-cloud-pivot/releases/20260929-member-web-v1`，旧版 `20260929-judge-app-v1` 保留。成员版 8 个页面、物业登录页和 `/api/health` 均返回 200；演示 MP4 的字节范围请求返回 206，长度与本地文件一致（120,721,541 bytes）。
- 真实 Chromium 打开公网值班台并通过导航进入“制度责任”，页面标题与正文正常，控制台 0 错误。截图为 [公网成员版首页](../output/playwright/deployed-member-home-20260929.png)。
- 公网物业登录返回 200；登录后的摄像头访问探测与状态接口返回 200，树莓派在线，最新帧返回 640×480 JPEG。样本元数据明确为 `source=raspberry-pi-yolo-demo`、`isTest=true`；树莓派 `anju-camera-agent.service` 保持 active、`NRestarts=0`，本次未改采集端、模型或密钥。

---

# 当前验证：补齐登录后住户登记流程 1.3.0（2026-09-30）

- 共用 Windows / Android 前端已按队友小程序补入“人口登记 → 家庭成员情况 → 登记完成 → 首页”。单元、楼层、房号和家庭人数由匿名演示会话预填并明确标成演示资料；第二步可跳过，顶部也可直接进入首页，不要求评委填写真实个人信息。
- 390×844 真实 Chromium 从全新存储点击“直接体验”，逐项通过登记第一页、隐私说明、第二步、服务器保存、完成页、首页和刷新恢复；页面 `scrollWidth <= innerWidth`，控制台错误 0。截图为 [手机登记第二步](../output/playwright/onboarding-step2-mobile-1.3.0.png)。
- Windows 1.3.0 NSIS 实际安装退出码 0，已安装 EXE 的 FileVersion 为 1.3.0；全新独立用户数据实测登记、设备、图片上报、个人记录、两步演练、总结、关闭重开和历史恢复全部通过，控制台错误 0。
- Android 1.3.0 release APK 在 API 36 / Android 16 模拟器卸载旧版后全新安装，包名 `com.anjuyunshu.judge`、versionCode 4、versionName 1.3.0。完整流程通过，包含系统 Photo Picker、服务器上报 `AJ20260930-450F8809`、两步演练、强制停止重开及历史恢复，控制台错误 0。
- Android APK 的 v2/v3 签名有效，证书 SHA-256 仍为 `225CE809425D1911115E84C923E149E34B4A01A40491BE79A2043F6372398601`。APK SHA-256 `6B9D9AA05CF072F030FAF1FBE7E2EBBFFDD0CBA2A8486D3621A1928804CC0CB7`，大小 10,614,656 bytes；Windows 安装包 SHA-256 `D7185B05FADA31EF5D04B3045B8918B739635923911C0BF7341290F2B97DF662`，大小 126,792,029 bytes。
- `npm run check`、`npm run check:wechat` 和后端测试 11/11 全部通过。后端 API 与数据结构本轮无需迁移，继续使用已部署的匿名会话、绑定、上报、附件、演练和历史接口。
- 受控下载区已发布 1.3.0；服务器端再次校验两项 SHA-256，未授权首页为 401、授权首页 200、Windows/Android 分段请求均为 206。旧 1.2.0 文件已移到下载根目录外归档；API、Caddy、备份 timer 和原 `codetether.org` 站点继续正常，后端 release 未切换。

---

# 当前验证：手机优先 1.2.0、Windows、Android 与公网匿名会话（2026-09-30）

本轮 1.2.0 在小程序同款蓝色视觉上按 360–430dp 手机画布重新排版：首页首屏、双列隐患示例、18 层楼栋与楼层轨道、个人中心、表单、安全区和底部导航均压缩为手机信息密度；桌面端继续使用同一业务前端和侧栏。首页及顶部现在显示真实演示服务器同步状态与时间，仍保留无需账号的匿名体验入口。

- Playwright 分别以 360×800、390×844、430×932 检查首页、上报、隐患双列、楼栋和个人页，均无横向溢出；430dp 底部导航触控高度 59px，控制台错误 0。安装 APK 的实际设备画面见 [手机首页](../output/android-verification/installed-home-device-1.2.0.png) 和 [18层楼栋](../output/android-verification/installed-building-device-1.2.0.png)。

## 公网后端

- `npm run app:smoke` 直接访问 `https://xn--9kqy92aeqav77a.com/api`，通过匿名会话首次创建、相同安装键恢复、不同安装键隔离、上报读回、两步演练完成和历史读回。1.2.0 复测样本上报编号为 `AJ20260930-9220034B`；`/api/health` 返回 `status=ok, mode=demo`。
- 当前 release `/opt/anju-cloud-pivot/releases/20260930-mobile-v12`；`anju-cloud-pivot.service`、Caddy 与每日备份 timer 均为 active，服务 `NRestarts=0`。新 `/api/app/bootstrap` 的鉴权测试、聚合数据测试和公网 200 响应通过，未登录为 401。
- 后端自动测试 11/11 通过；匿名会话恢复、跨会话私有记录隔离、数据库重开后持久化、非 demo 拒绝入口、精确 CORS 与启动聚合数据均有覆盖。

## Windows 安装包

- 实际安装 `output/installers/windows/安居云枢-Windows-1.2.0-Setup.exe`，安装程序退出码 0；安装后 EXE 位于当前用户 LocalAppData Programs 目录。
- 自动化驱动的是已安装 Electron EXE，不是 Vite/浏览器预览：设备页、JPEG 选择/上传、服务器生成上报编号、个人历史、两步演练、总结、关闭并重新启动后的历史恢复均通过，控制台错误 0。证据：[安装版历史截图](../output/playwright/windows-installed-history.png)。
- 使用独立全新 Windows 用户数据目录启动已安装 EXE，确实显示并点击“直接体验”；关闭后以同一目录重启，DPAPI 保险库自动恢复会话，`directEntryObserved=true`、控制台错误 0。
- SHA-256 `7F4414878B80E1BF66A5AFAF9D99DE7C5CD6734BE1933BE37FBFC245FF9D5745`，大小 126,840,322 bytes。当前未配置 Authenticode 证书；可能出现 SmartScreen 提示，未声称已代码签名。

## Android APK

- 使用 API 36 Android 16 Pixel 6 x86_64 模拟器，WHPX 硬件加速。执行的是 release APK 的 streamed install，包名 `com.anjuyunshu.judge`、versionCode 3、versionName 1.2.0、minSdk 24、target/compile 36。
- 从清除应用数据后的全新启动开始，已跑通“直接体验 → 楼栋设备 → 图片隐患上报 → 刚提交记录 → 两步演练 → 总结 → `am force-stop` → 重启 → 同一历史”。最终上报编号 `AJ20260930-657894A0`，原生安全区和底部导航显示正常，控制台错误 0。证据：[WebView 历史截图](../output/android-verification/installed-history.png)、[完整设备截图](../output/android-verification/installed-history-device.png)。
- 最终 1.2.0 APK 实际点击图片输入并打开 Android 系统 Photo Picker，自动检查当前系统窗口为 Photo Picker；按系统返回键回到原表单后继续完成上传。证据：[1.2.0 系统图片选择器](../output/android-verification/image-picker-open-1.2.0.png)。
- `apksigner` 校验 v2/v3 签名有效，RSA 3072 位，证书 SHA-256 `225CE809425D1911115E84C923E149E34B4A01A40491BE79A2043F6372398601`。APK SHA-256 `32620305F0DF45405FF5E8AD2ABCEFC0504B2227C5921D3A6C8286CF60A212D3`，大小 10,610,495 bytes。

## 仍然明确的边界

- Android 本轮是正式安装 APK 的模拟器验证，不冒充实体手机验证；不同厂商的侧载策略仍可能不同。Windows 与 Android 均未上架应用商店。
- 没有触发真实电话、告警、派单或硬件控制。设备、告警、楼栋、住址和集合点均为演示资料。
- Windows 没有商业代码签名证书；Android 发布密钥只在本机构建用户目录，尚需由项目方做离线加密备份。

---

# 历史：树莓派实时视频与 YOLO 部署（2026-09-29）

- 树莓派实际识别为 Raspberry Pi 5 / 8 GB，CSI 摄像头为 IMX219；`rpicam` 取帧成功，`Picamera2`、Ultralytics、OpenCV 和 ONNX Runtime 可用。现有 ONNX 权重类别实际为 `0=smoke,1=fire`，SHA-256 已记录在摄像头文档。随模型样本离线推理得到 `smoke=0.7636/0.3874`，证明模型可执行，但不作为精度验收；[标注结果](../output/raspberry-pi/yolo-sample-detected.jpg)。
- 树莓派 `anju-camera-agent.service` 已启用并保持 `active`，`NRestarts=0`。实际链路为 640×480、约 4 FPS；公网状态样本的 ONNX 推理耗时约 63–88 ms。服务器与树莓派分别保存同一独立接入密钥，仓库、HTTP 响应和日志不含密钥。
- 现场摄像头倒装问题已在采集端配置 `CAMERA_ROTATION=180` 修复，旋转在推理前完成。服务日志确认以 `rotation=180` 启动；从公网受保护接口重新取得的 640×480 JPEG 经人工检查方向正确，检测文字位于画面底部。证据为 [旋转后的实时帧](../output/raspberry-pi/rotated-live-frame.jpg)。
- 修复 Picamera2 `RGB888` 已按 BGR 数组输出却被重复执行 `RGB→BGR` 的通道交换问题。重新部署后，受保护接口返回 200、摄像头在线、推理状态正常；实际帧中肤色及蓝/棕衣物色相恢复。证据为 [颜色校正后的实时帧](../output/raspberry-pi/color-corrected-live-frame.jpg)。剩余轻微青绿色和高光过曝属于当前室内混合光线下的自动白平衡/曝光效果。
- 本地 `npm run backend:build` 通过；`npm run backend:test` 11/11 通过。摄像头用例覆盖无密钥拒绝、非法 JPEG、重复/乱序帧、重新启动序列、未登录隔离、物业 Cookie 访问、单帧读取和浏览器无凭据访问状态。
- 公网接口实测：未登录私有状态 401、物业登录 200、状态 200、JPEG 200，响应为 640×480 JPEG；实时元数据含模型 SHA、测试来源、采集/接收时间、阈值和检测状态。服务当前运行 release 为 `/opt/anju-cloud-pivot/releases/20260929-camera-yolo-r4`。
- Playwright 真实 Chrome 实测：未登录等待 6 秒控制台 0 错误；加载物业会话后显示 `LIVE`、模型名、推理耗时和测试来源，MJPEG `<img>` 的 `naturalWidth/naturalHeight` 为 640×480，控制台 0 错误。证据为 [实时值班台截图](../output/playwright/raspberry-live-dashboard-final.png)。
- 保持 MJPEG 客户端打开时执行 systemd 重启，停止/启动切换在同一秒完成，脚本记录 `restart_with_open_stream_seconds=0`，健康接口随后返回 200；树莓派在切换窗口收到短暂 502 并自动恢复上传。
- 没有测试或触发真实电话、告警、派单与硬件控制。模型只显示“疑似、待人工复核”。当前现场画面明显偏暗，模型权重来源与准确率尚未独立验证；这两项不属于已通过验收的能力。小程序真机和正式微信登录本轮未复测。

---

# 历史：首次公网演示部署（2026-09-29）

- 本地 `npm run backend:build`、`npm run backend:test` 和 `npm run check` 均通过；接口测试 7/7，新增用例检查公网演示禁用居民开发登录和物业 `Secure` Cookie。生产依赖 `npm audit --omit=dev --audit-level=moderate` 最终为 0 项漏洞，服务器已安装 `@fastify/static@10.1.5`。
- `us-vps-01` 的 `anju-cloud-pivot.service` 运行中；独立监听 `127.0.0.1:3101`。Caddy 为 `xn--9kqy92aeqav77a.com` 提供已通过证书校验的 HTTPS。域名首页跳转到 `/index.html`，首页、配置、健康接口和静态图片正常返回；原有 `codetether.org` 仍返回 200。
- 远端 HTTP 冒烟：物业演示账号登录 200、带 Cookie 读取当前用户 200、居民开发登录 403。浏览器实际打开新域名首页，标题和三栏 Mock 页面可见，控制台无错误；点击“模拟发现火情”显示“未发送告警”的演示提示。
- 真实浏览器截图：[公网首页](../artifacts/deployment/public-home.png)、[物业登录](../artifacts/deployment/public-login.png)。登录截图未包含密码。
- 未执行小程序真机/微信正式登录或树莓派摄像头推流验收；静态摄像头图不是直播。部署细节见 [deployment.md](deployment.md)，摄像头方案见 [raspberry-pi-camera.md](raspberry-pi-camera.md)。

以下为此前本地网页还原和接口联调验证记录，其中“未操作服务器”仅描述当时。

---

# 历史：恢复网站原界面（2026-09-29）

按用户最新要求恢复原版网页外观，未重建UI。原HTML/CSS和 `script.js` 恢复为默认入口；后端、数据库和小程序保留。显式打开 `login.html` 或 `?mode=api` 才进入接口联调视图，默认页面不会整页替换为API表格。

## 本轮实际检查

- **代码/资源**：`site.js`、`script.js`、`connected.js`语法检查通过；9个HTML文件的本地引用存在，8个原页面不直接加载API脚本和样式；`git diff --check`通过。
- **桌面浏览器**：1440×900实际打开首页、制度责任、楼栋、人员、巡查、预案、上报、紧急页面，均返回200、正文可见。浏览器对 `/api/*` 临时设置拒绝请求规则期间，这8页仍可展示，实际API请求0次、脚本异常0次、资源加载失败0次，无页面横向溢出。
- **原版交互**：模拟发现火情→处理弹窗→判定误报正常；2号楼+特殊人群筛选后显示3条Mock记录；空上报有校验，填写后显示“模拟提交完成，未通知物业/未写入工单”，实际API请求0次。
- **窄屏浏览器**：390×844检查首页及菜单，文档宽375px（另15px为桌面浏览器滚动条）；菜单可打开并跳至紧急页面。点击119卡片仅出现Mock提示，没有实际拨号。
- **保留的API入口**：物业登录进入 `index.html?mode=api`，导航进入工单、打开记录、刷新仍保留同一ID与API模式；点击“返回原版网页”后确认三栏首页显示、不加载API渲染器、API请求0次。
- 原来两张外链图片已按原地址保存到本地（JPEG，1400×933），没有替换画面内容。默认界面不依赖第三方图片网络。

证据：[本轮结构化结果](../output/playwright/restored-results.json)、[逐页浏览器原始输出](../output/playwright/restored-page-checks.txt)。截图：[原三栏首页](../output/playwright/restored-index.png)、[楼栋](../output/playwright/restored-buildings.png)、[人员筛选](../output/playwright/restored-people-filter.png)、[Mock上报结果](../output/playwright/restored-report-result.png)、[窄屏菜单](../output/playwright/restored-mobile-menu.png)、[可选API详情](../output/playwright/restored-api-optional.png)。

默认网页的台账、统计、监控、火情和上报均为Mock；这些数字不是业务数据库读数。真实本地数据仍在接口工作台和小程序中。没有清空数据库，没有修改小程序业务，也没有操作远程服务器。本轮仅浏览器验证，没有重新执行微信模拟器或真机验收。

---

# 历史：上一轮双端后端交付

以下结果保留供追溯，其中API页面现在需要 `?mode=api`，不描述网站默认展示。

# 双端本地后端验证（2026-09-29）

本轮按“先完成后端并在本地调试”的要求执行。居民小程序和物业网页共用本机 Fastify / TypeScript / SQLite；未连接或修改远程服务器。下面的历史展示版结果不作为本轮 API 验收依据。

## 实际完成的检查

| 层级 | 本轮结果 | 范围与限制 |
|---|---|---|
| TypeScript | `npm run backend:build` 通过 | 包含服务端与测试文件；已修复 CommonJS 测试中的 `import.meta` 编译不兼容 |
| 接口及客户端适配 | `npm run backend:test`：6项综合测试全部通过 | 隔离临时数据库；权限、上传、幂等、失败重试、演练、持久化、物业账号开通 |
| 小程序静态检查 | `npm run check` 通过 | 21条路由、45个JS文件、47个资源引用；不是渲染验收 |
| 原离线模式回归 | `npm test` 通过 | 显式选择showcase，20个产品页，0网络请求、0实际拨号；与API测试分开 |
| 微信离线编译 | `npm run check:wechat` 通过 | wcc：28个WXML；wcsc：31个WXSS |
| 真实HTTP | `npm run backend:smoke` 通过 | 访问本机3000端口，居民上报→物业受理/完成→居民回读→演练历史；写入标记的demo数据 |
| 桌面浏览器 | **已执行 Playwright CLI 实际浏览器检查** | 登录、图片上报、处理工单、巡查登记、列表、退出和公共求助；7张截图 |
| 微信模拟器 | **已执行**，7组流程通过、未收到异常事件 | 基础库3.17.3，iPhone 12/13 (Pro)，390×844，底部安全区34px；13张截图 |
| 真机 / 小屏 / 原生输入 | **未执行本轮验收** | 真机触控、系统相册/拍照授权、软键盘、320×568仍需人工检查 |

## 业务正确性

- 未勾选协议不请求登录；网络失败不建立登录状态。local / api 请求失败均不回退到离线数据。
- 上报和附件归属按当前用户判断；居民无法读取另一居民的私有记录。物业只能访问授权社区及已关联工单的图片，不能读取未关联附件；只读角色不能处理工单。
- Cookie 会话、同源写入检查、错误密码、社区越权、开发登录禁用、正式环境不种入物业默认账号均有接口断言。
- 上报响应丢失后按稳定幂等键查询原记录；已成功上传的图片不重复上传。物业处理有版本检查、幂等键和实际事件时间线。
- 演练确认步骤后才推进；前台累计时长不含后台时间，重复结束和失败重试不重复生成记录；中止与完成状态互斥。
- 关闭并重新打开测试后端，原会话、工单、巡查等记录仍存在；列表、详情和统计来自同一数据库。
- 设备离线、未知和过期读数明确展示；人工事件处置不修改设备原始告警。没有调用真实硬件或真实电话。

## 实际运行流程和证据

微信模拟器使用 `Page.callMethod`、页面事件处理器和 `wx` 导航驱动，页面渲染和网络请求在真实微信环境执行，不等同于手指点击验收。

- 协议默认未勾选阻止登录，勾选后本地登录；显式绑定住址，初始待审核。
- 首页、隐患、楼栋、我的四页读取本地API。
- 小程序创建工单，结果和详情使用同一ID；用物业HTTP接口受理后，小程序重新加载看到真实处理时间线。
- 两步演练确认后保存动态时长和2/2总结；历史可打开同一总结，返回楼栋正常；再次演练生成新ID，中途退出记为中止。
- 退出后仍可进入公共求助，消防按钮只显示演示弹窗。

[模拟器结果与13张截图清单](../artifacts/connected-devtools/results.json)，代表截图：[上报结果](../artifacts/connected-devtools/05-report-result.png)、[物业处理回读](../artifacts/connected-devtools/06-property-progress.png)、[演练保存](../artifacts/connected-devtools/09-drill-saved.png)、[历史](../artifacts/connected-devtools/10-drill-history.png)。

浏览器通过实际表单填写/点击和文件选择器上传本地PNG，生成 `AJ20260929-B70F3670`，受理后完成；另登记一条标记为“浏览器巡查”的记录。登录、人员台账、楼栋设备、值班、处置预案和紧急页面均实际打开；网页退出后公共求助仍可访问。值班创建、住址审核、公告发布和事件处置主要由API测试验证，本轮没有把它们全部算作浏览器点击验收。

[浏览器检查清单](../output/playwright/results.json)，截图：[工单受理](../output/playwright/report-processing.png)、[完成](../output/playwright/report-completed.png)、[巡查保存](../output/playwright/inspection-saved.png)、[工作台](../output/playwright/overview.png)、[退出后的公共求助](../output/playwright/public-emergency.png)。修复原首页固定一屏导致不能滚动的问题、遮挡表格的重复悬浮按钮，以及缺失的favicon和微型站背景图引用；鼠标滚轮后scrollTop=1571，1280px视口与文档等宽，无横向页面溢出，见[滚动截图](../output/playwright/overview-scroll.png)；楼栋页修复后控制台0错误。创建前幂等查询的404、未登录探测的401属于已处理的接口结果，不据此声称整个会话零失败请求。

真实HTTP冒烟记录：上报 `8b81f951-e779-49fe-9ee8-9c38e6cc143c`，演练 `23f97529-2964-4a68-9986-7807cbccaa72`。这些记录以及模拟器/浏览器写入保存在开发数据库中，未清空原有数据。综合结果见 [本轮验证摘要](../artifacts/connected-backend/results.json)。

## 待验证和配置

1. 真机访问须配置开发电脑局域网地址和防火墙；手机上的127.0.0.1不是电脑。当前只监听本机回环地址。
2. 微信真实身份交换、正式AppID/AppSecret、HTTPS域名、正式协议、真实物业电话和硬件均未联通或验收；不影响本地开发登录。
3. 没有执行远程部署、生产备份恢复或生产容量测试。用户要求本轮不操作服务器。
4. 还未提供员工管理界面、排班冲突检测、通知推送、自动生成巡查工单；物业账号可用显式CLI开通，详见本地联调说明。

---

# 历史记录：V1.1纯本地展示版（2026-09-28）

以下为前一轮独立验收，保留供追溯；其中“无数据库/网络”的描述只适用于showcase模式。

# V1.1 本地展示版检查记录

本轮实际读取 [设计总览](design/安居云枢_小程序设计总览.png)，并对照微信模拟器截图修正页面。没有新增服务器、数据库、真实登录或硬件连接。

## 结果分层

| 层级 | 实际结果与范围 |
|---|---|
| 代码检查 | `npm run verify`通过；21条注册路由（20个产品页面+保留的logs页）、43个JS文件、引用的本地资源检查通过 |
| 离线微信编译 | 真实wcc通过28个WXML，wcsc通过31个WXSS（包含新拆分的两个共享样式文件） |
| 本地控制器冒烟 | 登录、上报、筛选、设备、演练、历史记录、退出；0网络请求、0实际拨号 |
| 微信模拟器运行 | **已执行**。微信基础库3.17.3，iPhone 12/13 (Pro)，390×844，底部安全区34px。15个核心页面有实际运行截图 |
| 模拟器流程驱动方式 | 页面方法、组件方法、视图事件及wx导航在真实小程序运行环境中执行；不将其等同于手指点击。SDK的Element.tap/Native.switchTab未可靠触发预期控件行为，另行记录为未验证 |
| 小屏模拟器 | 尚未执行320×568检查；已请用户切换机型，本轮取得的实际机型仍为390×844 |
| 真机 | **未执行**。真实触控命中、系统相册/拍照授权及软键盘仍待人工检查 |

## 模拟器已跑通的流程

- 协议默认未勾选，提交处理器不执行登录；勾选状态后按钮变绿，演示登录进入首页。
- `wx.switchTab`切换四个主页面，原生底部导航选中状态随页面更新。
- 社区隐患打开对应详情；`wx.navigateBack`返回社区列表。
- 输入隐患位置、描述和联系方式后生成本地记录；结果、详情、我的上报使用同一记录ID与内容。
- 楼栋 → 安全出口 → 集合点 → 演练总结；显示本次计算出的时长与2/2步骤。
- 总结返回楼栋；历史列表打开对应总结；再次演练生成独立ID。
- 楼栋进入当前楼层设备页；消防入口弹出实际的“消防电话演示”对话框。
- 首页、上报、我的上报、演练总结滚动到页面末尾，表单末项与列表末项能够滚动到固定按钮上方。
- 本次运行未收到小程序异常事件。物业按钮同样只弹演示提示，已由本地冒烟检查；未进行真实电话拨号。

## 视觉修复

| 页面 | 对照总览所做调整 |
|---|---|
| 登录 | 深蓝品牌图标、等距楼栋插图、欢迎文案层级、绿色登录按钮、单组协议排布；修复按钮被微信默认样式缩窄 |
| 首页 | 深蓝横幅、六宫格服务、公告条、绿色安全提示和物业入口；未开放服务保留简洁说明弹窗 |
| 社区隐患 / 我的上报 | 图文缩略卡片、状态筛选、状态标签与进度入口；列表与本次提交数据仍一致 |
| 楼栋安全 | 本地等距插图、楼层选择条、楼层状态统计、并排演练/求助按钮；全部明确为示例 |
| 我的 | 深蓝头像、示例住址、三项上报统计、分组入口与退出位置 |
| 隐患上报 | 类型选项、可展开的楼层选择、图片区域、描述计数和底部提交；修复计数/说明贴在字段标题上的排布 |
| 演练 / 集合点 | 楼层示意、深蓝步骤说明、十字道路与集合点示意、确认清单、底部步骤按钮 |
| 总结 / 演练记录 | 紧凑时长卡片、步骤明细、场景与结束时间、底部双按钮、绿色历史统计与记录卡片 |
| 设备 / 结果 / 详情 | 统一字体、间距、卡片与状态展示，保留演示提示及当前记录ID |

原图中的住户、次数、时间等示例文案没有替代现有动态数据。插图为依据总览绘制的本地矢量风格素材，非Figma原始导出；未声称逐像素相同。顶部标题位置遵循微信原生导航，系统状态栏、胶囊和手势条没有重复绘制。

## 验证证据

- [模拟器流程结果](../artifacts/visual-v11/results.json)：运行设备、9组检查、异常列表及19张截图路径。
- [滚动检查结果](../artifacts/visual-v11/scroll/results.json)：4张页面末尾截图。
- [触控自动化限制](../artifacts/visual-v11/actual-taps.json)：SDK原生点击尝试不计为通过。
- [代码与离线编译](../artifacts/showcase/results.json)。
- 代表截图：[未勾选登录](../artifacts/visual-v11/01-login-unchecked.png)、[勾选登录](../artifacts/visual-v11/02-login-checked.png)、[首页](../artifacts/visual-v11/03-home.png)、[隐患](../artifacts/visual-v11/04-hazards.png)、[楼栋](../artifacts/visual-v11/06-building.png)、[我的](../artifacts/visual-v11/07-me.png)、[上报](../artifacts/visual-v11/08-report-empty.png)、[集合点](../artifacts/visual-v11/14-assembly.png)、[总结](../artifacts/visual-v11/15-drill-summary.png)、[演练记录](../artifacts/visual-v11/16-drill-records.png)。

这些PNG直接来自微信模拟器截图接口，没有使用浏览器仿页、合成截图或设计稿冒充运行结果。

## 后续人工检查

1. 服务端口已由用户开启，无需再次设置。
2. 在模拟器顶部机型下拉框选择iPhone SE（320×568），或自定义320×568；检查登录、首页、楼栋、我的、上报、总结。能滚动查看长内容属于预期，不应出现横向溢出。
3. 手动勾选登录协议、点击四项原生tabBar、点击页面返回箭头，确认真实触控行为。
4. 在手机预览中选择/删除图片，点击描述和联系方式输入框，检查软键盘弹出和收起后的按钮位置。代码已监听键盘高度，弹出时把提交操作放回正文；尚无真实键盘验收结论。
5. 电话入口只应出现演示提示；无需也不会拨打实际电话。
