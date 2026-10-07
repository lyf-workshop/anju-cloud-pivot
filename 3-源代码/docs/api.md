# 安居云枢 API v1

> 2026-09-29：已接通居民小程序和物业网页的本地后端。保留 `/api` 路径以兼容既有实现；没有同时维护另一套 `/api/v1` 服务。离线展示通过 `client:showcase` 显式选择。

Base URL：`http://127.0.0.1:3000/api`；正式部署 HTTPS。JSON UTF-8。业务数据只有一个后端；demo / production 分库，客户端 `X-Data-Mode: demo|production` 不匹配返回409。

## 通用约定

成功：`{"data": ...}`。错误：`{"error":{"code":"VALIDATION_ERROR","message":"输入信息不完整或格式不正确","requestId":"req-1"}}`。附件成功返回原始 JPEG 二进制，无 JSON 包装。

身份：标记“用户”的接口需要 `Authorization: Bearer <业务token>`。普通 token 默认7天有效；评委版匿名 token 默认90天，可由 `DEMO_SESSION_TTL_HOURS` 调整。token 随机生成，服务端只存 SHA-256 摘要；退出删除当前会话。微信 code / AppSecret / session_key 不作为业务 token。所有 owner 以服务端会话用户为准，写入 DTO 拒绝客户端 `userId`。

评委安装版首次生成随机 `installationKey` 并调用匿名会话接口；服务端只保存安装键 SHA-256，创建独立 `demoapp:` 用户和固定演示住址。相同安装键恢复同一用户，不同安装键不能读取彼此的上报、附件或演练。客户端没有共享管理员密钥。

分页：列表通用 `page=1`、`pageSize=20`，上限50，下限1；返回 `{items,total,page,pageSize}`。社区/楼栋/住址等少量配置列表不分页。当前数据的所有时间使用 UTC ISO8601（如 `2026-09-28T12:00:00.000Z`），客户端按设备本地时区显示。

业务幂等键：8–100字符，由客户端在首次提交前生成并持久保存，重试保持不变。唯一约束为 `(user_id,idempotency_key)`，相同键不同内容409。创建报告和演练使用事务；结束演练以 session ID 幂等。

## 接口一览

| 方法、路径 | 身份 | 输入 | 输出、规则 |
|---|---|---|---|
| GET /health | 公开 | 无 | `{status,mode}` |
| POST /camera-ingest/v1/cameras/:id/frame | 树莓派独立密钥 | `image/jpeg` 请求体；`X-Camera-Key`；`X-Camera-Metadata` 为 base64url JSON | 202 `{cameraId,sequence,receivedAt}`；同一 `bootId` 的序号必须递增，服务只保留最新帧 |
| GET /camera-access/v1/cameras/:id | 公开探测/物业 Cookie | 无 | 未登录仅返回 `{authenticated:false}`；有本社区物业会话时返回最新状态和受控帧/流 URL，不返回接入密钥 |
| GET /staff/cameras/:id/status | 本社区物业 | 无 | 在线/过期状态、采集与接收时间、模型信息、推理耗时、检测结果、测试来源和帧/流 URL |
| GET /staff/cameras/:id/frame.jpg | 本社区物业 | 无 | 最新 JPEG；没有画面或超过时效返回 503；`private,no-store` |
| GET /staff/cameras/:id/stream.mjpg | 本社区物业 | 无 | `multipart/x-mixed-replace` MJPEG；服务关闭时主动断开 |
| GET /config | 公开 | 无 | 模式、开发登录开关、协议版本/审核状态/正文、物业号码及更新时间、119、帮助文本、设备时效阈值。会话失效不阻挡此接口 |
| POST /auth/demo-session | 仅 demo 评委体验 | `{installationKey,platform:windows\|android\|web,clientVersion}` | 创建或恢复按安装隔离的匿名会话，返回 `{token,expiresAt,user}`；公网按 IP 限频，production 或未启用 `DEMO_EXPERIENCE` 时 403 |
| POST /auth/dev-login | 仅开发demo | `{agreed:true,legalVersion,demoAccount?:resident-a或resident-b}` | `{token,expiresAt,user}`；production 禁止，未勾选400，版本不符409，新用户无住址 |
| POST /auth/login | 公开/正式数据 | `{agreed:true,legalVersion,code}` | 服务端向微信换取身份，再返回业务会话；未配置微信或审核协议503；微信失败401/502 |
| GET /me | 用户 | 无 | `{id,nickname,bindings,mode}` |
| GET /app/bootstrap | 用户 | `communityId?` | 一次返回 `{user,home,reportStats,drillStats,serverTime,mode}`，供安装版启动时建立可见的云端同步状态 |
| PATCH /me | 用户 | `{nickname}`，1–30字 | 更新后的用户资料 |
| POST /auth/logout | 用户 | `{}` | `{loggedOut:true}`，使当前 token 失效 |
| GET /bindings | 用户 | 无 | 本人绑定列表，不返回其他人住址 |
| POST /bindings | 用户 | `{floorId,room}`，房号1–20字符，中英文/数字/空格/连字符 | 保存自报住址，`verification=pending`，设为当前；同一房号绑定幂等；返回本人绑定列表 |
| PUT /bindings/:id/current | 用户 | `{}` | 仅能设本人住址为当前，其他人的绑定404 |
| GET /communities | 公开 | 无 | `{id,name,meetingPoint,source}[]` |
| GET /buildings | 公开 | `communityId` | `{id,name,communityId}[]` |
| GET /buildings/:id | 公开 | 无 | 楼栋 + `units[{id,name,floors[{id,number,exitText}]}]` |
| GET /home | 公开 | `communityId?` | `{community,buildings,announcements,reportCount,deviceCount}`；无配置返回明确空数据 |
| GET /announcements | 公开 | `communityId?` + 分页 | 公告列表 `{id,title,body,publishedAt,source}` |
| POST /attachments | 用户 | multipart 单一 `file` | `{id,mime,size}`；JPEG/PNG/WebP≤5MiB，实际解码校验、最多2500万像素，重编码JPEG并剥离EXIF，最长边2000px。随机文件名、安全固定路径；匿名安装版每小时最多20个附件、总量25MiB |
| GET /attachments/:id | 本人或授权物业 | 无 | 私有 JPEG，`Cache-Control: no-store`；本人可访问自己的附件，本社区物业只能访问已关联本社区工单的附件；其他用户404，不能通过静态路径访问 |
| POST /reports | 用户/楼栋范围 | 见报告DTO | 完整本人报告；关联图片必须归本人、未被别的报告使用，最多3张；重复创建返回同一ID |
| GET /reports/community | 公开 | `communityId?`、`status?` + 分页 | 只返回 `{id,number,type,status,createdAt,buildingName}`。不含用户、电话、私有位置、描述、图片；此ID不能绕过私有详情权限 |
| GET /reports/mine | 用户 | `status?` + 分页 | 本人完整报告列表，时间倒序 |
| GET /reports/stats | 用户 | 无 | `{total,pending,processing,completed}`，从报告表计算 |
| GET /reports/submission/:key | 用户 | 幂等键 | 查本人该提交的已保存报告；404表示未创建，用于丢失响应后找回 |
| GET /reports/:id | 用户/本人 | 无 | 私有完整报告及时间线，其他用户404 |
| GET /reports/public/:id | 公开 | 无 | `{id,number,type,status,createdAt,buildingName,public:true,events:[],attachmentIds:[]}`；不含私人位置、描述、联系方式和图片 |
| GET /devices | 用户/楼栋范围 | `floorId` + 分页 | 设备最近读数与独立通信/事件状态 |
| GET /devices/:id | 用户/楼栋范围 | 无 | 设备详细信息及最近读数、告警/解除事件 |
| POST /drills | 用户/楼栋范围 | `{floorId,idempotencyKey}` | 创建或返回同一演练，场景快照、模板版本 `online-v1.1`；初始0步 |
| PUT /drills/:id/progress | 用户/本人 | `{durationMs,completedSteps}` | 单调保存最大累计时长及已确认步骤并集，返回会话 |
| POST /drills/:id/complete | 用户/本人 | 同进度DTO | 必须两个步骤均确认；幂等完成，同ID重复结束保持原时间和时长 |
| POST /drills/:id/abort | 用户/本人 | 同进度DTO | 保存中止状态，重复中止幂等；完成不能改中止，中止不能改完成 |
| GET /drills | 用户 | `status?` + 分页 | `startedAt DESC,id DESC`，包括进行中/已完成/已中止 |
| GET /drills/:id | 用户/本人 | 无 | 历史完整会话，使用保存的场景快照 |
| GET /drills/stats | 用户 | 无 | `{completedCount,durationMs,durationSeconds,completedSteps}`，只统计已完成记录 |
| POST /device-events | 服务端设备凭据 | 见设备事件DTO | 新事件 `{eventId,receivedAt,duplicate:false}`；重复返回 `{eventId,duplicate:true}`；冲突409 |

楼栋范围：报告创建、设备读取、演练创建要求本人至少有一条该楼栋的绑定；demo 允许待审核绑定，production 要求 verified，rejected 在两种模式均拒绝。`floorId` 通过楼层→单元→楼栋关联验证；设备须位于所选楼层。住址绑定不授权读取他人私人记录。物业角色 manager/operator 可以在自己被分配的社区登记现场上报；viewer 只读。公开楼栋资料仅用于社区介绍和线上认知，不应配置保密建筑资料。

`demoapp:` 匿名安装用户另外受服务端配额约束：每24小时最多创建30条上报和30次演练；上传路由同时有每分钟20次的通用限频。客户端遇到超时会保留幂等键，重试前先查询 `/reports/submission/:key`，不会把“本地点击成功”当成服务器已保存。

## 数据结构

报告创建：

```json
{
  "idempotencyKey": "稳定客户端生成键",
  "floorId": "floor-1-1-6",
  "deviceId": "device-smoke-1",
  "type": "equipment",
  "location": "6层东侧公共走廊",
  "description": "设备外壳损坏，请安排现场检查",
  "contact": "13800000000",
  "attachmentIds": []
}
```

`type=fire|obstruction|equipment|electrical|other`。位置2–160字符，描述5–2000字符，联系方式5–30字符、仅数字及 `+()-空格`，不要求登录前绑定手机。`deviceId` 选填，图片0–3张、不可重复。返回 `{id,number,type,location,description,contact,status,createdAt,floorId,deviceId,attachmentIds,events}`。`events=[{status,message,occurredAt}]` 只有实际事件；新报告只插入待处理事件。只有授权物业通过处理接口受理或完成后才推进状态，不生成假时间线。

住址返回 `{id,verification,isCurrent,room,floorId,floorNumber,unitId,unitName,buildingId,buildingName,communityId,communityName,address}`。住址实体和用户绑定分表，`verification` 与 `isCurrent` 各自独立。

设备返回 `{id,name,type,floorId,location,lastSeenAt,source,connectionStatus,reading,event,eventStatus}`。

- `connectionStatus=online|offline|unknown`，最近通信距现在≤`DEVICE_ONLINE_SECONDS`（默认300秒）在线；无通信为unknown。
- `reading=null` 表示从未采集；否则 `{value,unit,collectedAt,source,isTest,freshness}`。采集超过`READING_FRESH_SECONDS`（默认600秒）标记stale。
- `eventStatus=alarm|cleared|unknown`，只看按发生时间最新的 alarm / clear 事件；心跳不能解除告警，离线不改变告警状态。
- demo 读数和时间固定，不随机刷新，不承诺硬件已联通。

演练返回：

```json
{
  "id": "UUID", "drillSessionId": "同一UUID", "status": "completed",
  "startedAt": "UTC时间", "completedAt": "UTC结束时间或null",
  "durationMs": 0, "durationSeconds": 0,
  "completedSteps": [{"id":"exit","confirmedAt":"UTC时间"},{"id":"assembly","confirmedAt":"UTC时间"}],
  "totalSteps": 2, "stepVersion": "online-v1.1", "saved": true,
  "snapshot": {
    "title":"楼栋线上疏散认知演练", "communityId":"稳定ID", "communityName":"创建时名称",
    "buildingId":"稳定ID", "buildingName":"创建时名称", "unitName":"创建时名称",
    "floorId":"稳定ID", "floorNumber":6, "exitText":"创建时出口说明",
    "meetingPoint":"创建时集合点说明", "source":"demo或configured",
    "steps":[{"id":"exit","title":"认识本层安全出口"},{"id":"assembly","title":"认识社区集合点"}],
    "notice":"线上认知说明"
  }
}
```

状态：`in_progress|completed|aborted`。`completedAt` 是终态保存时间，中止时也作为结束时间使用。进度请求 `completedSteps` 为字符串数组（`exit`、`assembly`），不接受跳过exit直接确认assembly。`durationMs` 是累计值，整数0–86400000，不能超过服务端从开始到现在的经过时间+2秒容差。并发或重试取最大值而非相加；结束后不可更改快照、时长、结束时间。

前台时长由小程序演练页面可见期间的时间差累计，每秒保存本机检查点，在page/app隐藏时暂停。不是依赖计时器tick数。强杀可能丢最后不足1秒检查点；未同步数据只在本机，退出/清缓存会丢失。断网结束保留pendingAction与原ID；总结页仅服务端完成后显示“记录已保存”。线上2/2不是实际到达证明。未设计为防作弊计时或安全认证证据。

## 硬件事件契约与接入边界

请求使用 `X-Device-Key: <DEVICE_INGEST_KEY>`，与居民token无关，不下发客户端。空配置禁用接入。运营方先在正式目录中登记设备。

```json
{
  "eventId":"producer-unique-event-id", "deviceId":"configured-device-id",
  "occurredAt":"2026-09-28T12:00:00.000Z",
  "eventType":"reading", "severity":"info",
  "payload":{"value":24.3,"unit":"°C"}, "source":"hardware", "isTest":false
}
```

服务端生成 `receivedAt`，不信任客户端接收时间。`eventType=alarm|clear|heartbeat|reading`，`severity=info|warning|critical`。reading必须含有限数值value与1–20字符unit。发生时间不能超前服务端5分钟。production只允许hardware且isTest=false，demo只允许demo且isTest=true；测试事件不得进入正式记录。

`eventId` 全局唯一：完全相同重传返回duplicate；同ID不同设备、发生时间、类型、级别或payload拒绝409。乱序事件入库留历史，最近通信和读数仅按最大**发生时间**推进，告警状态仅由最新alarm/clear决定，心跳不覆盖告警。相同发生时间以eventId作稳定排序；如硬件需严格同毫秒顺序，应在适配器中形成一致的事件时间与ID规则。本期仅实现事件输入与查询，不发送硬件控制，不实现自动疏散决策、订阅通知或真实报警派单。

摄像头帧元数据示例：

```json
{
  "bootId": "本次代理进程UUID",
  "sequence": 42,
  "capturedAt": "2026-09-29T18:10:58.315Z",
  "width": 640,
  "height": 480,
  "source": "raspberry-pi-yolo-demo",
  "isTest": true,
  "model": {
    "name": "yolov8n-fire-smoke",
    "version": "local-existing-weight",
    "sha256": "64位小写十六进制"
  },
  "threshold": 0.6,
  "inferenceMs": 62.73,
  "alarmState": "clear",
  "consecutiveHits": 0,
  "detections": [
    {"class": "smoke", "confidence": 0.72, "box": [10, 20, 100, 160]}
  ]
}
```

`alarmState=clear|candidate|confirmed` 只是模型复核状态，不能解释为已核实火情。`isTest` 当前强制为 `true`。新 `bootId` 允许序号从零重新开始；同一 `bootId` 的重复或倒序帧返回 409。JPEG 上限、过期秒数和所属社区分别由 `CAMERA_MAX_FRAME_BYTES`、`CAMERA_STALE_SECONDS`、`CAMERA_COMMUNITY_ID` 配置。

## 持久化与错误码

表：`metadata/users/sessions/communities/buildings/units/floors/residences/bindings/announcements/attachments/hazard_reports/report_attachments/report_events/devices/readings/device_events/drill_sessions/drill_steps`。SQLite外键开启，WAL模式，业务创建/状态修改用事务；现有居民表为版本1，`server/src/migrations.ts` 事务迁移到版本2，新增物业表且不覆盖业务数据。打开数据库时先校验 demo/production 模式再执行迁移。文件名服务端生成，实际存储名从鉴权后的附件记录读取，不接受用户磁盘路径。

| HTTP | 代码 | 含义 |
|---|---|---|
| 400 | VALIDATION_ERROR、LOGIN_CODE_REQUIRED、FLOOR_REQUIRED、DEVICE_LOCATION、DUPLICATE_ATTACHMENT | 输入不合法 |
| 400 | STEP_ORDER、INVALID_DURATION、SOURCE_MISMATCH、EVENT_TIME、READING_REQUIRED | 业务校验不通过 |
| 401 | SESSION_EXPIRED、WECHAT_LOGIN_FAILED、DEVICE_AUTH、CAMERA_KEY_INVALID | 会话或设备/摄像头凭据失效 |
| 403 | DEV_LOGIN_DISABLED、BUILDING_SCOPE、ATTACHMENT_ACCESS | 环境或范围/附件权限不符 |
| 404 | NOT_FOUND | 不存在或不是当前用户的记录 |
| 409 | IDEMPOTENCY_CONFLICT、DRILL_STATE、STEPS_INCOMPLETE、MODE_MISMATCH、LEGAL_VERSION、EVENT_CONFLICT、CAMERA_FRAME_OUT_OF_ORDER | 幂等、状态、乱序帧或配置冲突 |
| 413 | FST_REQ_FILE_TOO_LARGE / FILE_TOO_LARGE | 上传超过限制 |
| 415 | FILE_TYPE、INVALID_IMAGE、CAMERA_FRAME_INVALID | 非受支持图片/JPEG或解码失败 |
| 429 | Fastify限流错误 | 超过每IP每分钟240请求 |
| 502 | WECHAT_UNAVAILABLE | 微信身份服务连接失败 |
| 503 | LEGAL_NOT_CONFIGURED、WECHAT_NOT_CONFIGURED、CAMERA_INGEST_DISABLED、CAMERA_NO_FRAME、CAMERA_OFFLINE | 正式接入缺少配置或摄像头暂无有效画面 |
| 500 | INTERNAL_ERROR | 未预期服务错误，响应不含堆栈/密钥/个人联系方式 |

页面显示可恢复错误，不静默切换数据源。日志关闭请求体/鉴权信息输出。正式运营仍需根据自身职责补齐审核运营流程、数据留存与个人信息删除渠道，以及备份策略。

## 物业网页接口

默认网页现已恢复原Mock页面，不请求下列接口；仅 `login.html` 及带 `?mode=api` 的接口联调视图使用这些API。接口实现和数据库保留。

网页与 API 同源，由 Fastify 托管 `website/`。浏览器通过 HttpOnly、SameSite=Strict Cookie `anju_session` 认证；production 增加 Secure，本地 HTTP 不设置 Secure。随机会话仅把摘要存入数据库，登录响应不包含 token。

所有 `/staff/*` 写请求及携带会话 Cookie 的其他写请求，必须带 `X-Anju-Request: 1`。有 Origin 时必须匹配 `WEB_ORIGINS`；登录也执行该规则。安装版客户端的跨域访问只允许 `CLIENT_ORIGINS` 中逐项配置的精确来源，不使用通配符，也不携带物业 Cookie。网页密码使用随机盐和 scrypt 派生，不保存明文；登录限流每 IP 每分钟10次。停用员工账号后物业接口拒绝访问。

社区角色：`manager`（管理/审核/写入）、`operator`（工单/巡查/事件处置）、`viewer`（只读）。服务端同时验证用户、角色及社区，前端传入的社区 ID 不能授予权限。以下列表均要求 `communityId`，支持 `page/pageSize`（默认1/20，上限50）。`/me` 和 `/members` 返回小型数组/对象，不分页。

| 方法与路径 | 权限 | 输入 / 返回 |
|---|---|---|
| POST /staff/auth/login | 公开、CSRF校验 | `{username,password}`；返回 `{user:{id,nickname,communities:[{communityId,communityName,role}]},expiresAt}`，设置会话Cookie |
| GET /staff/me | 物业 | 当前员工与授权社区列表 |
| POST /staff/auth/logout | 物业 | `{}`；删除会话并清Cookie |
| GET /staff/members | 社区只读 | 本社区有效员工 `{id,nickname,role}[]` |
| GET /staff/overview | 社区只读 | 社区、上报/待办/绑定居民/完成演练/设备数量，来源数据库；`hardwareConnected:false` 表示本轮未验证任何真实硬件连接 |
| GET /staff/reports | 社区只读 | 支持 `status=pending|processing|completed`；含工单完整数据、`version`、`assigneeId` |
| GET /staff/reports/:id | 记录所属社区只读 | 工单详情、照片ID和处理时间线 |
| POST /staff/reports/:id/actions | manager/operator | 见下方处理DTO；更新工单、版本、时间线、审计并在同一事务中保存幂等键 |
| GET /staff/residents | 社区只读 | 当前住址绑定 `{id,userId,nickname,buildingName,unitName,floorNumber,room,verification}`；没有编造年龄或健康档案 |
| PATCH /staff/bindings/:id | manager | `{verification:verified或rejected,reason}`；原因2–500字，写入操作审计 |
| GET /staff/devices | 社区只读 | 全社区分页设备，字段与居民设备接口一致 |
| GET /staff/drills | 社区只读 | 本社区演练记录与快照、参与者昵称；按开始时间倒序 |
| GET /staff/events | 社区只读 | 原始事件时间/来源/设备及 `reviewStatus,version,note`，按发生时间倒序 |
| POST /staff/events/:id/review | manager/operator | `{idempotencyKey,expectedVersion,status:acknowledged或closed或false_positive,note}`，说明2–1000字；不改原始设备事件，也不向硬件发控制指令 |
| GET /staff/inspections | 社区只读 | 巡查分页列表，包含登记人昵称、位置、结果、说明和时间 |
| POST /staff/inspections | manager/operator | `{idempotencyKey,communityId,floorId,location,result:clear或issue,description}`；位置2–160字，说明2–1000字；楼层必须属于该社区 |
| GET /staff/duties | 社区只读 | 值班分页列表，按开始时间倒序 |
| POST /staff/duties | manager | `{idempotencyKey,communityId,title,assigneeId,startsAt,endsAt,note?}`；标题2–100字，备注≤500字；结束晚于开始，值班人必须是本社区有效员工 |
| GET /staff/agent/status | 物业 | `{configured,model,provider}`；不返回密钥 |
| POST /staff/agent/chat | 物业 | `{communityId?,cameraId?,messages:[{role,content}]}`；服务端调用智增增 Chat Completions 与摄像头/工单工具。返回 `{reply,tools,proposal,model}`。`proposal` 仅为起草，确认后仍走工单处理接口 |

物业工单处理示例：

```json
{
  "idempotencyKey": "为本次动作生成并保留的唯一键",
  "expectedVersion": 0,
  "status": "processing",
  "message": "已受理，安排工作人员到现场核查",
  "assigneeId": "本社区有处理权限的员工UUID，可省略"
}
```

状态流转：pending → processing → completed；processing 可追加进展/调整处理人。不能跳过受理直接完成；completed 为本轮终态。首次版本0，每次有效操作+1。相同员工/幂等键/相同请求重复返回当前记录，不新增事件；不同内容409。`expectedVersion` 过期返回 `VERSION_CONFLICT`，刷新详情后以新的动作键提交。人工事件审核闭合后不能再修改；审核记录不解除设备告警。

物业新增表：`staff_accounts/staff_memberships/report_workflow/staff_operations/audit_logs/duty_shifts/inspections/event_reviews`。时间均为 UTC ISO8601。审计记录操作人、社区、资源、动作和时间；不记录密码、token或完整上报联系方式。

新增错误：401 `LOGIN_FAILED`；403 `STAFF_REQUIRED/COMMUNITY_SCOPE/ASSIGNEE_SCOPE/CSRF_REJECTED`；409 `VERSION_CONFLICT/REPORT_STATE/EVENT_STATE`；400 `SHIFT_TIME`。HTTP/通用错误结构保持一致。

当前物业网页支持创建值班/巡查、发布公告及处理现有记录；未包含员工管理界面、班次冲突调度、巡查自动生成工单、数据导出或订阅通知。员工账号可通过显式 `backend:staff:create` 命令配置；服务器部署与正式环境验证不在本轮本地联调范围。
