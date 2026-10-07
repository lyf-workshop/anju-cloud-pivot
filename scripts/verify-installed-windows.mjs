import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { _electron as electron } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const executablePath = process.env.ANJU_WINDOWS_EXE;
const verificationUserData = process.env.ANJU_WINDOWS_USER_DATA;
if (!executablePath || !fs.existsSync(executablePath)) {
  throw new Error("Set ANJU_WINDOWS_EXE to the installed 安居云枢.exe path");
}
const sampleImage = path.join(root, "assets", "illustrations", "hazard-exit-blocked.png");
const screenshot = path.join(root, "output", "playwright", "windows-installed-history.png");
fs.mkdirSync(path.dirname(screenshot), { recursive: true });
const consoleErrors = [];

async function launch() {
  const application = await electron.launch({
    executablePath,
    args: verificationUserData ? [`--user-data-dir=${verificationUserData}`] : [],
    timeout: 30000,
  });
  const page = await application.firstWindow();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  return { application, page };
}

let first = await launch();
let directEntryObserved = false;
try {
  const direct = first.page.getByRole("button", { name: "直接体验" });
  directEntryObserved = (await direct.count()) === 1;
  if (directEntryObserved) {
    await direct.click();
    await first.page.getByRole("heading", { name: "人口登记" }).waitFor();
    await first.page.getByRole("button", { name: /下一步/ }).click();
    await first.page.getByRole("heading", { name: "信息隐私说明" }).waitFor();
    await first.page.getByRole("button", { name: "我已知晓" }).click();
    await first.page.getByRole("button", { name: "跳过此部分" }).click();
    await first.page.getByRole("heading", { name: "登记完成" }).waitFor();
    await first.page.getByRole("button", { name: "进入首页" }).click();
  }
  await first.page.getByRole("heading", { name: /把安全/ }).waitFor();

  await first.page.locator('.sidebar button[data-route="building"]').click();
  await first.page.getByRole("button", { name: /查看本层感知设备/ }).click();
  await first.page.getByText("走廊烟雾传感器").waitFor();
  assert.ok(await first.page.getByText(/固定演示读数|过期数据|采集状态未知/).count());

  await first.page.locator('.sidebar button[data-route="hazards"]').click();
  await first.page.locator('button[data-route="report"]').first().click();
  await first.page.locator('button[data-action="select-hazard-category"][data-id="passage"]').click();
  await first.page.locator('button[data-action="select-hazard"][data-id="exit-blocked"]').click();
  await first.page.locator('textarea[name="description"]').fill("Windows 安装版验证：楼道堆放纸箱影响安全通行。");
  await first.page.locator("#report-photos").setInputFiles(sampleImage);
  await first.page.getByRole("img", { name: "现场图片 1" }).waitFor();
  await first.page.getByRole("button", { name: "提交演示上报" }).click();
  await first.page.getByRole("heading", { name: "模拟上报成功" }).waitFor();
  const visibleNumber = await first.page.getByText(/^AJ\d{8}-[A-F0-9]{8}$/).textContent();
  assert.match(visibleNumber || "", /^AJ\d{8}-[A-F0-9]{8}$/);

  await first.page.getByRole("button", { name: "查看我的全部上报" }).click();
  await first.page.getByRole("heading", { name: "我的上报" }).waitFor();
  assert.ok(await first.page.getByText(visibleNumber).count());

  await first.page.locator('.sidebar button[data-route="building"]').click();
  await first.page.getByRole("button", { name: "模拟演练" }).click();
  await first.page.getByRole("button", { name: "开始两步演练" }).click();
  await first.page.getByRole("heading", { name: "认识本层安全出口" }).waitFor();
  await first.page.getByRole("button", { name: "已了解，下一步" }).click();
  await first.page.getByRole("heading", { name: "认识社区集合点" }).waitFor();
  await first.page.getByRole("button", { name: "结束演练，查看总结" }).click();
  await first.page.getByRole("heading", { name: "本次演练已结束" }).waitFor();
  await first.page.getByRole("button", { name: "查看历史记录" }).click();
  await first.page.getByText("2/2 步骤").first().waitFor();
} finally {
  await first.application.close();
}

const reopened = await launch();
try {
  await reopened.page.waitForURL(/#\/home$/, { timeout: 20000 });
  assert.equal(await reopened.page.getByRole("button", { name: "直接体验" }).count(), 0);
  await reopened.page.locator('.sidebar button[data-route="me"]').click();
  await reopened.page.getByRole("button", { name: /我的上报/ }).click();
  await reopened.page.getByRole("heading", { name: "我的上报" }).waitFor();
  assert.ok(await reopened.page.getByText(/AJ\d{8}-[A-F0-9]{8}/).count());
  await reopened.page.locator('.sidebar button[data-route="me"]').click();
  await reopened.page.getByRole("button", { name: /演练记录/ }).click();
  await reopened.page.getByRole("heading", { name: "演练记录", level: 1 }).waitFor();
  await reopened.page.getByText("2/2 步骤").first().waitFor();
  await reopened.page.screenshot({ path: screenshot, fullPage: true });
} finally {
  await reopened.application.close();
}

assert.deepEqual(consoleErrors, [], `installed app console errors: ${consoleErrors.join(" | ")}`);
console.log(JSON.stringify({
  executablePath,
  verificationUserData: verificationUserData || "default",
  directEntryObserved,
  onboardingCompleted: directEntryObserved,
  deviceView: true,
  imageUploadAndReport: true,
  twoStepDrill: true,
  sessionRestoredAfterRelaunch: true,
  screenshot,
  consoleErrors: 0,
}, null, 2));
