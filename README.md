# 江河海 · 海水淡化全流程 3D 模拟系统（发布包）

在线站点：https://swdtwhps.dpdns.org

## 这是什么

基于 Three.js 的海水淡化（SWRO）全流程三维可视化系统。按工艺段拆分建模、逐段可视化，导出（截图 / 动画 / 3D 模型）自动加盖「江河海 JHH」水印。

## 目录结构（这四项必须一起发布，缺一个就白屏）

```
index.html        # 入口，通过 ES Module 加载 src/main.js（必须经 http 提供，双击无效）
src/              # 源码：core / segments / data / ui
vendor/           # 本地化 three.module.js、OrbitControls.js、GLTFExporter.js（无外网依赖）
utils/            # TextureUtils.js（GLTFExporter 依赖）
assets/           # watermark.png（实时水印源图）、favicon.png
offline.html      # 免服务单文件版（1.4 MB，双击即可看；线上作为备用入口）
```

`src/core/App.js` 第 33 行固定读取 `./assets/watermark.png`，删了水印会退化成文字角标。

## 本地预览

```bash
# 方式 A：直接双击 offline.html
# 方式 B：起静态服务（index.html 是 ES Module，file:// 会被 CORS 拦）
npx serve .        # 或任意静态服务器，访问 http://localhost:3000
```

## 更新流程（操作卡）

### 第 1 步：改文件

只改本目录内的文件。改完在本地先看：

```bash
npx serve .        # 访问 http://localhost:3000 确认画面与交互正常
```

若动了 `src/` 里的 JS 逻辑，**必须**回原始工程重新生成单文件版，不能手改 `offline.html`：

```bash
node build-offline.mjs          # 在原工程目录执行，产物 preview-offline.html
# 把 preview-offline.html 覆盖成本目录的 offline.html，再视情况改名为 offline.html
```

`offline.html` 与 `index.html` 的 CSS / HTML 结构目前保持一致，纯 CSS 或纯 HTML 版式改动可两处同步手改；一旦涉及 JS，一律走重新构建。

### 第 2 步：提交（走 GitHub API，不需要 git）

```powershell
powershell -File "D:\Downloads\doubao\push-to-github.ps1" `
  -Token <PAT> -Repo swdtwhps-site -Dir "D:\Downloads\doubao\swdtwhps-site" `
  -Message "fix: 这次改了什么"
```

脚本做四件事：逐文件建 blob → 带 `base_tree` 合树（增量，只挂新内容）→ 建 commit → 更新 `refs/heads/main`。空仓库会先用 Contents API 写一次 README 建分支，否则 `git/blobs` 返回 `409 Git Repository is empty`。

PAT 最小权限：`Contents: Read and write`；如需建新库再加 `Administration: Read and write`。有效期建议 90 天。

### 第 3 步：等重建并验证

Pages 检测到 `main` 变更后自动重建，通常 1-3 分钟。验证不要只看首页能不能打开，按这 4 条查：

| 检查 | 判定标准 |
|---|---|
| 首页 | `https://swdtwhps.dpdns.org` 200，能看到 3D 厂区与底部「工艺段」「参数说明」两个按钮 |
| 资源 | `vendor/three.module.js`、`assets/watermark.png`、`src/main.js` 均 200 |
| 缓存头 | `index.html` 为 `max-age=0, must-revalidate`；`vendor/*` 为一年 `immutable` |
| 控制台 | F12 无红色报错、无 404；水印是图片而非文字角标 |

### 第 4 步：回滚（出错时）

Cloudflare 控制台 → Workers & Pages → `swdtwhps` → Deployments → 选中上一个成功部署 → Rollback。只认成功构建过的生产部署，秒级生效。注意：回滚的是**部署**，仓库里的错误代码还在，要同步改回来，否则下次 push 又会覆盖。

## 更新能力的边界

| 能做 | 不能做 |
|---|---|
| 改任意文件（HTML/CSS/JS/图片/`_headers`/`robots.txt`）并触发重建 | 改 Pages 构建参数、加删自定义域、开关 Always Use HTTPS / HSTS |
| 建仓库、查提交历史、读写文件 | Rollback 到历史部署、改环境变量、配 Cloudflare Access |
| 增量提交，删除的文件同步消失（tree 里不出现即删除） | 操作 `dpdns.org` 的 DNS 记录 |

原因是这个令牌是 **GitHub PAT**，只作用于仓库。Cloudflare 侧的配置变更要么在控制台点，要么另配一个 Cloudflare API Token（`Account:Cloudflare Pages:Edit` + `Zone:DNS:Edit`）。

## 已知的移动端行为（改版时别踩回去）

- 窄屏（≤1200px）下 `#panel` 与 `#hud` 默认收起，靠底部两个 `.tab-btn` 唤出；两者互斥，点面板外遮罩或按 Esc 收起。这段逻辑在 `index.html` / `offline.html` 的内联 `<script>` 里，`src/ui/UI.js` 只负责填充内容，不控制显隐。
- 窄屏面板从 `top: 58px` 起，是给顶部标题栏让位；标题栏 `z-index: 11` 高于面板，若把面板顶回 8px 会出现标题压住面板抬头。
- `scrollbar-width` **不继承**，只写在 `html/body` 上无效，必须写在 `#panel`、`#hud` 的规则里。
- 竖屏下 3D 画面左右会被裁（透视相机垂直 FOV 固定，竖屏时水平 FOV 收窄），属相机取景问题，与面板无关。


## 发布边界（不要提交进仓库）

- `node_modules/`（Playwright 等构建期依赖，约 15 MB）
- `preview-*.png`、`*-审阅.png` 等迭代截图（约 40 MB，仅过程留档）
- 其他版本 html（厂区总平面图、地块总平面图等属于并行交付物，另行归档）

## 部署参数（Cloudflare Pages）

| 项 | 值 |
|---|---|
| 框架预设 | None |
| 构建命令 | 留空 |
| 输出目录 | `/` |
| 根目录 | 空（仓库根就是站点根） |
| 自定义域 | `swdtwhps.dpdns.org`（CNAME → `<project>.pages.dev`） |
