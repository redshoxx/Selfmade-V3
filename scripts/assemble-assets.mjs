import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function materializeBase64Asset(sourceFile, outputFile) {
  const encoded = (await readFile(path.join(root, sourceFile), 'utf8')).trim();
  await writeFile(path.join(root, outputFile), Buffer.from(encoded, 'base64'));
}

async function assemble(sourceDirectory, outputFile, banner = '') {
  const source = path.join(root, sourceDirectory);
  const parts = (await readdir(source)).filter((name) => name.startsWith('part-')).sort();
  if (!parts.length) throw new Error(`Keine Asset-Teile in ${sourceDirectory} gefunden.`);
  const buffers = await Promise.all(parts.map((name) => readFile(path.join(source, name))));
  await writeFile(path.join(root, outputFile), Buffer.concat([Buffer.from(banner), ...buffers]));
}

await assemble('src/app', 'public/app.js', '/*! HaushaltKlar V20.0 | © 2026 redshoxx | Proprietary – All Rights Reserved | No cloning, scraping, AI training or TDM without written permission. */\n');
await assemble('src/styles', 'public/styles.css', '/*! HaushaltKlar Living Canvas Design System V20.0 | © 2026 redshoxx | Proprietary – All Rights Reserved. */\n');
await assemble('src/vercel-api', 'vercel-api.mjs', '/*! HaushaltKlar Server V20.0 | © 2026 redshoxx | Proprietary. */\n');
await Promise.all([
  materializeBase64Asset('src/branding/icon-192.png.b64', 'public/icon-192.png'),
  materializeBase64Asset('src/branding/icon-512.png.b64', 'public/icon-512.png'),
  materializeBase64Asset('src/branding/apple-touch-icon.png.b64', 'public/apple-touch-icon.png')
]);
console.log('App-, API- und Branding-Assets wurden vollständig zusammengesetzt.');
