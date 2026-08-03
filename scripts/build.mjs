import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'public'), output, { recursive: true });
await cp(path.join(root, 'src'), path.join(output, 'src'), { recursive: true });
for (const required of ['index.html','manifest.webmanifest','sw.js','src/app.js']) {
  const info = await stat(path.join(output, required));
  if (!info.isFile() || info.size === 0) throw new Error(`Build-Asset fehlt: ${required}`);
}
console.log('Selfmade V15 Build erstellt:', output);
