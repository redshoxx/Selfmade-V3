import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve('node_modules/@zxing/browser/umd/zxing-browser.min.js');
const target = path.resolve('public/vendor/zxing-browser.min.js');
await mkdir(path.dirname(target), { recursive: true });
await copyFile(source, target);
const info = await stat(target);
if (info.size < 100_000) throw new Error('ZXing-Vendor-Datei ist unvollständig.');
console.log(`ZXing lokal bereitgestellt (${info.size} Bytes).`);
