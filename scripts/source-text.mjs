import {createHash} from 'node:crypto';
export const NORMALIZATION_VERSION=2;
const entity=(text)=>text.replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|[0-9]+);/gi,s=>{
 const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};if(named[s.toLowerCase()])return named[s.toLowerCase()];const code=parseInt(s.slice(s[2].toLowerCase()==='x'?3:2,-1),s[2].toLowerCase()==='x'?16:10);return Number.isFinite(code)&&code<=0x10ffff?String.fromCodePoint(code):s;
});
export function plainSourceText(html){return entity(html.replace(/<!--[^]*?-->/g,' ').replace(/<(script|style|template|nav|header|footer)\b[^>]*>[^]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();}
export const comparableText=text=>plainSourceText(String(text)).normalize('NFKC').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/\s+/g,' ').toLowerCase();
export function extractSourceText(html,supportingPassage=''){
 const candidates=[];for(const tag of ['main','article','body']){const re=new RegExp('<'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/'+tag+'>','gi');for(const match of html.matchAll(re))candidates.push({selector:tag,text:plainSourceText(match[1])});}
 candidates.push({selector:'document',text:plainSourceText(html)});
 const quote=comparableText(supportingPassage);const hasQuote=quote.length>=12;
 const usable=candidates.filter(c=>c.text.length>=100);
 // Prefer a substantive semantic container that retains the previously reviewed
 // excerpt. Empty accessibility landmarks must not hide the actual article.
 const selected=(hasQuote?usable.find(c=>comparableText(c.text).includes(quote)):null)??usable[0];
 if(!selected)throw Error('Insufficient readable source content');
 if(/^(access denied|just a moment|request blocked|page not found|forbidden|checking your browser)\b/i.test(selected.text)||/enable javascript and cookies to continue/i.test(selected.text.slice(0,1000)))throw Error('Source returned access/error interstitial');
 return {...selected,supportingPassagePresent:hasQuote?comparableText(selected.text).includes(quote):null,normalizationVersion:NORMALIZATION_VERSION,hash:createHash('sha256').update(selected.text).digest('hex')};
}
export function retrievalFailureKind(error){const text=String(error?.message??error);if(/HTTP (401|403)|interstitial/i.test(text))return 'access-blocked';if(/timeout|timed out|aborted/i.test(text))return 'timeout';if(/readable|content/i.test(text)&&!/MiB/.test(text))return 'unreadable';if(/redirect/i.test(text))return 'redirect';if(/public HTTPS|non-public|source host/i.test(text))return 'unsafe-source';if(/MiB|evidence cap/.test(text))return 'size-limit';return 'network';}
const escape=(value)=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
export function reviewMarkdown({runAt,results,queue}){
 const failures=results.filter(r=>r.result==='fetch-failed'),changed=results.filter(r=>r.result==='changed');
 let out=`# Editorial source check\n\nRun: ${runAt}\n\n${results.length} source records checked; ${failures.length} retrieval issues; ${changed.length} content-hash changes; ${queue.filter(q=>q.status!=='resolved').length} open review items.\n\nThis is a technical observation. Fetch success does not verify a legal interpretation, and failure does not establish that a rule changed or disappeared. Reviewed content and substantive review dates are preserved.\n\n`;
 const actionable=results.filter(r=>r.result==='fetch-failed'||r.result==='changed'||r.supportingPassagePresent===false);
 if(actionable.length){out+='| Source | Observation | Affected pages and tools |\n|---|---|---|\n';for(const r of actionable)out+=`| ${escape(r.sourceId)} | ${escape(r.error??(r.supportingPassagePresent===false?'Reviewed supporting passage not located; inspect actual source':r.result))} | ${escape((r.paths??[]).join(', '))} |\n`;}
 else out+='No new technical retrieval or content-match issue was observed. Existing review items still require an explicit dated decision.\n';
 out+='\n## Next action\n\nInspect the actual source and its prior evidence, distinguish changed law from changed layout/access, and record reviewer, evidence, date and decision. Do not automatically republish an interpretation.\n';return out;
}
