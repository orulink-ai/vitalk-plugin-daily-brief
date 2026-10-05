# ViTalk 今日简报插件

保留原今日简报的黑色封面、当日统计、今日重点、待确认事项、状态同步、重新生成总结及连续复盘。源码与发布在本独立仓库；公开目录只保存版本清单。

## 开发与安装

需要 Node.js 22、ViTalk 0.6.11 或更新版本。

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
```

在 ViTalk 的 Plugin Store 选择导入 `dist/vitalk.daily-brief.vitalk-plugin.json`，核对权限后安装并启用。权限含读取历史、调用已配置模型、独立存储和按用户操作更新共享待办。插件不持有模型密钥或直接读取宿主数据库。

模型生成沿用宿主当前模型及账号；按你的配置可能产生用量。模型配置或授权失效时页面显示可理解的错误，原始历史不被修改。

## 发布上架

1. 更新本仓库 manifest 与 package 版本，运行上面的检查。
2. 用 `gh release create v1.0.0 dist/vitalk.daily-brief.vitalk-plugin.json --repo orulink-ai/vitalk-plugin-daily-brief --title '今日简报 1.0.0' --notes-file documents/dev_log/release.md` 将包发布到固定版本 Release。
3. 克隆 [公共插件目录](https://github.com/orulink-ai/vitalk-plugins)，安装其中 publisher 工具依赖。
4. 运行 `node /目录/vitalk-plugins/publisher/cli.mjs --repository orulink-ai/vitalk-plugin-daily-brief --tag v1.0.0 --asset vitalk.daily-brief.vitalk-plugin.json --min-host 0.6.11 --dry-run`；确认后去掉 dry-run。它会自动创建公共目录 PR。
5. 等待检查与管理员审核。合并后客户端从静态目录发现插件，下载时核验实际包的 SHA256 与大小。

每次更新创建新版本和新 Release，再执行工具；不用手工编写 PR，不允许覆盖已登记版本。本地导入与公共上架是两个入口。本版没有独立的上传审核服务器。

## 代码边界

- `DailyBrief.tsx` 与 `daily-brief.ts` 保留原页面与算法，原始快照在 archive，仅作迁移证据。
- `review-services.ts` 负责公开历史分页、模型总结与连续复盘。
- `shared-tasks.ts` / `todo-identity.ts` 负责待办来源绑定和状态同步。
- `bootstrap.ts` 负责初始化、历史订阅与关闭；`status-store.ts` 负责插件命名空间存储。
- SDK 打包在 vendor；构建不需要 ViTalk 私有仓库。

开发与测试记录：[任务档案](documents/dev_log/index.md)。本插件没有上传用户历史到 GitHub；仓库测试使用合成记录。
