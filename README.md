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

资产说明：`assets/watermark.png`（江河海主水印源图）、`assets/jiayuan_env.png`（嘉元环境副水印）、`favicon.png`、`apple-touch-icon.png`、`icon-192.png`、`icon-512.png`。

`src/core/App.js` 第 33 行固定读取 `./assets/watermark.png`，删了水印会退化成文字角标；副 logo 由同一处传入 `extraLogoSrc: './assets/jiayuan_env.png'`，缺图时只画主 logo，不报错。

## 站点元信息（浏览器标签页 / 收藏 / 主屏图标）

| 位置 | 取值 | 用在哪 |
|---|---|---|
| `<title>` | 江河海 · 海水淡化全流程 3D 模拟系统 | 浏览器标签页、收藏夹默认名 |
| `description` | 七段工艺逐段建模、可导出 | 搜索结果摘要、分享预览 |
| `og:*` | 同名标题 + 简介 + `og:url` | 微信/飞书等平台分享卡片 |
| `theme-color` | `#0b1220` | 手机浏览器地址栏配色 |
| `manifest.webmanifest` | `name` / `short_name`「海水淡化 3D」 | 「添加到主屏幕」后的图标名 |
| `apple-touch-icon` | 180×180（favicon 压深色底） | iOS 主屏图标，避免系统自动补黑边 |

改名字要同时改三处：`<title>`、`og:title`/`og:site_name`、`manifest` 的 `name` / `short_name`（`short_name` 建议 ≤ 6 个汉字，主屏上不截断）。


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
| 缓存头 | `index.html` 为 `public, max-age=0, must-revalidate`；`assets/*` 7 天；`vendor/*` 一年 |
| 控制台 | F12 无红色报错、无 404；底部是「江河海 + 嘉元环境」两个 logo |

> **`src/*.js` 的缓存头压不住（2026-11-13 实测结论，别再反复试）**：Cloudflare Pages 对非 HTML 资源强制下发 `max-age=14400`，`_headers` 里写 `max-age=0`、`no-cache`，甚至先 `! Cache-Control` 删掉默认头再加，都会被打回 `max-age=14400`（`no-cache` 直接被剥离）。所以改完代码后**自己强刷一次**（Ctrl+F5 / 手机上关标签页重开），再核对 Deployments 最新部署状态。想做"用户无需强刷"，得换思路：把 `src/` 发布成带版本号的目录（如 `src-v20261113/`）并在 `index.html` 里改入口路径，URL 变了浏览器自然取新文件——代价是每次发版多一份副本，仓库里旧版本要显式删除。

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
- **触摸手势已按移动端习惯改写**：`SceneManager` 构造里 `controls.touches = { ONE: PAN, TWO: DOLLY_ROTATE }` —— 单指平移、双指拖动旋转、双指捏合仍为缩放；鼠标端行为不变（左键旋转、右键平移）。
- 因为单指就是平移了，`App._bindPicking` 的点击抖动阈值对 touch 放宽到 12px（鼠标仍是 5px），否则轻触选不中厂房。
- **竖屏取景**：`SceneManager.fitDistance(base, {fit, width})`，仅当 `aspect < 1.2` 生效，把 `width` 个世界单位铺满画面宽度；全景视角在 `PlantSceneSegment` 的 `view` 里声明 `fit: true, fitWidth: 135`，近景段（dist 20 左右）不声明即保持原距离。宽视口原样返回，桌面取景完全不变。**不要用 group 包围盒反算**：厂区 group 含远山与海面，会把镜头甩到天边。
- 拉远取景后会看到海面平面的边界（画面下方的深色楔形），属场景范围边界，非渲染故障。
- `offline.html` 由原工程 `node build-offline.mjs` 生成，骨架取原工程的 `index.html` —— 该文件已同步为本目录版本（含移动端 CSS / 按钮 / 开关脚本），改动时两边保持一致再构建。

## 水印（角标）实现要点

- 屏幕上的「江河海 / 嘉元环境」不是 HTML，是 `src/core/Watermark.js` 每帧画到覆盖层 canvas 的角标；导出（截图 / 录像 / glTF）走同一套绘制，所以改水印两边同时生效。
- **`#wm-canvas` 必须显式 `width:100%; height:100%`**。canvas 是替换元素，只写 `inset:0` 不会把它的 CSS 尺寸拉到容器，高分屏上会按位图尺寸（如 2880×1800）铺开，水印整个跑到视口外——dpr≥2 的 Retina 与手机上一度完全看不见。
- 画布坐标系是**设备像素**：角标尺寸按短边比例算，天然与 dpr 无关，**不要再乘 dpr**（乘了会大整整一倍，2026-11-13 踩过）。只有 `margin`、`bottomLift` 这类 CSS 像素量才乘 `Watermark.dpr`（由 `App._syncWm` 按 `gl.width / innerWidth` 注入）。
- 窄屏（≤1200px）两个 logo **水平居中**（`centerH`），并 `bottomLift = 62`（CSS px）抬到底部「工艺段 / 参数说明」胶囊按钮上方；桌面端保持左下角。实现上两个 logo 作为一个整体 `pairW = lw + gap + w2` 参与定位，不再分别定位。
- 副 logo 位置：`corner` 为 `bl`/`tl` 时画在主 logo 右侧，`br`/`tr` 时整组右对齐（副 logo 仍在主 logo 右侧）；等高（`lh`）、按裁剪后宽高比定宽、间距 `lh*0.45`。
- 嘉元 logo 原图字色是深藏青 `#052F7F`，深色底上不可见，`_prepareExtra()` 把 `R<70 / G<100 / B>90` 的像素重着色成浅蓝白 `#CFE0F6`，绿色 ENV 块与白字保持原样；抗锯齿边缘靠原 alpha 自然过渡，不要改成整体反色（反色会把绿色块变品红）。

## 集装箱「变透明」的材质清单（改门/改结构时看这里）

`PlantSceneSegment.js` 里每只工艺舱有 4 个可淡出的材质，`focus()` 与 `resetView()` 必须**同时**处理这四个，漏一个就会出现「箱体透了、某个部件还是实心」：

| 材质 | 用在 | 聚焦时 | 其余段 | 全景复位 |
|---|---|---|---|---|
| `wallMat` | 箱体侧板 + 瓦楞板 | 0.10 | 0.30 | 1.0 |
| `roofMat` | 波纹顶板 | 0.13 | 0.38 | 1.0 |
| `doorMat` | 端门门框 + 两个把手 | 0.14 | 0.34 | 1.0 |
| `leafMat` | 端门两片门叶 | 0.14 | 0.34 | 1.0 |

- **门框/把手不能用共用的 `steel`**：`steel` 同时给四角角件和底架用，如果门也用它，淡出就会连带角件底架一起变透明（结构件本应保持实心）。2026-11-13 之前门用 `steel`，结果点厂房后箱体透了、门还是实心。
- 段标牌 `plate`（箱号）刻意保持不透明，便于识别是哪一段；`edgeMat` 是线框，聚焦时反而加亮到 1.0（其余 0.55），透明状态下靠它标出箱体边界。

## 七段标注的排位规则（`_labels()`）

- 默认：`y = groundY + s.h + 2.6 + (i%2 ? 3.5 : 0)`，`z = -1 - (i%2 ? 6.0 : 0)`，即相邻两段上下/前后交错；`xoff` 只对 `x<-25`、`x<-15` 的历史补偿生效。
- **「一 取水段」「二 预处理段」走显式偏移表 `TWEAK`**，不再吃默认规则。原因：默认补偿把「一」推到 x=-15、「二」推到 x=-16，投影后「一」与「三 UF/MF」的屏幕坐标只差约 14 px，两行字直接叠死。现取值 `intake {dx:-1, dy:9}`、`pretreatment {dx:6, dy:4.5}`，形成自左向右递减的台阶，各自落在自家厂房上方。
- 「全流程总览」标签左移到 `x=-40.5`，给「二 预处理段」留出横向空间（原来两者只差 44 px 会贴字）。
- **两个海域环境标注避开左侧面板**：`海域 · 海水取水区` 由 `V(-22, 2.0, 46)` 改为 `V(4, 2.0, 40)`，`海水取水头部` 由 `V(-36, 2.2, 44)` 改为 `V(-10, 2.2, 38)`（东移 26、向岸收 6）。原因：1440×900 下左侧 `#panel` 横跨 x 14..278，原投影框分别落在 181..313 与 166..246，左半截被面板压住；改后为 315..443 与 289..372，整条落在面板右侧，仍压在海面上且保持「头部左上、海域右下」的相对关系。390 宽下这两条也从原来的贴左边缘（-16..44）变为完整可见。
- 调完必须用投影脚本量屏幕坐标，别凭手感：标注坐标随相机取景（`view.target/dir/dist/fitWidth`）联动，改了取景就要重算。




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
