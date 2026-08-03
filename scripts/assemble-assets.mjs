import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function assemble(sourceDirectory, outputFile) {
  const source = path.join(root, sourceDirectory);
  const parts = (await readdir(source)).filter((name) => name.startsWith('part-')).sort();
  if (!parts.length) throw new Error(`Keine Asset-Teile in ${sourceDirectory} gefunden.`);
  const buffers = await Promise.all(parts.map((name) => readFile(path.join(source, name))));
  await writeFile(path.join(root, outputFile), Buffer.concat(buffers));
}

await assemble('src/app', 'public/app.js');
await assemble('src/styles', 'public/styles.css');
await assemble('src/vercel-api', 'vercel-api.mjs');
console.log('App- und API-Assets wurden vollständig zusammengesetzt.');
