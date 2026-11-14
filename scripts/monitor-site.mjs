import {writeFile,mkdir} from 'node:fs/promises';
const origin=new URL(process.env.ELN_MONITOR_ORIGIN||'https://web-production-b4c2154d.up.railway.app/');
if(origin.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(origin.hostname))throw Error('Monitor requires HTTPS');
const results=[];
async function get(path){
 const expected=new URL(path,origin);
 const response=await fetch(expected,{signal:AbortSignal.timeout(25000),redirect:'error'});
 const body=await response.text();
 results.push({path,status:response.status,bytes:Buffer.byteLength(body)});
 if(response.status!==200)throw Error(`${path}: HTTP ${response.status}`);
 return {body,response};
}
try{
 const {body:health}=await get('/health');if(JSON.parse(health).status!=='ok')throw Error('Health response failed');
 const {body:robots}=await get('/robots.txt');
 if(/Disallow:\s*\/\s*$/m.test(robots))throw Error('Public crawling is blocked');
 if(!robots.includes(`Sitemap: ${new URL('/sitemap.xml',origin)}`))throw Error('Sitemap declaration does not match the live origin');
 const {body:sitemap}=await get('/sitemap.xml');
 const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1].replaceAll('&amp;','&')));
 if(urls.length<100||urls.some(u=>u.origin!==origin.origin||/^\/(owner|api|plan)(\/|$)/.test(u.pathname)))throw Error('Invalid sitemap URL set');
 const sample=[...new Set(['/','/learn/','/tools/us-unit-economics/',...urls.filter(u=>!['/','/guides/','/tools/','/coverage/','/methodology/','/privacy/','/sources/','/interest/','/contact/'].includes(u.pathname)&&!u.pathname.startsWith('/tools/')).filter((_,i,a)=>i===0||i===Math.floor(a.length/2)||i===a.length-1).map(u=>u.pathname)])];
 for(const path of sample){
  const {body,response}=await get(path);
  if(/<meta\s[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(body)||/noindex/i.test(response.headers.get('x-robots-tag')||''))throw Error(`${path}: public page has noindex`);
  const canonical=body.match(/<link\s[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/)?.[1];
  if(canonical!==new URL(path,origin).href)throw Error(`${path}: incorrect canonical`);
  if(!/<title>[^<]+<\/title>/.test(body)||!/<h1[\s>]/.test(body))throw Error(`${path}: missing page content`);
 }
 const {response:owner}=await get('/owner/');
 if(!/noindex/i.test(owner.headers.get('x-robots-tag')||''))throw Error('Owner route is missing HTTP noindex');
 const {body:session}=await get('/api/owner/session');
 if(JSON.parse(session).authenticated!==false)throw Error('Anonymous owner session unexpectedly authenticated');
 await mkdir('artifacts',{recursive:true});
 await writeFile('artifacts/site-monitor.json',JSON.stringify({checkedAt:new Date().toISOString(),origin:origin.origin,status:'passed',sitemapUrls:urls.length,checks:results},null,2)+'\n');
 console.log(`Live HTTP and search-readiness checks passed: ${results.length} requests; ${urls.length} sitemap URLs. Provider ownership and indexing require their account reports.`);
}catch(error){
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/site-monitor.json',JSON.stringify({checkedAt:new Date().toISOString(),origin:origin.origin,status:'failed',error:String(error.message),checks:results},null,2)+'\n');
 throw error;
}
