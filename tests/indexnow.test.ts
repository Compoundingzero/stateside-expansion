import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execute=promisify(execFile);
const repository=resolve(fileURLToPath(new URL('..',import.meta.url)));
const script=join(repository,'scripts/submit-indexnow.mjs');
const host='search-review.example.invalid';
const origin=`https://${host}/`;
const key='a'.repeat(32);
const publicPaths=['/','/guides/example/','/tools/cash-runway/'];
const sitemap=(paths:string[])=>'<urlset>'+paths.map(path=>`<url><loc>${new URL(path,origin)}</loc></url>`).join('')+'</urlset>';

// Every child fetch is replaced before the CLI imports. This harness never opens
// a network connection, including tests of the explicit submission branch.
async function run(args:string[]=[],options:{paths?:unknown;urls?:string[];keyBody?:string;keyLocation?:string;status?:number}={}){
 const directory=await mkdtemp(join(tmpdir(),'eln-indexnow-review-'));
 try{
  await mkdir(join(directory,'config'));
  await writeFile(join(directory,'config/search-monitoring.json'),JSON.stringify({origin,indexNowKey:key,indexNowKeyLocation:options.keyLocation??'/eln-indexnow.txt'}));
  await writeFile(join(directory,'fixture.json'),JSON.stringify({keyBody:options.keyBody??key,sitemap:sitemap(options.urls??publicPaths),status:options.status??200}));
  if(options.paths!==undefined)await writeFile(join(directory,'paths.json'),JSON.stringify(options.paths));
  const preload=`
   import {readFile,writeFile} from 'node:fs/promises';
   const fixture=JSON.parse(await readFile('fixture.json','utf8'));
   const calls=[];
   globalThis.fetch=async(url,init={})=>{
    const href=String(url);const method=init.method??'GET';
    calls.push({url:href,method,body:init.body?JSON.parse(init.body):undefined});
    await writeFile('calls.json',JSON.stringify(calls));
    if(method==='GET'&&href==='${origin}eln-indexnow.txt')return new Response(fixture.keyBody);
    if(method==='GET'&&href==='${origin}sitemap.xml')return new Response(fixture.sitemap);
    if(method==='POST'&&href==='https://api.indexnow.org/indexnow')return new Response('',{status:fixture.status});
    throw new Error('Unexpected mocked request');
   };
  `;
  let stdout='',stderr='',code=0;
  try{const result=await execute(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(preload),script,...args],{cwd:directory,timeout:15000});stdout=result.stdout;stderr=result.stderr;}
  catch(error:any){stdout=error.stdout??'';stderr=error.stderr??'';code=typeof error.code==='number'?error.code:1;}
  const calls=JSON.parse(await readFile(join(directory,'calls.json'),'utf8').catch(()=>'[]'));
  const artifact=await readFile(join(directory,'artifacts/indexnow-submission.json'),'utf8').then(JSON.parse).catch(()=>null);
  return {stdout,stderr,code,calls,artifact};
 }finally{await rm(directory,{recursive:true,force:true});}
}

test('the configured public ownership file exactly matches its identifier',async()=>{
 const config=JSON.parse(await readFile(join(repository,'config/search-monitoring.json'),'utf8'));
 const location=new URL(config.indexNowKeyLocation,config.origin);
 assert.equal(location.origin,new URL(config.origin).origin);
 assert.equal(location.pathname,'/eln-indexnow.txt');
 assert.match(config.indexNowKey,/^[a-f0-9]{32}$/);
 assert.equal((await readFile(join(repository,'public/eln-indexnow.txt'),'utf8')).trim(),config.indexNowKey);
});

test('preview verifies the public key and sitemap without POST or a receipt artifact',async()=>{
 const result=await run();
 assert.equal(result.code,0,result.stderr);
 assert.deepEqual(JSON.parse(result.stdout),{mode:'preview',urls:3,host,keyFileVerified:true});
 assert.deepEqual(result.calls.map((call:any)=>call.method),['GET','GET']);
 assert.equal(result.artifact,null);
});

test('changed-path submission is deduplicated and records acceptance without claiming indexing',async()=>{
 const result=await run(['--paths-file','paths.json','--submit'],{paths:['/guides/example/','/guides/example/'],status:202});
 assert.equal(result.code,0,result.stderr);
 const posts=result.calls.filter((call:any)=>call.method==='POST');
 assert.equal(posts.length,1);
 assert.deepEqual(posts[0].body,{host,key,keyLocation:origin+'eln-indexnow.txt',urlList:[origin+'guides/example/']});
 assert.equal(result.artifact.status,202);
 assert.equal(result.artifact.result,'received-key-validation-pending');
 assert.equal(result.artifact.indexingConfirmed,false);
});

test('unknown, private, foreign and query-bearing paths cannot reach the submission branch',async()=>{
 for(const path of ['/owner/','/api/owner/submissions','/plan/','/unpublished/','https://other.example.invalid/','/guides/example/?private=value']){
  const result=await run(['--paths-file','paths.json','--submit'],{paths:[path]});
  assert.notEqual(result.code,0,path);
  assert.equal(result.calls.some((call:any)=>call.method==='POST'),false,path);
  assert.equal(result.artifact,null,path);
 }
});

test('a private/foreign sitemap, mismatched key or off-host key location fails closed',async()=>{
 for(const options of [{urls:['/','/owner/']},{urls:['/','https://other.example.invalid/']},{keyBody:'wrong-key'},{keyLocation:'https://other.example.invalid/key.txt'}]){
  const result=await run(['--submit'],options);
  assert.notEqual(result.code,0);
  assert.equal(result.calls.some((call:any)=>call.method==='POST'),false);
  assert.equal(result.artifact,null);
 }
});

test('a rejected response is recorded as failed and exits unsuccessfully',async()=>{
 const result=await run(['--submit'],{status:403});
 assert.equal(result.code,1);
 assert.equal(result.artifact.status,403);
 assert.equal(result.artifact.result,'failed');
 assert.equal(result.artifact.indexingConfirmed,false);
});
