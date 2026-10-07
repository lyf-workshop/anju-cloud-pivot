import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { buildApp } from "../server/src/app.js";
import { settings } from "../server/src/config.js";

test("actual mini program controllers + HTTP contract: login, bind, submit, result, drill, history, logout", async () => {
  const req = createRequire(path.resolve("package.json")),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "anju-pages-"));
  const app = await buildApp(
    settings({
      DATA_MODE: "demo",
      DATABASE_PATH: path.join(dir, "demo.sqlite"),
    }),
  );
  const store = new Map<string, any>(),
    routes: string[] = [],
    pages: any[] = [];
  let definition: any;
  let pending = 0;
  const g = globalThis as any;
  g.wx = {
    getStorageSync: (k: string) => store.get(k),
    setStorageSync: (k: string, v: any) => store.set(k, structuredClone(v)),
    removeStorageSync: (k: string) => store.delete(k),
    getStorageInfoSync: () => ({ keys: [...store.keys()] }),
    getAccountInfoSync: () => ({ miniProgram: { envVersion: "develop" } }),
    request: (o: any) => {
      pending++;
      app
        .inject({
          method: o.method,
          url: new URL(o.url).pathname + new URL(o.url).search,
          payload: o.method === "GET" ? undefined : o.data,
          headers: o.header,
        })
        .then((r) => o.success({ statusCode: r.statusCode, data: r.json() }))
        .catch(o.fail)
        .finally(() => pending--);
    },
    navigateTo: (o: any) => routes.push(o.url),
    redirectTo: (o: any) => routes.push(o.url),
    switchTab: (o: any) => routes.push(o.url),
    navigateBack: () => routes.push("back"),
    showToast() {},
    setNavigationBarTitle() {},
    stopPullDownRefresh() {},
    enableAlertBeforeUnload() {},
    disableAlertBeforeUnload() {},
    showModal: (o: any) => o.success({ confirm: true }),
  };
  g.Page = (d: any) => {
    definition = d;
  };
  g.getCurrentPages = () => pages;
  function page(name: string, params: any = {}) {
    const file = req.resolve("./mobile/pages/" + name + "/" + name + ".js");
    delete req.cache[file];
    req(file);
    const p: any = { ...definition, data: structuredClone(definition.data) };
    p.setData = (patch: any) => {
      for (const [key, value] of Object.entries(patch)) {
        const parts = key.split(".");
        let t = p.data;
        parts.slice(0, -1).forEach((k) => (t = t[k] ??= {}));
        t[parts[parts.length - 1]] = structuredClone(value);
      }
    };
    pages.push(p);
    p.onLoad?.(params);
    return p;
  }
  async function idle() {
    for (let i = 0; i < 200; i++) {
      await new Promise((r) => setTimeout(r, 2));
      if (pending === 0 && !pages.some((p) => p.data.busy || p.data.loading))
        return;
    }
    throw new Error("Controller requests did not settle");
  }
  try {
    const login = page("login");
    await idle();
    login.submit();
    await idle();
    assert.equal(store.size, 0, "unchecked login performs no auth");
    login.agree({ detail: { value: ["yes"] } });
    login.submit();
    await idle();
    assert.equal(login.data.error, "");
    const address = page("addresses");
    address.onShow();
    await idle();
    address.changed({
      detail: {
        floorId: "floor-1-1-6",
        communityId: "community-demo",
        buildingId: "building-1",
        unitId: "unit-1-1",
      },
    });
    address.input({ detail: { value: "601" } });
    address.save();
    await idle();
    assert.equal(address.data.items[0].verification, "pending");
    const report = page("report");
    report.onShow();
    report.location({ detail: { floorId: "floor-1-1-6" } });
    for (const [field, value] of Object.entries({
      location: "6层公共走廊",
      description: "控制器联调测试：走廊存在障碍物",
      contact: "13800000000",
    }))
      report.input({
        currentTarget: { dataset: { field } },
        detail: { value },
      });
    report.submit();
    await idle();
    assert.equal(report.data.error, "");
    const rid = routes.at(-1)!.split("id=")[1];
    assert.ok(rid);
    const result = page("report-result", { id: rid });
    result.onShow();
    await idle();
    assert.equal(result.data.record.id, rid);
    assert.equal(result.data.record.status, "pending");
    const mine = page("my-reports");
    mine.onShow();
    await idle();
    assert.equal(mine.data.stats.total, 1);
    assert.equal(mine.data.items[0].id, rid);
    const building = page("building");
    building.setData({ selection: { floorId: "floor-1-1-6" } });
    building.start();
    await idle();
    const did = routes.at(-1)!.split("id=")[1];
    assert.ok(did);
    const exit = page("drill", { id: did });
    exit.onShow();
    await idle();
    assert.equal(exit.data.record.completedSteps.length, 0);
    exit.confirm();
    await idle();
    exit.onHide();
    assert.ok(routes.at(-1)!.includes("/assembly/"));
    // The factory module registers a Page per route, like the real JS bundle.
    const assembly = page("assembly", { id: did });
    assembly.onShow();
    await idle();
    assembly.confirm();
    await idle();
    assembly.onHide();
    assert.ok(routes.at(-1)!.includes("/drill-summary/"));
    const summary = page("drill-summary", { id: did });
    summary.onShow();
    await idle();
    assert.equal(summary.data.saved, true);
    assert.equal(summary.data.record.completedCount, 2);
    assert.equal(summary.data.record.status, "completed");
    const history = page("drill-records");
    history.onShow();
    await idle();
    assert.equal(history.data.stats.completedCount, 1);
    assert.equal(history.data.items[0].id, did);
    summary.again();
    await idle();
    assert.notEqual(routes.at(-1)!.split("id=")[1], did);
    const me = page("me");
    me.onShow();
    await idle();
    assert.equal(me.data.drillStats.completedCount, 1);
    me.logout();
    await idle();
    assert.equal(me.data.user, null);
    assert.equal(result.data.record, null, "logout clears old page instances");
    const emergency = page("emergency");
    emergency.onShow();
    await idle();
    assert.equal(emergency.data.config.emergencyPhone, "119");
    assert.equal(
      emergency.data.address,
      "",
      "anonymous emergency must not use example residence",
    );
  } finally {
    req("./mobile/services/drill-clock").reset();
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
    delete g.wx;
    delete g.Page;
    delete g.getCurrentPages;
  }
});
