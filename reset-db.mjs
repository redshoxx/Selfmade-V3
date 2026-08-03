import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dbPath = path.resolve(process.env.DATABASE_PATH ?? path.join(root, 'data', 'selfmade.sqlite'));
await rm(dbPath, { force: true });
await rm(`${dbPath}-shm`, { force: true });
await rm(`${dbPath}-wal`, { force: true });
console.log(`Datenbank gelöscht: ${dbPath}`);
