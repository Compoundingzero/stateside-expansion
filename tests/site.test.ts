import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const dist=resolve('dist');
async function walk(dir:string):Promise<string[]>{const result:string[]=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())result.push(...await walk(path));else result.push(path)}return result;}
test('all generated public local links and fragments resolve; unpublished guides are absent',async()=>{
 const files=(await walk(dist)).filter(f=>f.endsWith('.html'));
 const merged=new Set(['/us-expansion/area-developer-vs-master/','/us-expansion/national-accounts-and-territories/']);
 for(const file of files){const html=await readFile(file,'utf8');for(const m of html.matchAll(/\bhref="([^"]*)"/g)){
  const href=m[1].replaceAll('&amp;','&');if(!href||!href.startsWith('/')||href.startsWith('//'))continue;
  const u=new URL(href,'http://local');if(merged.has(u.pathname))continue;let target=resolve(dist,'.'+decodeURIComponent(u.pathname));if(u.pathname.endsWith('/'))target=resolve(target,'index.html');
  assert.ok((await stat(target).catch(()=>null))?.isFile(),`${file}: broken ${href}`);
  if(u.hash){const body=target===file?html:await readFile(target,'utf8');const id=decodeURIComponent(u.hash.slice(1));assert.ok(body.includes(`id="${id}"`),`${file}: missing anchor ${href}`)}
 }}
 const paths=(await readFile(resolve(dist,'sitemap.xml'),'utf8')).match(/<loc>[^<]+<\/loc>/g)??[];
 assert.ok(paths.length>100);assert.ok(paths.every(p=>!p.includes('/plan/')));
 assert.ok((await readFile(resolve(dist,'plan/index.html'),'utf8')).includes('noindex,nofollow'));
 const guides=(await Promise.all((await readdir('src/data')).filter(file=>file.endsWith('guides.json')).map(async file=>JSON.parse(await readFile(resolve('src/data',file),'utf8'))))).flat();
 for(const guide of guides){
  if(guide.mergedInto)continue;
  const generated=await stat(resolve(dist,'.'+guide.path,'index.html')).catch(()=>null);
  if(guide.status==='published')assert.ok(generated?.isFile(),guide.path+' must be generated');
  else assert.equal(generated,null,guide.path+' must remain unpublished');
 }
});
test('guides are readable without JavaScript and carry sources and canonical metadata',async()=>{
 for(const path of ['states/texas','fdd/item-15','us-expansion/minimum-payment-exemption','cases/cleaning-manager-royalty']){
 const html=await readFile(resolve(dist,path,'index.html'),'utf8');assert.ok(html.includes('rel="canonical"'));assert.ok(html.includes('Sources &amp; review notes')||html.includes('Sources & review notes'));assert.ok(html.includes('<h1>'));assert.ok(html.includes('AI-assisted'));assert.equal((html.match(/data-forward-cta/g)??[]).length,1);
 }
 const threshold=await readFile(resolve(dist,'us-expansion/minimum-payment-exemption/index.html'),'utf8');assert.ok(threshold.includes('$735'));
});

test('every public tool has a readable title and purpose in its initial HTML without exposing a plan',async()=>{
 const tools=JSON.parse(await readFile('src/data/tool-definitions.json','utf8'));
 for(const tool of tools){
  const html=await readFile(resolve(dist,'.'+tool.path,'index.html'),'utf8');
  const body=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  assert.equal((body.match(/<h1[\s>]/g)||[]).length,1,tool.path+' needs one server-rendered title');
  const description=html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(description&&body.includes('<p class="lede">'+description+'</p>'),tool.path+' needs its public explanation');
  const start=body.indexOf('<div class="planning-shell"'),end=body.indexOf('</astro-island>',start);
  assert.ok(start>=0&&end>start,tool.path+' needs its public initial shell');
  assert.ok(!/<(?:input|textarea|select)\b/.test(body.slice(start,end)),tool.path+' must not server-render planning inputs');
 }
});
