# blog-micro

独立的微博静态站。页面保留 `blog-crazy` 里 micro-blog 的时间线风格，数据继续来自 GitHub Issues comments。

## 数据来源

数据源配置在 `data/sources.json`。当前历史数据仍指向旧仓库 `smallyunet/hexo-blog` 的年度 issue：

- 2020: issue 7
- 2021: issue 10
- 2022: issue 19
- 2023: issue 29
- 2024: issue 32
- 2025: issue 35

以后新增年份时，建议在 `smallyunet/blog-micro` 仓库创建对应年份 issue，然后在 `data/sources.json` 添加：

```json
{
  "year": 2026,
  "owner": "smallyunet",
  "repo": "blog-micro",
  "issue": 1
}
```

之后直接在该 issue 下新增 comment，GitHub Actions 会触发同步并部署。

## 本地运行

这个项目没有构建步骤，直接启动任意静态服务器即可：

```bash
npm run serve
```

也可以用 Python、Caddy、nginx 等静态服务打开根目录。

## 同步数据

```bash
npm run sync
```

`scripts/sync-issues.mjs` 会读取 `data/sources.json`，拉取每个 issue 的 comments，并覆盖 `data/YYYY.json` 与 `data/manifest.json`。

## 自动部署

`.github/workflows/deploy.yml` 只在当前仓库发生以下事件时自动同步并部署：

- issue comment 创建、编辑、删除
- issue 创建、编辑、删除（包含作为微博展示的 issue 正文）

每次只同步事件对应的已配置 issue；其他年份保留现有数据。删除整个源 issue 时，会清空对应年份的数据。

不再通过定时任务、push 或手动 Actions 触发发布。Pull request 评论不会触发部署。

历史年份仍在 `hexo-blog`，保留现有静态数据，不再自动拉取；旧仓库的编辑和删除不会自动同步。需要手动全量同步时，可在本地运行 `npm run sync`。
