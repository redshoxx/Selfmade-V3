import http from 'node:http'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readFile,stat} from 'node:fs/promises'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
const productHandler=require('./api/product-lookup.js')
const importHandler=require('./api/import-transaction.js')
const lidlFlyerHandler=require('./api/lidl-flyers.js')
const lidlStoreHandler=require('./api/lidl-store-offers.js')
const __dirname=path.dirname(fileURLToPath(import.meta.url))
const DIST=path.join(__dirname,'dist')
const PORT=Math.max(1,Math.min(65535,Number(process.env.PORT)||3200))
const HOST=process.env.HOST||'127.0.0.1'
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'}

function apiResponse(res){return{status(code){res.statusCode=code;return this},setHeader(name,value){res.setHeader(name,value);return this},json(body){if(!res.headersSent)res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));return body}}}
async function body(req){if(req.method==='GET'||req.method==='HEAD')return undefined;let total=0,chunks=[];for await(const chunk of req){total+=chunk.length;if(total>1024*1024)throw new Error('request_too_large');chunks.push(chunk)}if(!chunks.length)return{};const text=Buffer.concat(chunks).toString('utf8');if((req.headers['content-type']||'').includes('application/json')){try{return JSON.parse(text)}catch{return text}}return text}
async function runApi(handler,req,res,url){try{req.query=Object.fromEntries(url.searchParams.entries());req.body=await body(req);req.headers['x-forwarded-proto']=req.headers['x-forwarded-proto']||'http';req.headers['x-forwarded-host']=req.headers['x-forwarded-host']||req.headers.host;await handler(req,apiResponse(res))}catch(error){console.error('API error',error);if(!res.headersSent){res.statusCode=500;res.setHeader('Content-Type','application/json; charset=utf-8')}if(!res.writableEnded)res.end(JSON.stringify({ok:false,error:'local_api_error'}))}}
function safeFile(urlPath){let p;try{p=decodeURIComponent(urlPath)}catch{p='/'};p=p.replace(/\\/g,'/');if(p.includes('\0'))return null;const rel=path.posix.normalize('/'+p).replace(/^\/+/,''),full=path.resolve(DIST,rel);return full.startsWith(path.resolve(DIST)+path.sep)||full===path.resolve(DIST)?full:null}
async function exists(file){try{const s=await stat(file);return s.isFile()}catch{return false}}
async function serveStatic(req,res,url){let pathname=url.pathname;if(pathname==='/')pathname='/index.html';let file=safeFile(pathname);if(!file){res.statusCode=400;return res.end('Bad request')}if(!(await exists(file))&&!path.extname(file)){const html=file+'.html';if(await exists(html))file=html}if(!(await exists(file)))file=path.join(DIST,'index.html');try{const data=await readFile(file),ext=path.extname(file).toLowerCase();res.statusCode=200;res.setHeader('Content-Type',MIME[ext]||'application/octet-stream');if(path.basename(file)==='index.html'||path.basename(file)==='sw.js')res.setHeader('Cache-Control','no-cache, no-store, must-revalidate');else res.setHeader('Cache-Control','public, max-age=3600');if(req.method==='HEAD')return res.end();res.end(data)}catch(error){console.error(error);res.statusCode=500;res.end('NEST konnte die Datei nicht laden')}}

const server=http.createServer(async(req,res)=>{const url=new URL(req.url||'/',`http://${req.headers.host||`${HOST}:${PORT}`}`);if(url.pathname==='/api/product-lookup')return runApi(productHandler,req,res,url);if(url.pathname==='/api/import-transaction')return runApi(importHandler,req,res,url);if(url.pathname==='/api/lidl-flyers')return runApi(lidlFlyerHandler,req,res,url);if(url.pathname==='/api/lidl-store-offers')return runApi(lidlStoreHandler,req,res,url);return serveStatic(req,res,url)})
server.listen(PORT,HOST,()=>{console.log('');console.log('========================================');console.log(' NEST 4.3 lokaler Server läuft');console.log(` http://localhost:${PORT}`);console.log(' Lidl Liebenau: Angebote + Flugblätter aktiv');console.log(' Stammfiliale: Liebenauer Hauptstrasse 164');console.log(' Zum Beenden STRG+C drücken');console.log('========================================');console.log('')})
