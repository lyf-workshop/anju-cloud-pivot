# 使用自有微信小程序 AppID

当前仓库根目录就是原生微信小程序目录，不需要也不应再选择队友压缩包中的 `mobile/` 子目录。配置脚本只会修改根目录的 `project.config.json`，不会覆盖页面、后端或安装版代码。

## 一次完成 AppID 与演示接口配置

```powershell
npm run wechat:setup -- wx你的16位AppID remote-demo https://你的域名/api
```

使用微信云函数代理时改为：

```powershell
npm run wechat:setup -- wx你的16位AppID cloud-demo https://你的域名/api 你的云环境ID
```

随后在微信开发者工具中导入当前仓库根目录。不要提交微信密钥、服务器口令或数据库凭据；AppID 本身只是公开标识。若不希望在命令历史中写 AppID，可复制 `config/appid.example.js` 为被 Git 忽略的 `config/appid.local.js`，再执行 `npm run wechat:appid`。

演示版进入时由服务端签发按安装隔离的匿名会话。AppID 配置不会把管理员权限写入客户端，也不会改变 Windows/Android 安装版的会话机制。
