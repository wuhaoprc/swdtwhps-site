# swdtwhps-site · 上海嘉元环境科技官网 + 3D 工艺演示

在线站点：https://swdtwhps.dpdns.org/

本仓库是一个 Cloudflare Pages 项目（Git 连接 `main`，无构建命令，仓库根即网站根），现在承载两套内容：

| 路径 | 内容 | 说明 |
|---|---|---|
| `/` | 嘉元环境企业官网（单文件） | `index.html` 内含全部样式与脚本，hash 路由 8 个视图；首页锁 `100vh` 不滚动 |
| `/3d/` | 江河海 SWRO 全流程 3D 演示 | 原根目录演示整体迁入，入口 `/3d/index.html`，免服务单文件版 `/3d/offline.html` |

## 目录结构

```
index.html              # 官网（单文件，内联 CSS/JS，hash 路由）
assets/img/             # 官网图片：logo-stack、favicon、场景图与产品图
_headers                # 响应头：根 html 不缓存、图片 7 天、/3d 源码 no-cache
robots.txt / sitemap.xml
3d/
  index.html            # 3D 演示入口（ES Module，需经 http 提供）
  offline.html          # 3D 演示单文件版（1.4 MB，双击可看）
  manifest.webmanifest  # 3D 演示 PWA 清单
  src/ utils/ vendor/   # 3D 源码、导出工具与本地化 three.js
  assets/               # 3D 水印与图标
```

## 更新官网（走 GitHub API，不需要 git）

官网是单文件，改完把 `index.html` 与 `assets/img` 覆盖到本地镜像目录，然后推：

```powershell
.\push-site.ps1 -DryRun           # 只列出增删改，不推送
.\push-site.ps1 -Message "feat: 首页改版"
```

- 令牌放在脚本同目录 `.gh-token`（一行纯文本，`Contents: Read and write` 即可）。
- 脚本做四件事：逐文件建 blob → 带 `base_tree` 合树（本地没有的远端文件按删除挂 `sha:null`）→ 建 commit → 更新 `refs/heads/main`。
- 推完 Cloudflare Pages 约 1 分钟自动重建，记得 Ctrl+F5。

## 更新 3D 演示

改 `3d/` 下的文件即可，路径全部相对，迁入子目录后无需改引用。

若动了 `3d/src/` 里的 JS 逻辑，**必须**重新生成单文件版（不要手改 `offline.html`）：

```bash
cd 3d && bun utils/build-offline.mjs     # 生成 3d/offline.html
node check-offline.mjs                   # 期望 ready=true errors=0
```

资产约定：`3d/assets/watermark.png`（江河海主水印）、`3d/assets/jiayuan_env.png`（嘉元副水印）。
`3d/src/core/App.js` 以相对路径读取这两张图，缺图只退化为文字角标、不报错。

## 站点元信息

| 项 | 取值 |
|---|---|
| 根 `<title>` | 上海嘉元环境科技 · 海水淡化与工业纯水系统 |
| 根 favicon | `assets/img/favicon.ico` + `favicon-32.png` + `favicon.png`(64) + `apple-touch-icon.png`(180) |
| 根 canonical / og:url | `https://swdtwhps.dpdns.org/` |
| 3D `<title>` | 江河海 · 海水淡化全流程 3D 模拟系统 |

换正式域名时同步改三处：根 `index.html` 的 canonical 与 `og:url`、`robots.txt` 的 Sitemap 行、`sitemap.xml` 的 `<loc>`。

## 待办（上线前）

- 询价表单当前是纯前端演示（`toast` 提示），未接后端；需接 Worker/Functions 或第三方表单服务。
- 邮箱、上海直线电话、ICP 备案号在页面上标「待核」。
- 产品图与场景图有集团官网素材与 AI 示意，正式对外前替换为嘉元自有项目照片。
