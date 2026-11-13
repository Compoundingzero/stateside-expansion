import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,realpath,readFile} from 'node:fs/promises';
import {resolve,extname,sep,join} from 'node:path';
import {isIP} from 'node:net';
import {createSubmissionService} from './src/server/submissions.mjs';
import {prepareBoardStorage} from './runtime-storage.mjs';
import {searchVerificationMeta,addSearchVerification} from './src/server/search-verification.mjs';
import {startBackupScheduler} from './src/server/backups.mjs';
const verificationMeta=searchVerificationMeta();
const dataDirectory=await prepareBoardStorage({directory:process.env.ELN_DATA_DIRECTORY||'data'});
const origin=process.env.PUBLIC_SITE_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`:`http://127.0.0.1:${Number(process.env.PORT)||3000}`);
const boardDatabaseAlreadyPresent=Boolean(await stat(join(dataDirectory,'eln.sqlite')).catch(()=>null));
const submissionService=createSubmissionService({dbPath:join(dataDirectory,'eln.sqlite'),setupToken:process.env.ELN_SETUP_TOKEN||'',origin,secureCookies:new URL(origin).protocol==='https:',retentionDays:Number(process.env.ELN_RETENTION_DAYS)||365,runOwnerBackup:()=>backups.runNow(),getClientAddress:req=>{const edge=req.headers['x-real-ip'];return process.env.RAILWAY_ENVIRONMENT_ID&&typeof edge==='string'&&isIP(edge)?edge:req.socket.remoteAddress||'unknown';}});
const backups=startBackupScheduler({dbPath:join(dataDirectory,'eln.sqlite')});
const root=await realpath(resolve('dist'));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
 try{if(await submissionService.handle(req,res))return;}catch{if(!res.headersSent){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify({error:'The service is temporarily unavailable.'}));}else res.destroy();return;}
 if(!['GET','HEAD'].includes(req.method??'')){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 let path;try{path=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end('Bad request');return;}
 const redirects={'/us-expansion/area-developer-vs-master/':'/us-expansion/master-franchise-vs-area-development/','/us-expansion/national-accounts-and-territories/':'/us-expansion/territory-national-accounts/'};
 if(redirects[path]){res.writeHead(301,{Location:redirects[path]});res.end();return;}
 if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"status":"ok"}');return;}
 if(path.includes('\0')||path.includes('\\')||path.split('/').some(p=>p.startsWith('.')&&p!=='')){res.writeHead(404);res.end('Not found');return;}
 let file=resolve(root,'.'+path);let status=200;
 try{let s=await stat(file);if(s.isDirectory()){if(!path.endsWith('/')){res.writeHead(308,{Location:path+'/'});res.end();return;}file=resolve(file,'index.html')}const actual=await realpath(file);if(!actual.startsWith(root+sep))throw Error();file=actual;await stat(file)}catch{file=resolve(root,'404.html');status=404;}
 res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');
 const privateRoute=path==='/plan/'||path.startsWith('/tools/')||path.startsWith('/owner/');
 res.setHeader('Cache-Control',privateRoute?'private, no-store':path.startsWith('/_astro/')?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate');
 if(path==='/plan/'||path.startsWith('/owner/'))res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(path==='/'&&status===200&&verificationMeta){const html=addSearchVerification(await readFile(file,'utf8'),verificationMeta);res.writeHead(status);res.end(req.method==='HEAD'?undefined:html);return;}
 res.writeHead(status);if(req.method==='HEAD'){res.end();return;}const stream=createReadStream(file);stream.on('error',()=>res.end());stream.pipe(res);
});
server.on('close',()=>submissionService.close());
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close(async()=>{await backups.stop();process.exit(0);});setTimeout(()=>process.exit(0),10000).unref();});
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>{console.log('ELN listening on configured port');console.log(JSON.stringify({event:'eln-storage-ready',uid:typeof process.getuid==='function'?process.getuid():null,persistentVolume:process.env.RAILWAY_VOLUME_MOUNT_PATH==='/data',existingDatabase:boardDatabaseAlreadyPresent}));});
