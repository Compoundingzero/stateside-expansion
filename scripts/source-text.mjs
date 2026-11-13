import {createHash} from 'node:crypto';
export const NORMALIZATION_VERSION=5;
const entity=(text)=>text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|lsquo|rsquo|ldquo|rdquo|ndash|mdash);|&#(?:x[0-9a-f]+|[0-9]+);/gi,s=>{
 const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' ','&lsquo;':'‘','&rsquo;':'’','&ldquo;':'“','&rdquo;':'”','&ndash;':'–','&mdash;':'—'};if(named[s.toLowerCase()])return named[s.toLowerCase()];const code=parseInt(s.slice(s[2].toLowerCase()==='x'?3:2,-1),s[2].toLowerCase()==='x'?16:10);return Number.isFinite(code)&&code<=0x10ffff?String.fromCodePoint(code):s;
});
function withoutNonContentElements(html) {
 const cleaned=html.replace(/<!--[^]*?-->/g,' ').replace(/<(script|style|template)\b[^>]*>[^]*?<\/\1>/gi,' ');
 const token=/<\/?(nav|header|footer)\b[^>]*>/gi;let depth=0,start=0,last=0,out='',match;
 while((match=token.exec(cleaned))){
  if(/^<\//.test(match[0])){if(depth>0&&--depth===0){out+=cleaned.slice(last,start)+' ';last=token.lastIndex;}}
  else if(!/\/\s*>$/.test(match[0])){if(depth===0)start=match.index;depth++;}
 }
 return depth?out+cleaned.slice(last,start):out+cleaned.slice(last);
}
function publisherCopyContainers(html) {
 const cleaned=withoutNonContentElements(html),containers=[];
 const startTag=/<([a-z][a-z0-9:-]*)\b[^>]*class\s*=\s*(["'])([^"']*\btsg-rwd-main-copy-frame\b[^"']*)\2[^>]*>/gi;let match;
 while((match=startTag.exec(cleaned))){
  const tag=match[1],tokens=new RegExp('<\\/?'+tag+'\\b[^>]*>','gi');tokens.lastIndex=startTag.lastIndex;let depth=1,next;
  while((next=tokens.exec(cleaned))){if(/^<\//.test(next[0]))depth--;else if(!/\/\s*>$/.test(next[0]))depth++;if(depth===0){containers.push(cleaned.slice(startTag.lastIndex,next.index));break;}}
 }
 return containers;
}
export function publishedNuxtTables(html) {
 // Some official publishers render table rows only from their public Nuxt JSON
 // payload. Read declarative table content without executing scripts or treating
 // arbitrary hydration/configuration strings as source prose.
 const blocks=[...String(html).matchAll(/<script\b([^>]*)>([^]*?)<\/script>/gi)];
 const tables=[];
 for(const [,attributes,json] of blocks){
  if(!/\bid\s*=\s*(["'])__NUXT_DATA__\1/i.test(attributes)||!/\btype\s*=\s*(["'])application\/json\1/i.test(attributes)||json.length>8*1024*1024)continue;
  let data;try{data=JSON.parse(json);}catch{continue;}
  if(!Array.isArray(data)||data.length>100000)continue;
  let visits=0;
  const contentKeys=new Set(['headerColumns','bodyRows','footerRow','cellContent','text','list','listItems','title']);
  function textAt(reference,ancestors=new Set(),depth=0){
   if(!Number.isInteger(reference)||reference<0||reference>=data.length||depth>32||++visits>100000||ancestors.has(reference))return '';
   const value=data[reference],next=new Set(ancestors);next.add(reference);
   if(typeof value==='string')return value;
   if(Array.isArray(value))return value.map(v=>textAt(v,next,depth+1)).join(' ');
   if(value&&typeof value==='object')return Object.entries(value).filter(([key])=>contentKeys.has(key)).map(([,v])=>textAt(v,next,depth+1)).join(' ');
   return '';
  }
  for(const [index,value] of data.entries())if(value&&typeof value==='object'&&!Array.isArray(value)&&
    Number.isInteger(value.headerColumns)&&Number.isInteger(value.bodyRows)){
   const text=plainSourceText(textAt(index));if(text)tables.push(text);
  }
 }
 return tables.join(' ');
}
export function plainSourceText(html){return entity(withoutNonContentElements(String(html)).replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();}
export function normalizedPDFBytes(bytes){
 // Preserve the full document bytes except volatile file metadata. A changed
 // text stream, page, attachment, author or other field still changes the hash.
 const text=Buffer.from(bytes).toString('latin1').replace(/\/(?:CreationDate|ModDate)\s*\((?:\\.|[^)\\])*\)/g,'/VolatileDate()').replace(/\/ID\s*\[\s*<[^>]*>\s*<[^>]*>\s*\]/g,'/ID[]').replace(/<x:xmpmeta\b[^>]*>[^]*?<\/x:xmpmeta>/g,block=>block.replace(/<(xmp:(?:CreateDate|ModifyDate|MetadataDate)|xmpMM:(?:DocumentID|InstanceID))\b[^>]*>[^<]*<\/\1>/g,(_,tag)=>'<'+tag+'></'+tag+'>'));
 return Buffer.from(text,'latin1');
}
export const comparableText=text=>plainSourceText(String(text)).normalize('NFKC').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/\s+/g,' ').toLowerCase();
export function isAccessInterstitial(html,url=''){
 const text=plainSourceText(String(html));
 return /^https:\/\/unblock\.federalregister\.gov(?:\/|$)/i.test(url)||
   /^(access denied|just a moment|request blocked|page not found|forbidden|checking your browser|security check)\b/i.test(text)||
   /enable javascript and cookies to continue/i.test(text.slice(0,1500))||
   /programmatic access to these sites is limited to access to our extensive developer APIs/i.test(text)||
   /your request has been flagged as potentially automated/i.test(text)||
   /please complete the CAPTCHA.*Request Access/i.test(text);
}
export function extractSourceText(html,supportingPassage='',{minimumLength=100}={}){
 const candidates=publisherCopyContainers(html).map(raw=>({selector:'publisher-main-copy',text:plainSourceText(raw)}));for(const tag of ['main','article','body']){const re=new RegExp('<'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/'+tag+'>','gi');for(const match of html.matchAll(re))candidates.push({selector:tag,text:plainSourceText(match[1])});}
 candidates.push({selector:'document',text:plainSourceText(html)});
 const tables=publishedNuxtTables(html);
 if(tables)for(const candidate of candidates){candidate.text+=' '+tables;candidate.selector+='+published-nuxt-tables';}
 const quote=comparableText(supportingPassage);const hasQuote=quote.length>=12;
 const usable=candidates.filter(c=>c.text.length>=minimumLength);
 // Prefer a substantive semantic container that retains the previously reviewed
 // excerpt. Empty accessibility landmarks must not hide the actual article.
 const selected=(hasQuote?usable.find(c=>comparableText(c.text).includes(quote)):null)??usable[0];
 if(!selected)throw Error('Insufficient readable source content');
 if(isAccessInterstitial(selected.text))throw Error('Source returned access/error interstitial');
 return {...selected,supportingPassagePresent:hasQuote?comparableText(selected.text).includes(quote):null,normalizationVersion:NORMALIZATION_VERSION,hash:createHash('sha256').update(selected.text).digest('hex')};
}
export function retrievalFailureKind(error){const text=String(error?.message??error);if(/HTTP 429|Retry-After/i.test(text))return 'rate-limited';if(/HTTP (401|403)|interstitial/i.test(text))return 'access-blocked';if(/timeout|timed out|aborted/i.test(text))return 'timeout';if(/readable|content/i.test(text)&&!/MiB/.test(text))return 'unreadable';if(/redirect/i.test(text))return 'redirect';if(/public HTTPS|non-public|source host/i.test(text))return 'unsafe-source';if(/MiB|evidence cap/.test(text))return 'size-limit';return 'network';}
const escape=(value)=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
export function reviewMarkdown({runAt,results,queue}){
 const failures=results.filter(r=>r.result==='fetch-failed'),changed=results.filter(r=>r.result==='changed');
 let out=`# Editorial source check\n\nRun: ${runAt}\n\n${results.length} source records checked; ${failures.length} retrieval issues; ${changed.length} content-hash changes; ${queue.filter(q=>q.status!=='resolved').length} open review items.\n\nThis is a technical observation. Fetch success does not verify a legal interpretation, and failure does not establish that a rule changed or disappeared. Reviewed content and substantive review dates are preserved.\n\n`;
 const migrations=results.filter(r=>r.result==='baseline-migrated');
 if(migrations.length)out+=`${migrations.length} normalization migrations; ${migrations.filter(r=>r.normalizationAuditRequired).length} require a separate historical-text comparison. Migration does not establish unchanged law.\n\n`;
 const actionable=results.filter(r=>r.result==='fetch-failed'||r.result==='changed'||r.supportingPassagePresent===false||r.normalizationAuditRequired);
 if(actionable.length){out+='| Source | Observation | Affected pages and tools |\n|---|---|---|\n';for(const r of actionable)out+=`| ${escape(r.sourceId)} | ${escape(r.error??(r.normalizationAuditRequired?'Normalizer changed; historical text delta requires audit':r.supportingPassagePresent===false?'Reviewed supporting passage not located; inspect actual source':r.result))} | ${escape((r.paths??[]).join(', '))} |\n`;}
 else out+='No new technical retrieval or content-match issue was observed. Existing review items still require an explicit dated decision.\n';
 out+='\n## Next action\n\nInspect the actual source and its prior evidence, distinguish changed law from changed layout/access, and record reviewer, evidence, date and decision. Do not automatically republish an interpretation.\n';return out;
}
