import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const executablePath = process.env.ANJU_WINDOWS_EXE;
const username = process.env.ANJU_STAFF_USERNAME;
const password = process.env.ANJU_STAFF_PASSWORD;
const generatedUserData = !process.env.ANJU_WINDOWS_USER_DATA;
const verificationUserData =
  process.env.ANJU_WINDOWS_USER_DATA ||
  fs.mkdtempSync(path.join(os.tmpdir(), "anju-property-windows-"));
const screenshot = path.join(
  root,
  "output",
  "playwright",
  "windows-property-installed-1.5.0.png",
);

if (!executablePath || !fs.existsSync(executablePath))
  throw new Error("Set ANJU_WINDOWS_EXE to the installed 安居云枢物业工作台.exe path");
if (!username || !password)
  throw new Error("Set ANJU_STAFF_USERNAME and ANJU_STAFF_PASSWORD for the verification account");

fs.mkdirSync(path.dirname(screenshot), { recursive: true });
const consoleErrors = [];

async function launch() {
  const application = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${verificationUserData}`],
    timeout: 30000,
  });
  const page = await application.firstWindow();
  page.on("console", (message) => {
    const value = message.text();
    if (
      message.type() === "error" &&
      !/Failed to load resource: the server responded with a status of (401|404)/.test(
        value,
      )
    )
      consoleErrors.push(value);
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  return { application, page };
}

let reportNumber = "";
const first = await launch();
try {
  await first.page.getByRole("heading", { name: "物业工作台登录" }).waitFor();
  await first.page.locator('input[name="username"]').fill(username);
  await first.page.locator('input[name="password"]').fill(password);
  await first.page.locator('input[name="remember"]').check();
  await first.page.getByRole("button", { name: "登录物业工作台" }).click();
  await first.page.getByRole("heading", { name: "社区值班工作台" }).waitFor({
    timeout: 20000,
  });
  assert.ok(await first.page.getByText("待处理隐患", { exact: true }).count());
  assert.ok(await first.page.getByText("登记设备", { exact: true }).count());

  await first.page.getByRole("button", { name: "账号安全" }).click();
  await first.page.locator("#security-dialog").getByText(username, { exact: true }).waitFor();
  await first.page.getByText("当前设备", { exact: false }).waitFor();
  await first.page.getByRole("button", { name: "完成" }).click();

  await first.page.getByRole("link", { name: "楼栋与设备" }).click();
  await first.page.getByRole("heading", { name: "楼栋与感知设备" }).waitFor();
  await first.page.getByText("设备最近观测").waitFor();

  await first.page.goto(
    new URL("/report.html?mode=api", first.page.url()).toString(),
  );
  await first.page.getByRole("heading", { name: "隐患工单" }).waitFor();
  const form = first.page.locator("#connected-report-form");
  await form.locator('input[name="location"]').fill("六层公共走廊（Windows 物业端验证）");
  await form
    .locator('textarea[name="description"]')
    .fill("物业 Windows 安装版巡查发现纸箱堆放，现登记服务器工单。");
  await form.locator('input[name="contact"]').fill("13800000000");
  await form.getByRole("button", { name: "保存上报" }).click();
  const message = first.page.locator("#api-message");
  await message.getByText(/上报已保存：AJ/).waitFor({ timeout: 20000 });
  const messageText = await message.textContent();
  reportNumber = messageText?.match(/AJ\d{8}-[A-F0-9]{8}/)?.[0] || "";
  assert.match(reportNumber, /^AJ\d{8}-[A-F0-9]{8}$/);
  await first.page.getByText(reportNumber, { exact: true }).first().waitFor();
} finally {
  await first.application.close();
}

const reopened = await launch();
try {
  await reopened.page.getByRole("heading", { name: "社区值班工作台" }).waitFor({
    timeout: 20000,
  });
  assert.equal(
    await reopened.page.getByRole("heading", { name: "物业工作台登录" }).count(),
    0,
  );
  await reopened.page.getByRole("link", { name: "处理隐患工单" }).click();
  await reopened.page.getByRole("heading", { name: "隐患工单" }).waitFor();
  await reopened.page.getByText(reportNumber, { exact: true }).first().waitFor();
  await reopened.page.screenshot({ path: screenshot, fullPage: true });
  await reopened.page.getByRole("button", { name: "退出登录" }).click();
  await reopened.page.getByRole("heading", { name: "物业工作台登录" }).waitFor();
} finally {
  await reopened.application.close();
  if (generatedUserData)
    fs.rmSync(verificationUserData, { recursive: true, force: true });
}

assert.deepEqual(consoleErrors, [], `installed app console errors: ${consoleErrors.join(" | ")}`);
console.log(
  JSON.stringify(
    {
      executablePath,
      propertyLogin: true,
      propertySessionManagement: true,
      deviceView: true,
      propertyFieldReportSaved: reportNumber,
      sessionRestoredAfterRelaunch: true,
      logoutVerified: true,
      screenshot,
      consoleErrors: 0,
    },
    null,
    2,
  ),
);
