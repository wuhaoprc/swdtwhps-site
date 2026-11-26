// 生成单文件离线版 offline.html：file:// 双击即可运行，无需任何外部请求。
// 用法：bun utils/build-offline.mjs   （或 node --experimental-* 不支持，请用 bun）
// 原理：bun 把 src/main.js 连同 vendor/three.module.js 打成一份 ESM 代码
//       再把 index.html 里的图标 / manifest / 模块入口替换成内联内容。
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function dataUri(rel) {
  const abs = path.join(root, rel.replace(/^\.\//, ''));
  if (!existsSync(abs)) throw new Error(`资产缺失: ${rel}`);
  const ext = path.extname(abs).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  return `data:${mime};base64,${readFileSync(abs).toString('base64')}`;
}

// 1) 打包
const build = await Bun.build({
  entrypoints: [path.join(root, 'src/main.js')],
  target: 'browser',
  format: 'esm',
  minify: false,
  sourcemap: 'none',
  splitting: false
});
if (!build.success) {
  for (const log of build.logs) console.error(String(log));
  throw new Error('bun 打包失败');
}
const jsOut = build.outputs.find((o) => o.path.endsWith('.js'));
let js = await jsOut.text();

// 2) 把代码里引用的本地资产换成 data URI
const assetRefs = [...js.matchAll(/["'`](\.\/assets\/[^"'`]+)["'`]/g)].map((m) => m[1]);
const seen = new Set();
for (const ref of assetRefs) {
  if (seen.has(ref)) continue;
  seen.add(ref);
  const uri = dataUri(ref);
  js = js.split(`'${ref}'`).join(`'${uri}'`).split(`"${ref}"`).join(`"${uri}"`).split(`\`${ref}\``).join(`\`${uri}\``);
}

// 3) 改写 index.html
let html = read('index.html');
html = html
  .replace(/\s*<link rel="manifest" href="\.\/manifest\.webmanifest" \/>\n?/, '\n')
  .replace(/href="\.\/assets\/favicon\.png"/, `href="${dataUri('./assets/favicon.png')}"`)
  .replace(/href="\.\/assets\/apple-touch-icon\.png"/, `href="${dataUri('./assets/apple-touch-icon.png')}"`)
  .replace(/<script type="module" src="\.\/src\/main\.js"><\/script>/, () => `<script type="module">\n${js}\n</script>`);

html = html.replace('</head>', `  <!-- 离线单文件版：由 utils/build-offline.mjs 生成；JS/vendor/图标/水印均已内联，file:// 双击即可运行 -->\n</head>`);

const out = 'offline.html';
writeFileSync(path.join(root, out), html);
const kb = (statSync(path.join(root, out)).size / 1024).toFixed(0);
console.log(`已生成 ${out}：${kb} KB，内联资产 ${seen.size} 个，打包代码 ${(js.length / 1024).toFixed(0)} KB`);
