/** 隐患分类与示例图（图片自带底部红条标题） */
const categories = [
  {
    id: "passage",
    name: "安全通道",
    legacyType: "obstruction",
    items: [
      {
        id: "exit-locked",
        name: "安全出口上锁",
        image: "/assets/illustrations/hazard-exit-locked.png",
      },
      {
        id: "no-sign-light",
        name: "缺少疏散指示/应急照明",
        image: "/assets/illustrations/hazard-no-sign-light.png",
      },
      {
        id: "exit-blocked",
        name: "杂物堵塞安全出口",
        image: "/assets/illustrations/hazard-exit-blocked.png",
      },
      {
        id: "fire-lane",
        name: "违规占用消防通道",
        image: "/assets/illustrations/hazard-ebike-scene.jpg",
      },
    ],
  },
  {
    id: "fire-equip",
    name: "消防器材",
    legacyType: "fire",
    items: [
      {
        id: "hose-corroded",
        name: "水带腐蚀严重",
        image: "/assets/illustrations/hazard-hose-corroded.png",
      },
      {
        id: "hydrant-incomplete",
        name: "消火栓配置不齐",
        image: "/assets/illustrations/hazard-hydrant-incomplete.png",
      },
      {
        id: "hydrant-nowater",
        name: "消火栓无水",
        image: "/assets/illustrations/hazard-hydrant-nowater.png",
      },
      {
        id: "extinguisher-expired",
        name: "灭火器过期",
        image: "/assets/illustrations/fire.png",
        labeled: false,
      },
    ],
  },
  {
    id: "ebike",
    name: "电动车",
    legacyType: "fire",
    items: [
      {
        id: "ebike-flying-wire",
        name: "电动车飞线充电",
        image: "/assets/illustrations/hazard-ebike-scene.jpg",
      },
      {
        id: "ebike-elevator",
        name: "电动车/电池进电梯",
        image: "/assets/illustrations/hazard-ebike-scene.jpg",
      },
    ],
  },
  {
    id: "electrical",
    name: "用电电路",
    legacyType: "electrical",
    items: [
      {
        id: "circuit-aging",
        name: "电路老化",
        image: "/assets/illustrations/electrical.png",
        labeled: false,
      },
      {
        id: "outlet-damage",
        name: "公共用电设施损坏",
        image: "/assets/illustrations/electrical.png",
        labeled: false,
      },
    ],
  },
  {
    id: "other",
    name: "其他",
    legacyType: "other",
    items: [
      {
        id: "custom",
        name: "自己补充",
        image: "/assets/illustrations/equipment.png",
        custom: true,
        labeled: false,
      },
    ],
  },
];

function findItem(hazardId) {
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const item = (cat.items || []).find((x) => x.id === hazardId);
    if (item) return { category: cat, item };
  }
  return null;
}

function allItems() {
  return categories.reduce((list, cat) => {
    return list.concat(
      cat.items.map((item) =>
        Object.assign({}, item, {
          categoryId: cat.id,
          categoryName: cat.name,
          legacyType: cat.legacyType,
        }),
      ),
    );
  }, []);
}

module.exports = { categories, findItem, allItems };
