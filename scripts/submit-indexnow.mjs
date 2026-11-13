import {readFile,writeFile,mkdir} from 'node:fs/promises';
const config=JSON.parse(await readFile('config/search-monitoring.json','utf8'));
const origin=new URL(config.origin);
if(origin.protocol!=='https:'||!/^[a-f0-9]{32}$/.test(config.indexNowKey))throw Error('Invalid public search configuration');
const keyLocation=new URL(config.indexNowKeyLocation,origin);
if(keyLocation.origin!==origin.origin)throw Error('IndexNow ownership file must be on this host');
async function get(url){const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(25000)});if(response.status!==200)throw Error(`Live search resource HTTP ${response.status}`);return response.text();}
if((await get(keyLocation)).trim()!==config.indexNowKey)throw Error('The live IndexNow ownership file does not match');
const sitemap=await get(new URL('/sitemap.xml',origin));
const published=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1].replaceAll('&amp;','&')));
if(!published.length||published.some(u=>u.origin!==origin.origin||/^\/(owner|api|plan)(\/|$)/.test(u.pathname)))throw Error('Invalid public sitemap');
const fileIndex=process.argv.indexOf('--paths-file');
const requested=fileIndex<0?published.map(u=>u.href):JSON.parse(await readFile(process.argv[fileIndex+1],'utf8')).map(path=>new URL(path,origin).href);
const urls=[...new Set(requested)];
if(!urls.length||urls.length>10000||urls.some(url=>!published.some(u=>u.href===url)))throw Error('Submit only current public sitemap URLs (at most 10,000)');
if(!process.argv.includes('--submit')){console.log(JSON.stringify({mode:'preview',urls:urls.length,host:origin.host,keyFileVerified:true}));process.exit(0);}
const response=await fetch('https://api.indexnow.org/indexnow',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({host:origin.host,key:config.indexNowKey,keyLocation:keyLocation.href,urlList:urls})});
await response.body?.cancel();
const result={submittedAt:new Date().toISOString(),host:origin.host,urls:urls.length,status:response.status,result:response.status===200?'received':response.status===202?'received-key-validation-pending':'failed',indexingConfirmed:false};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/indexnow-submission.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
if(![200,202].includes(response.status))process.exitCode=1;
