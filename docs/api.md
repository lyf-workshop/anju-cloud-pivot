# 安居云枢 API v1

> 延期功能的历史接口文档。当前页面展示版只使用 `mock/` 与 `services/repository.js`，不调用下列接口，也不需要启动服务器。展示版运行方法以根目录 README 为准。

Base URL：`http://127.0.0.1:3000/api`；正式部署 HTTPS。JSON UTF-8。业务数据只有一个后端；demo / production 分库，客户端 `X-Data-Mode: demo|production` 不匹配返回409。

## 通用约定

成功：`{"data": ...}`。错误：`{"error":{"code":"VALIDATION_ERROR","message":"输入信息不完整或格式不正确","requestId":"req-1"}}`。附件成功返回原始 JPEG 二进制，无 JSON 包装。

身份：标记“用户”的接口需要 `Authorization: Bearer <业务token>`。token 随机生成，默认7天有效，服务端只存 SHA-256 摘要；退出删除当前会话。微信 code / AppSecret / session_key 不作为业务 token。所有 owner 以服务端会话用户为准，写入 DTO 拒绝客户端 `userId`。

分页：列表通用 `page=1`、`pageSize=20`，上限50，下限1；返回 `{items,total,page,pageSize}`。社区/楼栋/住址等少量配置列表不分页。当前数据的所有时间使用 UTC ISO8601（如 `2026-09-28T12:00:00.000Z`），客户端按设备本地时区显示。

业务幂等键：8–100字符，由客户端在首次提交前生成并持久保存，重试保持不变。唯一约束为 `(user_id,idempotency_key)`，相同键不同内容409。创建报告和演练使用事务；结束演练以 session ID 幂等。

## 接口一览

| 方法、路径 | 身份 | 输入 | 输出、规则 |
|---|---|---|---|
| GET /health | 公开 | 无 | `{status,mode}` |
| GET /config | 公开 | 无 | 模式、开发登录开关、协议版本/审核状态/正文、物业号码及更新时间、119、帮助文本、设备时效阈值。会话失效不阻挡此接口 |
| POST /auth/dev-login | 仅开发demo | `{agreed:true,legalVersion,demoAccount?:resident-a或resident-b}` | `{token,expiresAt,user}`；production 禁止，未勾选400，版本不符409，新用户无住址 |
| POST /auth/login | 公开/正式数据 | `{agreed:true,legalVersion,code}` | 服务端向微信换取身份，再返回业务会话；未配置微信或审核协议503；微信失败401/502 |
| GET /me | 用户 | 无 | `{id,nickname,bindings,mode}` |
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
| POST /attachments | 用户 | multipart 单一 `file` | `{id,mime,size}`；JPEG/PNG/WebP≤5MiB，实际解码校验、最多2500万像素，重编码JPEG并剥离EXIF，最长边2000px。随机文件名、安全固定路径 |
| GET /attachments/:id | 用户/本人 | 无 | 私有 JPEG，`Cache-Control: private,no-store`；其他用户404，不能通过静态路径访问 |
| POST /reports | 用户/楼栋范围 | 见报告DTO | 完整本人报告；关联图片必须归本人、未被别的报告使用，最多3张；重复创建返回同一ID |
| GET /reports/community | 公开 | `communityId?`、`status?` + 分页 | 只返回 `{id,number,type,status,createdAt,buildingName}`。不含用户、电话、私有位置、描述、图片；此ID不能绕过私有详情权限 |
| GET /reports/mine | 用户 | `status?` + 分页 | 本人完整报告列表，时间倒序 |
| GET /reports/stats | 用户 | 无 | `{total,pending,processing,completed}`，从报告表计算 |
| GET /reports/submission/:key | 用户 | 幂等键 | 查本人该提交的已保存报告；404表示未创建，用于丢失响应后找回 |
| GET /reports/:id | 用户/本人 | 无 | 私有完整报告及时间线，其他用户404 |
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

楼栋范围：报告创建、设备读取、演练创建要求本人至少有一条该楼栋的绑定；`floorId` 必须通过楼层→单元→楼栋关联验证。设备关联上报时设备必须位于所选楼层。住址绑定属于**自报信息**，不授权读取其他住户私人记录，不等于正式住户认证；本轮没有管理审核界面。公开楼栋资料仅用于社区介绍和线上认知，不应配置保密建筑资料。

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

`type=fire|obstruction|equipment|electrical|other`。位置2–160字符，描述5–2000字符，联系方式5–30字符、仅数字及 `+()-空格`，不要求登录前绑定手机。`deviceId` 选填，图片0–3张、不可重复。返回 `{id,number,type,location,description,contact,status,createdAt,floorId,deviceId,attachmentIds,events}`。`events=[{status,message,occurredAt}]` 只有实际事件；新报告只插入待处理事件。没有物业操作，不自动推进状态；`processing/completed` 数据模型已支持，本期无物业更新接口或假时间线。

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

## 持久化与错误码

表：`metadata/users/sessions/communities/buildings/units/floors/residences/bindings/announcements/attachments/hazard_reports/report_attachments/report_events/devices/readings/device_events/drill_sessions/drill_steps`。SQLite外键开启，WAL模式，业务创建/状态修改用事务；schema初始化版本1，重复初始化不覆盖数据。文件名服务端生成，实际存储名从鉴权后的附件记录读取，不接受用户磁盘路径。

| HTTP | 代码 | 含义 |
|---|---|---|
| 400 | VALIDATION_ERROR、LOGIN_CODE_REQUIRED、FLOOR_REQUIRED、DEVICE_LOCATION、DUPLICATE_ATTACHMENT | 输入不合法 |
| 400 | STEP_ORDER、INVALID_DURATION、SOURCE_MISMATCH、EVENT_TIME、READING_REQUIRED | 业务校验不通过 |
| 401 | SESSION_EXPIRED、WECHAT_LOGIN_FAILED、DEVICE_AUTH | 会话或设备凭据失效 |
| 403 | DEV_LOGIN_DISABLED、BUILDING_SCOPE、ATTACHMENT_ACCESS | 环境或范围/附件权限不符 |
| 404 | NOT_FOUND | 不存在或不是当前用户的记录 |
| 409 | IDEMPOTENCY_CONFLICT、DRILL_STATE、STEPS_INCOMPLETE、MODE_MISMATCH、LEGAL_VERSION、EVENT_CONFLICT | 幂等、状态或配置冲突 |
| 413 | FST_REQ_FILE_TOO_LARGE / FILE_TOO_LARGE | 上传超过限制 |
| 415 | FILE_TYPE、INVALID_IMAGE | 非受支持图片或解码失败 |
| 429 | Fastify限流错误 | 超过每IP每分钟240请求 |
| 502 | WECHAT_UNAVAILABLE | 微信身份服务连接失败 |
| 503 | LEGAL_NOT_CONFIGURED、WECHAT_NOT_CONFIGURED | 正式接入缺少配置 |
| 500 | INTERNAL_ERROR | 未预期服务错误，响应不含堆栈/密钥/个人联系方式 |

页面显示可恢复错误，不静默切换数据源。日志关闭请求体/鉴权信息输出。正式运营仍需根据自身职责补齐审核运营流程、数据留存与个人信息删除渠道，以及备份策略。
