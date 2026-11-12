import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,realpath} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=await realpath(resolve('dist'));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
 if(!['GET','HEAD'].includes(req.method??'')){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 let path;try{path=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end('Bad request');return;}
 const redirects={'/us-expansion/area-developer-vs-master/':'/us-expansion/master-franchise-vs-area-development/','/us-expansion/national-accounts-and-territories/':'/us-expansion/territory-national-accounts/'};
 if(redirects[path]){res.writeHead(301,{Location:redirects[path]});res.end();return;}
 if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"status":"ok"}');return;}
 if(path.includes('\0')||path.includes('\\')||path.split('/').some(p=>p.startsWith('.')&&p!=='')){res.writeHead(404);res.end('Not found');return;}
 let file=resolve(root,'.'+path);let status=200;
 try{let s=await stat(file);if(s.isDirectory()){if(!path.endsWith('/')){res.writeHead(308,{Location:path+'/'});res.end();return;}file=resolve(file,'index.html')}const actual=await realpath(file);if(!actual.startsWith(root+sep))throw Error();file=actual;await stat(file)}catch{file=resolve(root,'404.html');status=404;}
 res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');
 const privateRoute=path==='/plan/'||path.startsWith('/tools/');
 res.setHeader('Cache-Control',privateRoute?'private, no-store':path.startsWith('/_astro/')?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate');
 if(path==='/plan/')res.setHeader('X-Robots-Tag','noindex, nofollow');
 res.writeHead(status);if(req.method==='HEAD'){res.end();return;}const stream=createReadStream(file);stream.on('error',()=>res.end());stream.pipe(res);
});
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Stateside listening on configured port'));
