import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createV15Handler } from './server/v15-api.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const api=createV15Handler();
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  if(req.url?.startsWith('/api/')) return api(req,res);
  const raw=new URL(req.url||'/', 'http://localhost').pathname;
  const relative=raw==='/'?'public/index.html':raw.startsWith('/src/')?raw.slice(1):`public${raw}`;
  const file=path.normalize(path.join(root,relative));
  if(!file.startsWith(root)) {res.writeHead(403);return res.end();}
  try { const info=await stat(file); if(!info.isFile()) throw new Error(); const body=await readFile(file); res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}); res.end(body); }
  catch { try { const body=await readFile(path.join(root,'public/index.html')); res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(body);} catch {res.writeHead(404);res.end('Not found');} }
});
server.listen(Number(process.env.PORT||4173),process.env.HOST||'127.0.0.1',()=>console.log('Selfmade V15 http://127.0.0.1:4173'));
