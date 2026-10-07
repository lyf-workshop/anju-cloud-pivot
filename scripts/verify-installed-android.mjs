import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sdkRoot = process.env.ANDROID_SDK_ROOT
  || process.env.ANDROID_HOME
  || path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
const adbPath = path.join(sdkRoot, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
const packageName = "com.anjuyunshu.judge";
const componentName = `${packageName}/.MainActivity`;
const cdpPort = "9222";
const artifactDir = path.join(root, "output", "android-verification");
const screenshot = path.join(artifactDir, "installed-history.png");
const deviceScreenshot = path.join(artifactDir, "installed-history-device.png");
const photoPickerScreenshot = path.join(artifactDir, "image-picker-open-1.4.0.png");
const sampleImageBase64 = fs.readFileSync(
  path.join(root, "assets", "illustrations", "hazard-exit-blocked.png"),
).toString("base64");

assert.ok(fs.existsSync(adbPath), `adb not found at ${adbPath}`);
fs.mkdirSync(artifactDir, { recursive: true });

function adb(args) {
  return execFileSync(adbPath, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocket = new WebSocket(webSocketUrl);
    this.commandId = 0;
    this.pending = new Map();
    this.consoleErrors = [];
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.webSocket.addEventListener("open", resolve, { once: true });
      this.webSocket.addEventListener("error", reject, { once: true });
    });
    this.webSocket.addEventListener("message", (event) => this.handleMessage(event));
    await this.send("Runtime.enable");
    await this.send("Log.enable");
    await this.send("Page.enable");
    return this;
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject, timeout } = this.pending.get(message.id);
      clearTimeout(timeout);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.code}: ${message.error.message}`));
      else resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      this.consoleErrors.push(message.params.exceptionDetails?.text || "Runtime exception");
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      this.consoleErrors.push(message.params.args.map((item) => item.value || item.description || "").join(" "));
    }
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
      this.consoleErrors.push(message.params.entry.text);
    }
  }

  send(method, params = {}) {
    const id = ++this.commandId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timeout });
      this.webSocket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    }
    return response.result?.value;
  }

  async waitFor(expression, message, timeoutMilliseconds = 20000) {
    const deadline = Date.now() + timeoutMilliseconds;
    while (Date.now() < deadline) {
      if (await this.evaluate(expression)) return;
      await delay(250);
    }
    throw new Error(message);
  }

  async click(selector) {
    const encoded = JSON.stringify(selector);
    await this.waitFor(`Boolean(document.querySelector(${encoded}))`, `missing element ${selector}`);
    await this.evaluate(`document.querySelector(${encoded}).click()`);
  }

  async clickText(text) {
    const encoded = JSON.stringify(text);
    const finder = `[...document.querySelectorAll("button")].find((item) => item.textContent.includes(${encoded}))`;
    await this.waitFor(`Boolean(${finder})`, `missing button ${text}`);
    await this.evaluate(`${finder}.click()`);
  }

  async fill(selector, value) {
    const encodedSelector = JSON.stringify(selector);
    const encodedValue = JSON.stringify(value);
    await this.waitFor(`Boolean(document.querySelector(${encodedSelector}))`, `missing input ${selector}`);
    await this.evaluate(`(() => {
      const input = document.querySelector(${encodedSelector});
      const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(input, ${encodedValue});
      input.dispatchEvent(new Event("input", { bubbles: true }));
    })()`);
  }

  async attachImage(selector, base64) {
    const encodedSelector = JSON.stringify(selector);
    const encodedData = JSON.stringify(base64);
    await this.evaluate(`(async () => {
      const binary = atob(${encodedData});
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const file = new File([bytes], "android-verification.png", { type: "image/png", lastModified: Date.now() });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector(${encodedSelector});
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
  }

  waitForText(text, timeoutMilliseconds = 20000) {
    const encoded = JSON.stringify(text);
    return this.waitFor(`document.body.innerText.includes(${encoded})`, `missing text ${text}`, timeoutMilliseconds);
  }

  async saveScreenshot(outputPath) {
    const result = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    fs.writeFileSync(outputPath, Buffer.from(result.data, "base64"));
  }

  close() {
    this.webSocket.close();
  }
}

async function connectToInstalledWebView() {
  let processId = "";
  for (let attempt = 0; attempt < 30 && !processId; attempt += 1) {
    processId = adb(["shell", "pidof", packageName]);
    if (!processId) await delay(500);
  }
  assert.match(processId, /^\d+$/, "installed Android process was not running");
  adb(["forward", `tcp:${cdpPort}`, `localabstract:webview_devtools_remote_${processId}`]);

  let target;
  for (let attempt = 0; attempt < 30 && !target; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      const targets = await response.json();
      target = targets.find((item) => item.type === "page" && item.url.startsWith("https://localhost"));
    } catch {
      // The WebView is still starting.
    }
    if (!target) await delay(500);
  }
  assert.ok(target?.webSocketDebuggerUrl, "installed Android WebView target was not available");
  const webSocketUrl = target.webSocketDebuggerUrl.replace("localhost", "127.0.0.1");
  return new CdpClient(webSocketUrl).open();
}

const allConsoleErrors = [];
let first = await connectToInstalledWebView();
let reportNumber;
try {
  assert.equal(await first.evaluate('document.body.innerText.includes("直接体验")'), true);
  await first.clickText("直接体验");
  await first.waitForText("人口登记");
  await first.clickText("下一步");
  await first.waitForText("信息隐私说明");
  await first.clickText("我已知晓");
  await first.clickText("跳过此部分");
  await first.waitForText("登记完成");
  await first.clickText("进入首页");
  await first.waitForText("把安全");

  await first.click('.bottom-nav button[data-route="assist"]');
  await first.clickText("走廊堆了纸箱");
  await first.waitForText("疏散通道可能被占用");
  await first.clickText("去上报");
  assert.match(
    await first.evaluate('document.querySelector(\'textarea[name="description"]\').value'),
    /疏散通道/,
  );

  await first.click('.bottom-nav button[data-route="building"]');
  await first.clickText("查看本层感知设备");
  await first.waitForText("走廊烟雾传感器");
  assert.equal(await first.evaluate('/固定演示读数|过期数据|采集状态未知/.test(document.body.innerText)'), true);

  await first.click('.bottom-nav button[data-route="hazards"]');
  await first.click('button[data-route="report"]');
  await first.click("#report-photos");
  await delay(1200);
  const systemWindows = adb(["shell", "dumpsys", "window", "windows"]);
  assert.match(systemWindows, /photopicker|PhotoPicker|MediaProvider/i, "Android system photo picker did not open");
  const remotePickerScreenshot = "/sdcard/anju-image-picker-open.png";
  adb(["shell", "screencap", "-p", remotePickerScreenshot]);
  adb(["pull", remotePickerScreenshot, photoPickerScreenshot]);
  adb(["shell", "rm", remotePickerScreenshot]);
  adb(["shell", "input", "keyevent", "KEYCODE_BACK"]);
  await delay(500);
  await first.click('button[data-action="select-hazard-category"][data-id="passage"]');
  await first.click('button[data-action="select-hazard"][data-id="exit-blocked"]');
  await first.fill('textarea[name="description"]', "Android 安装版验证：楼道堆放纸箱影响安全通行。");
  await first.attachImage("#report-photos", sampleImageBase64);
  await first.waitForText("已选 1 / 3 张");
  await first.clickText("提交演示上报");
  await first.waitForText("模拟上报成功");
  reportNumber = await first.evaluate('document.body.innerText.match(/AJ\\d{8}-[A-F0-9]{8}/)?.[0]');
  assert.match(reportNumber || "", /^AJ\d{8}-[A-F0-9]{8}$/);

  await first.clickText("查看我的全部上报");
  await first.waitFor(
    `document.body.innerText.includes(${JSON.stringify(reportNumber)})`,
    `new report list did not contain ${reportNumber}`,
  );

  await first.click('.bottom-nav button[data-route="building"]');
  await first.clickText("模拟演练");
  await first.clickText("开始两步演练");
  await first.waitForText("认识本层安全出口");
  await first.clickText("已了解，下一步");
  await first.waitForText("认识社区集合点");
  await first.clickText("结束演练，查看总结");
  await first.waitForText("本次演练已结束");
  await first.clickText("查看历史记录");
  await first.waitForText("2/2 步骤");
} finally {
  allConsoleErrors.push(...first.consoleErrors);
  first.close();
}

adb(["shell", "am", "force-stop", packageName]);
adb(["shell", "am", "start", "-W", "-n", componentName]);
const reopened = await connectToInstalledWebView();
try {
  await reopened.waitFor('location.hash === "#/home"', "app did not restore the anonymous session");
  assert.equal(await reopened.evaluate('document.body.innerText.includes("直接体验")'), false);
  await reopened.click('.bottom-nav button[data-route="me"]');
  await reopened.clickText("我的上报");
  await reopened.waitForText("我的上报");
  await reopened.waitFor(
    `document.body.innerText.includes(${JSON.stringify(reportNumber)})`,
    `restored history did not contain ${reportNumber}`,
  );
  await reopened.click('.bottom-nav button[data-route="me"]');
  await reopened.clickText("演练记录");
  await reopened.waitForText("2/2 步骤");
  await reopened.saveScreenshot(screenshot);
} finally {
  allConsoleErrors.push(...reopened.consoleErrors);
  reopened.close();
}

const remoteScreenshot = "/sdcard/anju-installed-history.png";
adb(["shell", "screencap", "-p", remoteScreenshot]);
adb(["pull", remoteScreenshot, deviceScreenshot]);
adb(["shell", "rm", remoteScreenshot]);

assert.deepEqual(allConsoleErrors, [], `installed Android app console errors: ${allConsoleErrors.join(" | ")}`);
console.log(JSON.stringify({
  packageName,
  directEntryObserved: true,
  onboardingCompleted: true,
  deviceView: true,
  assistantDraftPrefill: true,
  systemPhotoPicker: true,
  photoPickerScreenshot,
  reportPersisted: reportNumber,
  twoStepDrill: true,
  sessionRestoredAfterRelaunch: true,
  screenshot,
  deviceScreenshot,
  consoleErrors: 0,
  host: os.hostname(),
}, null, 2));
