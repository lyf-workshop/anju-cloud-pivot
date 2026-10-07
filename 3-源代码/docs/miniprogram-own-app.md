# 自有小程序导入与真机调试

适用于你在 [微信公众平台](https://mp.weixin.qq.com) 注册的小程序（例如「安居云守」），而不是仓库里历史 AppID。

## 一次性配置

在项目根目录 PowerShell 执行（把 `wx……` 换成「开发管理 → 开发设置」里的 AppID）：

```powershell
npm run wechat:setup -- wxYourAppId
```

脚本会：

1. 把 AppID 写入根目录与 `mobile/` 下的 `project.config.json`
2. 将 `mobile/config/index.js` 设为 **HTTPS 直连** 公网 API（`remote-demo`），不再依赖他人云环境
3. 生成或更新 `project.private.config.json`，模拟器开发时关闭域名校验

也可把 AppID 写在 `mobile/config/appid.local.js`（参考 `appid.example.js`），或 `server/.env` 的 `WECHAT_APP_ID`，再执行 `npm run wechat:setup`。

## 导入开发者工具

1. 导入目录：`3-源代码` **根目录**（含 `miniprogramRoot: mobile/`）
2. AppID：与上一步相同
3. 后端服务：**不使用云服务**（自有号未部署 `api-proxy` 时）
4. 编译后模拟器应出现登录页；使用演示会话登录（开发版）

## 真机调试

1. 工具栏 **预览** 或 **真机调试**，管理员微信扫码即可。
2. 真机请求走 HTTPS，必须在公众平台配置 **服务器域名**（与 `config/index.js` 里 `apiBaseUrl` 的主机名一致），例如：
   - request 合法域名
   - uploadFile 合法域名
   - downloadFile 合法域名
3. 「详情 → 本地设置 → 不校验合法域名」**只对模拟器有效**，不能代替真机域名配置。

## 切换 API 地址

默认指向现网演示 API。若改用其他 HTTPS 后端：

```powershell
$env:ANJU_API_BASE_URL="https://你的域名/api"; npm run wechat:setup -- wxYourAppId
```

本机 `http://127.0.0.1:3000` 仅适合电脑模拟器；真机请用公网 HTTPS 或局域网 IP + 已备案域名方案。
