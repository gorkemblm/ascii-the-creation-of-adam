import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const withoutImports = code => code.replace(/^import .*?;\n/gm, '');
const parts = await Promise.all([
  read('src/hand-tones.js'),
  read('src/hands.js'),
  read('src/renderer.js'),
  read('src/ascii-creation.js'),
]);
const bundle = parts.map((part, index) => {
  const code = withoutImports(part);
  return index === parts.length - 1 ? code : code.replace(/^export /gm, '');
}).join('\n');

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/ascii-creation.js', root), bundle);
await copyFile(new URL('src/ascii-creation.d.ts', root), new URL('dist/ascii-creation.d.ts', root));

let html = await read('index.html');
html = html.replace('<link rel="stylesheet" href="./style.css">', `<style>\n${await read('style.css')}\n</style>`);
html = html.replace('  <script type="module" src="./src/demo.js"></script>\n', '');
html = html.replace('</body>', `<script type="module">\n${bundle.replace(/^export /gm, '')}\n${withoutImports(await read('src/demo.js'))}\n</script>\n</body>`);
await writeFile(new URL('preview.html', root), html);
console.log('Built dist/ascii-creation.js, TypeScript declarations, and preview.html.');
