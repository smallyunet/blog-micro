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

`.github/workflows/deploy.yml` 会在这些情况下运行：

- push 到 `main`
- 当前仓库 issue comment 创建、编辑、删除
- 手动 `workflow_dispatch`
- 每 30 分钟兜底轮询

注意：GitHub 的 `issue_comment` 事件只会触发 comment 所在仓库的 workflow。历史年份仍在 `hexo-blog`，所以旧仓库 issue 的更新主要依靠定时轮询；新年份放到 `blog-micro` 后可以接近实时更新。
