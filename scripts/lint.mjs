import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(new URL('..', import.meta.url).pathname);
async function files(dir) {
  const out=[];
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...await files(p)); else if(/\.(?:js|mjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}
const targets=[...await files(path.join(root,'src')),...await files(path.join(root,'server')),...await files(path.join(root,'api'))];
for(const file of targets){
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(check.status!==0) throw new Error(`${path.relative(root,file)}: ${check.stderr}`);
  const text=await readFile(file,'utf8');
  if(/https?:\/\/(?:unpkg|cdn\.jsdelivr|cdnjs)\./i.test(text)) throw new Error(`Externe CDN-Abhängigkeit in ${path.relative(root,file)}`);
  if(/service[_-]?role|sb_secret_/i.test(text)) throw new Error(`Verbotener geheimer Schlüsselhinweis in ${path.relative(root,file)}`);
}
console.log(`${targets.length} JavaScript-Dateien geprüft.`);
