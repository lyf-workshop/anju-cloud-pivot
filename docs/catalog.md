# 正式资料目录格式

`CATALOG_FILE` 指向 UTF-8 JSON，根对象 `source` 必须为 `configured`。`docs/production-catalog.example.json` 默认空数组，防止示例社区被当作真实信息。以下是**结构示例**，运营方需替换全部资料再初始化，不能将占位描述当作已核实信息。

```json
{
  "source": "configured",
  "communities": [{
    "id":"your-community-id", "name":"已核实社区名称", "meetingPoint":"已核实集合点说明及资料来源/更新时间",
    "buildings":[{
      "id":"your-building-id", "name":"已核实楼栋名称",
      "units":[{
        "id":"your-unit-id", "name":"单元名称",
        "floors":[{
          "id":"your-floor-id", "number":1, "exitText":"已核实出口说明及资料来源/更新时间",
          "devices":[{"id":"your-device-id","name":"设备名称","type":"temperature","location":"安装位置"}]
        }]
      }]
    }],
    "announcements":[{"id":"your-notice-id","title":"公告标题","body":"经确认内容","publishedAt":"2026-09-28T00:00:00.000Z"}]
  }]
}
```

初始化仅`INSERT OR IGNORE`。修改既有资料需业务方执行受控数据库迁移，本轮不自动改生产数据库。新登记设备无通信时间和读数，收到可信接入事件后才更新。
