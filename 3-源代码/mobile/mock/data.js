// All showcase fixtures live here. No server, real resident, or connected hardware.
const community = {
  id: "community-demo",
  name: "云栖花园",
  source: "demo",
  meetingPoint: "社区中心广场 · 银杏树旁集合区",
};
const defaultSelection = {
  communityId: community.id,
  buildingId: "building-1",
  unitId: "unit-1-1",
  floorId: "floor-1-1-6",
};
const updatedAt = "2026-09-28T01:30:00.000Z";
const makeFloors = (buildingNo, unitNo) =>
  Array.from({ length: 18 }, (_, i) => ({
    id: `floor-${buildingNo}-${unitNo}-${i + 1}`,
    number: i + 1,
    exitText:
      "本层东西两侧各有一处楼梯间安全出口。请先认识出口标识，再了解社区集合点。",
  }));
const buildings = [1, 2, 3].map((n) => ({
  id: `building-${n}`,
  communityId: community.id,
  name: `${n}号楼`,
  units: Array.from({ length: 10 }, (_, i) => {
    const u = i + 1;
    return {
      id: `unit-${n}-${u}`,
      name: `${u}单元`,
      floors: makeFloors(n, u),
    };
  }),
}));
const binding = {
  id: "binding-demo",
  verification: "demo",
  isCurrent: true,
  room: "601室",
  ...defaultSelection,
  floorNumber: 6,
  unitName: "1单元",
  buildingName: "1号楼",
  communityName: community.name,
  address: `${community.name} 1号楼 1单元 6层 601室`,
};
const householdOptions = [
  {
    id: "bedridden",
    label: "卧床",
    icon: "/assets/illustrations/situation-bedridden.png",
  },
  {
    id: "wheelchair",
    label: "轮椅",
    icon: "/assets/illustrations/situation-wheelchair.png",
  },
  {
    id: "mobility",
    label: "行动不便",
    icon: "/assets/illustrations/situation-mobility.png",
  },
  {
    id: "vision",
    label: "视力障碍",
    icon: "/assets/illustrations/situation-vision.png",
  },
  {
    id: "hearing",
    label: "听力障碍",
    icon: "/assets/illustrations/situation-hearing.png",
  },
  {
    id: "pregnant",
    label: "孕妇",
    icon: "/assets/illustrations/situation-pregnant.png",
  },
];
const user = {
  id: "resident-demo",
  nickname: "林小安",
  mode: "showcase",
  bindings: [binding],
  household: null,
};
const announcements = [
  {
    id: "notice-1",
    title: "让楼道畅通，让安心常在",
    body: "请勿在公共走廊和楼梯间堆放杂物。一起从身边的小事做起，守护温暖家园。",
    publishedAt: "2026-09-28T01:00:00.000Z",
    source: "demo",
  },
  {
    id: "notice-2",
    title: "给自己两分钟，熟悉身边的安全出口",
    body: "打开楼栋页面，跟随线上模拟演练，认识本层安全出口与社区集合点。",
    publishedAt: "2026-09-26T01:00:00.000Z",
    source: "demo",
  },
  {
    id: "notice-3",
    title: "电动车请规范停放与充电",
    body: "请勿将电动车电瓶带入楼栋充电，共同守护消防安全。",
    publishedAt: "2026-09-24T01:00:00.000Z",
    source: "demo",
  },
];
const devices = buildings.flatMap((b) =>
  b.units.flatMap((u) =>
    u.floors.flatMap((f) => [
      {
        id: `${f.id}-smoke`,
        name: "走廊烟雾传感器",
        type: "smoke",
        floorId: f.id,
        location: `${b.name} ${f.number}层东侧公共走廊`,
        connectionStatus: "online",
        eventStatus: "cleared",
        lastSeenAt: updatedAt,
        source: "demo",
        reading: {
          value: 0,
          unit: "%",
          collectedAt: updatedAt,
          freshness: "fresh",
        },
      },
      {
        id: `${f.id}-temperature`,
        name: "楼梯间温度传感器",
        type: "temperature",
        floorId: f.id,
        location: `${b.name} ${f.number}层西侧楼梯间`,
        connectionStatus: f.number === 7 ? "offline" : "online",
        eventStatus: "unknown",
        lastSeenAt: updatedAt,
        source: "demo",
        reading: {
          value: f.number === 6 ? 24.6 : 23.8,
          unit: "°C",
          collectedAt: updatedAt,
          freshness: f.number === 7 ? "stale" : "fresh",
        },
      },
      {
        id: `${f.id}-door`,
        name: "防火门状态传感器",
        type: "door",
        floorId: f.id,
        location: `${b.name} ${f.number}层楼梯间入口`,
        connectionStatus: "unknown",
        eventStatus: "unknown",
        lastSeenAt: null,
        source: "demo",
        reading: null,
      },
    ]),
  ),
);
const reports = [
  {
    id: "report-demo-1",
    number: "DEMO-0928-001",
    type: "obstruction",
    floorId: binding.floorId,
    buildingName: "1号楼",
    communityId: community.id,
    location: "1号楼6层 · 东侧公共走廊",
    description: "楼道内有几只纸箱堆放在通道一侧，希望及时清理，保持通道畅通。",
    contact: "演示联系方式",
    status: "pending",
    createdAt: "2026-09-28T01:20:00.000Z",
    photos: [],
    isExample: true,
    events: [
      {
        status: "pending",
        message: "示例记录：等待处理",
        occurredAt: "2026-09-28T01:20:00.000Z",
      },
    ],
  },
  {
    id: "report-demo-2",
    number: "DEMO-0927-002",
    type: "equipment",
    floorId: "floor-1-1-7",
    buildingName: "1号楼",
    communityId: community.id,
    location: "1号楼7层 · 西侧楼梯间",
    description: "楼梯间照明灯出现闪烁，请检查灯具。",
    contact: "演示联系方式",
    status: "processing",
    createdAt: "2026-09-27T07:15:00.000Z",
    photos: [],
    isExample: true,
    events: [
      {
        status: "pending",
        message: "示例：居民反馈照明问题",
        occurredAt: "2026-09-27T07:15:00.000Z",
      },
      {
        status: "processing",
        message: "示例：已安排人员检查",
        occurredAt: "2026-09-27T08:30:00.000Z",
      },
    ],
  },
  {
    id: "report-demo-3",
    number: "DEMO-0925-003",
    type: "electrical",
    floorId: binding.floorId,
    buildingName: "1号楼",
    communityId: community.id,
    location: "1号楼6层 · 电梯厅",
    description: "公共区域插座盖板松动，现已在示例处理中完成修复。",
    contact: "演示联系方式",
    status: "completed",
    createdAt: "2026-09-25T02:10:00.000Z",
    photos: [],
    isExample: true,
    events: [
      {
        status: "pending",
        message: "示例：问题已记录",
        occurredAt: "2026-09-25T02:10:00.000Z",
      },
      {
        status: "processing",
        message: "示例：工作人员检查中",
        occurredAt: "2026-09-25T03:00:00.000Z",
      },
      {
        status: "completed",
        message: "示例：盖板已修复",
        occurredAt: "2026-09-25T04:20:00.000Z",
      },
    ],
  },
];
const steps = [
  { id: "exit", title: "认识本层安全出口" },
  { id: "assembly", title: "认识社区集合点" },
];
function scene(floorId) {
  for (const building of buildings)
    for (const unit of building.units) {
      const floor = unit.floors.find((f) => f.id === floorId);
      if (floor)
        return {
          title: "楼栋线上模拟演练",
          communityId: community.id,
          communityName: community.name,
          buildingId: building.id,
          buildingName: building.name,
          otherBuildingNames: buildings.filter(b=>b.id!==building.id).map(b=>b.name),
          unitId: unit.id,
          unitName: unit.name,
          floorId,
          floorNumber: floor.number,
          exitText: floor.exitText,
          meetingPoint: community.meetingPoint,
          source: "demo",
          steps,
          notice:
            "线上模拟演练，仅用于认识出口与集合点，不表示已实际完成疏散。",
        };
    }
  throw new Error("请选择有效楼层");
}
const drills = [
  {
    id: "drill-demo-1",
    drillSessionId: "drill-demo-1",
    status: "completed",
    startedAt: "2026-09-27T11:00:00.000Z",
    completedAt: "2026-09-27T11:02:36.000Z",
    durationSeconds: 156,
    totalSteps: 2,
    completedSteps: steps.map((s) => ({ id: s.id })),
    snapshot: scene(binding.floorId),
    isExample: true,
  },
  {
    id: "drill-demo-2",
    drillSessionId: "drill-demo-2",
    status: "completed",
    startedAt: "2026-09-20T02:00:00.000Z",
    completedAt: "2026-09-20T02:01:48.000Z",
    durationSeconds: 108,
    totalSteps: 2,
    completedSteps: steps.map((s) => ({ id: s.id })),
    snapshot: scene(binding.floorId),
    isExample: true,
  },
];
const config = {
  mode: "showcase",
  propertyPhone: "400-000-0000",
  propertyName: "云栖花园物业服务中心",
  emergencyPhone: "119",
  legalVersion: "showcase-v1",
  terms:
    "展示版使用说明\n\n欢迎体验安居云枢。当前版本仅演示页面、交互和跳转，点击登录不会调用真实微信身份接口。\n\n社区、住址、设备和历史记录均为本地示例。新填写的上报仅供本次演示查看，不会发送给物业；电话按钮不会实际拨号。\n\n线上演练用于认识示意流程，不代表实际完成疏散。",
  privacy:
    "展示版隐私说明\n\n当前版本不连接服务器，不调用真实微信登录，也不上传图片或表单。\n\n你选择的照片只在本机预览，填写内容只保存在当前运行的内存中。退出演示或重新启动后会恢复示例内容，请勿填写真实敏感信息。\n\n这是一份展示说明，不是正式运营的法律文本。",
  help: "本地展示版可以体验隐患上报、设备查看与两步线上演练。所有数据均为示例；填写内容不会上传，电话不会实际拨出。",
};
module.exports = {
  community,
  buildings,
  user,
  announcements,
  devices,
  reports,
  drills,
  config,
  defaultSelection,
  householdOptions,
  scene,
};
