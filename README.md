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

## 更新流程

1. 改 `src/` 下源码
2. 重新生成离线单文件：`node build-offline.mjs`（在原始工程目录执行，依赖 esbuild）
3. 把新的 `preview-offline.html` 覆盖为本目录的 `offline.html`
4. 提交并 push，Cloudflare Pages 自动重建

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
