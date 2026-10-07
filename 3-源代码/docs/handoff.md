# 队友接手与轻量打包

## 交付内容

轻量源码包保留以下可维护内容：

- `website/` 物业网页、兼容层和演示素材。
- `mobile/` 微信原生小程序页面、组件、素材、Mock 数据和统一数据层。
- `apps/`、`android/` 和桌面端配置源码。
- `edge/raspberry-pi/` 摄像头采集与 YOLO 接入代码。
- 测试、构建脚本、部署说明和项目文档。

打包时不包含 `.git`、`node_modules`、构建产物、安装包、自动化截图、临时部署包、本地数据库、私有微信配置、`.env`、签名文件或任何运行密钥。演示视频已直接包含在压缩包中，解压后网页无需另找素材。

## 解压后启动

需要 Node.js 22.13 或更高版本。PowerShell 在项目根目录执行：

```powershell
npm ci
npm run backend:db:init
npm run dev
```

然后访问 `http://127.0.0.1:3000/index.html`。后端配置从 `server/.env.example` 复制到本地私有 `server/.env`，不要提交真实密码和密钥。

微信开发者工具直接导入项目根目录。使用自己在公众平台注册的小程序时，先执行 `npm run wechat:setup -- wxYourAppId`，见 [自有小程序导入与真机调试](miniprogram-own-app.md)。纯本地小程序展示执行 `npm run client:showcase`；连接本机后端执行 `npm run client:local`，并按 [本地联调说明](local-development.md) 配置。

桌面开发运行 `npm run desktop:start`。Android 首次构建先安装 Android Studio / SDK，再执行：

```powershell
npm run android:sync
npm run android:build
```

`android/.gradle`、`android/app/build` 和 Cordova 兼容插件目录会在同步或构建时重新生成。

## 重新清理

先预览清理范围：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/cleanup-generated.ps1
```

确认后执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/cleanup-generated.ps1 -Execute
```

脚本只处理列明的依赖、缓存、构建结果、部署临时包和重复压缩包，并在执行前校验路径仍位于项目根目录。它不会删除业务源码、当前网页演示视频、配置模板、Git 历史或 `server/data` 中的本地调试数据。
