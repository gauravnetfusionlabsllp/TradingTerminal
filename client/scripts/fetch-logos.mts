// Downloads github.com/nvstly/icons logos for an MT5 symbol list into public/logos and rewrites src/lib/logos.json.
// Run: npx tsx scripts/fetch-logos.mts <symbols-file>   (any text with 'quoted' names, e.g. a pasted Python list)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { logoKeys } from '../src/lib/logos.ts';

const ROOT = new URL('../public/logos/', import.meta.url);
const MANIFEST = new URL('../src/lib/logos.json', import.meta.url);
const REMOTE_DIR: Record<string, string> = { fx: 'forex_icons', crypto: 'crypto_icons', stock: 'ticker_icons' };
const remotePath = (key: string) => { const [dir, name] = key.split('/'); return `${REMOTE_DIR[dir]}/${name}.png`; };

const symbols = [...new Set([...readFileSync(process.argv[2], 'utf8').matchAll(/'([^']+)'/g)].map((m) => m[1]))];
const res = await fetch('https://api.github.com/repos/nvstly/icons/git/trees/main?recursive=1');
if (!res.ok) throw new Error(`GitHub tree: ${res.status}`);
const remote = new Set((await res.json() as { tree: { path: string }[] }).tree.map((t) => t.path));

const want = new Set<string>();
let matched = 0;
for (const s of symbols) {
  const keys = logoKeys(s);
  if (!keys.length || !keys.every((k) => remote.has(remotePath(k)))) continue;
  matched++;
  keys.forEach((k) => want.add(k));
}

const todo = [...want].filter((k) => !existsSync(new URL(`${k}.png`, ROOT)));
for (let i = 0; i < todo.length; i += 16) {
  await Promise.all(todo.slice(i, i + 16).map(async (key) => {
    const r = await fetch(`https://raw.githubusercontent.com/nvstly/icons/main/${remotePath(key)}`);
    if (!r.ok) throw new Error(`${key}: ${r.status}`);
    mkdirSync(new URL(`${key.split('/')[0]}/`, ROOT), { recursive: true });
    writeFileSync(new URL(`${key}.png`, ROOT), Buffer.from(await r.arrayBuffer()));
  }));
}

const onDisk = Object.keys(REMOTE_DIR).flatMap((dir) =>
  existsSync(new URL(`${dir}/`, ROOT)) ? readdirSync(new URL(`${dir}/`, ROOT)).map((f) => `${dir}/${f.replace(/\.png$/, '')}`) : []);
writeFileSync(MANIFEST, JSON.stringify(onDisk.sort()) + '\n');
console.log(`${symbols.length} symbols, ${matched} with logos, ${todo.length} downloaded, ${onDisk.length} files in public/logos`);
