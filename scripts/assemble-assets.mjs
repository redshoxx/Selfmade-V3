import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const execFileAsync = promisify(execFile);

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

await Promise.all([
  assemble('src/v21/app', 'public/app.js', '/*! HaushaltKlar V21.1 | © 2026 redshoxx | Proprietary. */\n'),
  assemble('src/v21/styles', 'public/styles.css', '/*! HaushaltKlar V21.1 Design System | © 2026 redshoxx | Proprietary. */\n'),
  assemble('src/vercel-api', 'vercel-api.mjs', '/*! HaushaltKlar Server V21.1 | © 2026 redshoxx | Proprietary. */\n'),
  materializeBase64Asset('src/branding/icon-192.png.b64', 'public/icon-192.png'),
  materializeBase64Asset('src/branding/icon-512.png.b64', 'public/icon-512.png'),
  materializeBase64Asset('src/branding/apple-touch-icon.png.b64', 'public/apple-touch-icon.png')
]);

await execFileAsync(process.execPath, ['--check', path.join(root, 'public/app.js')]);
await execFileAsync(process.execPath, ['--check', path.join(root, 'vercel-api.mjs')]);

console.log('HaushaltKlar V21.1 Frontend, API und Branding wurden zusammengesetzt und syntaktisch geprüft.');
