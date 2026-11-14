export type LearningKind='guide'|'tool';
export type LearningStatus='not-started'|'reading'|'complete';
export interface LearningItem {id:string;key:string;path:string;title:string;description:string;type:LearningKind;topic:string;family:string;jurisdictions:string[];}
export interface LearningPath {id:string;title:string;goal:string;topics:string[];steps:string[];challengeIds:string[];}
export interface LearningChallenge {id:string;version?:string;title:string;scenario:string;question:string;fictional:boolean;type:'choice'|'number';options?:{id:string;label:string;explanation:string}[];correct?:string;answer?:number;unit?:string;calculation?:string;explanation:string;guidePaths:string[];sourceIds:string[];}
export interface LearningProgress {version:1;items:Record<string,{status:LearningStatus;bookmarked:boolean}>;solved:Record<string,string>;activePath:string;lastItem:string|null;}
export const learningKey=(type:LearningKind,id:string)=>`${type}:${id}`;
export const emptyLearning=():LearningProgress=>({version:1,items:{},solved:{},activePath:'model-offer',lastItem:null});
const validKey=(value:unknown):value is string=>typeof value==='string'&&/^(guide|tool):[A-Za-z0-9/_-]{1,180}$/.test(value);
const validId=(value:unknown):value is string=>typeof value==='string'&&/^[a-z0-9-]{1,80}$/.test(value);
/** Accept public content identifiers only. No names, free text, scores or planning inputs are retained. */
export function restoreLearning(value:unknown,known?:{items?:Set<string>;challenges?:Set<string>;paths?:Set<string>}):LearningProgress {
 const result=emptyLearning();if(!value||typeof value!=='object'||(value as any).version!==1)return result;
 const input=value as Record<string,unknown>;
 if(input.items&&typeof input.items==='object'&&!Array.isArray(input.items))for(const[key,entry]of Object.entries(input.items).slice(0,5000)){
  if(!validKey(key)||(known?.items&&!known.items.has(key))||!entry||typeof entry!=='object')continue;
  const row=entry as Record<string,unknown>,status=['not-started','reading','complete'].includes(String(row.status))?row.status as LearningStatus:'not-started';
  const bookmarked=row.bookmarked===true;if(status!=='not-started'||bookmarked)result.items[key]={status,bookmarked};
 }
 if(input.solved&&typeof input.solved==='object'&&!Array.isArray(input.solved))for(const[id,version]of Object.entries(input.solved).slice(0,500))if(validId(id)&&(!known?.challenges||known.challenges.has(id))&&typeof version==='string'&&/^[a-f0-9]{64}$/.test(version))result.solved[id]=version;
 if(validId(input.activePath)&&(!known?.paths||known.paths.has(input.activePath)))result.activePath=input.activePath;
 if(validKey(input.lastItem)&&(!known?.items||known.items.has(input.lastItem)))result.lastItem=input.lastItem;
 return result;
}
export function updateLearningItem(progress:LearningProgress,key:string,change:Partial<{status:LearningStatus;bookmarked:boolean}>):LearningProgress {
 if(!validKey(key))return progress;
 const items={...progress.items},entry={status:'not-started' as LearningStatus,bookmarked:false,...items[key],...change};
 if(entry.status==='not-started'&&!entry.bookmarked)delete items[key];else items[key]=entry;
 return {...progress,items,lastItem:key};
}
export function solveLearningChallenge(progress:LearningProgress,id:string,version:string):LearningProgress {
 return validId(id)&&/^[a-f0-9]{64}$/.test(version)&&progress.solved[id]!==version?{...progress,solved:{...progress.solved,[id]:version}}:progress;
}
export const isLearningChallengeSolved=(progress:LearningProgress,challenge:LearningChallenge)=>Boolean(challenge.version&&progress.solved[challenge.id]===challenge.version);
export function createLearningCatalog(guides:Record<string,any>[],tools:Record<string,any>[]):LearningItem[] {
 const items:LearningItem[]=guides.filter(g=>g.status==='published').map(g=>({id:g.id,key:learningKey('guide',g.id),path:g.path,title:g.title,description:g.description??'',type:'guide',topic:g.topic??'',family:g.family??'',jurisdictions:g.jurisdictions??[]}));
 for(const tool of tools)items.push({id:tool.mode,key:learningKey('tool',tool.mode),path:'/tools/'+tool.slug+'/',title:tool.name,description:tool.description??'',type:'tool',topic:tool.stage===3?'commercial-feasibility':tool.stage===0?'commercial-feasibility':tool.stage===1?'classification':tool.stage===2?'premises-opening':tool.stage===4?'sales-disclosure':'premises-opening',family:'tool',jurisdictions:[]});
 return items.sort((a,b)=>a.title.localeCompare(b.title,'en'));
}
export function pathSteps(path:LearningPath,items:LearningItem[]):LearningItem[] {const byPath=new Map(items.map(item=>[item.path,item]));return path.steps.map(step=>byPath.get(step)).filter((item):item is LearningItem=>Boolean(item));}
export function pathItems(path:LearningPath,items:LearningItem[]):LearningItem[] {
 const curated=pathSteps(path,items),keys=new Set(curated.map(item=>item.key));
 return [...curated,...items.filter(item=>!keys.has(item.key)&&(path.id==='fdd'?item.family==='fdd':item.family!=='fdd'&&path.topics.includes(item.topic)))];
}

/** Keep the primary action within the selected starting path, even after unrelated reading. */
export function nextLearningStep(path:LearningPath,items:LearningItem[],progress:LearningProgress):{item:LearningItem|undefined;resume:boolean}{
 const steps=pathSteps(path,items),started=(item:LearningItem)=>progress.items[item.key]?.status==='reading';
 const resume=steps.find(item=>item.key===progress.lastItem&&started(item))??steps.find(started);
 return {item:resume??steps.find(item=>progress.items[item.key]?.status!=='complete'),resume:Boolean(resume)};
}
export function learningStats(progress:LearningProgress,items:LearningItem[],paths:LearningPath[],challenges:LearningChallenge[]){
 const completed=items.filter(item=>progress.items[item.key]?.status==='complete'),read=completed.filter(item=>item.type==='guide').length,tried=completed.filter(item=>item.type==='tool').length;
 const solved=challenges.filter(challenge=>isLearningChallengeSolved(progress,challenge)).length;
 const xp=read*10+tried*15+solved*20;
 const level=xp>=400?'Connecting the decisions':xp>=180?'Building perspective':xp>=60?'Finding your bearings':'Getting started';
 const finishedPaths=paths.filter(path=>{const steps=pathSteps(path,items);return steps.length>0&&steps.every(item=>progress.items[item.key]?.status==='complete');}).length;
 const badges=[...(read>0?['First reading']:[]),...(solved>0?['First practice']:[]),...(tried>=3?['Three tools explored']:[]),...(finishedPaths>=2?['Two paths explored']:[])];
 return {read,tried,solved,xp,level,badges,finishedPaths,bookmarks:items.filter(item=>progress.items[item.key]?.bookmarked).length};
}
export function checkLearningAnswer(challenge:LearningChallenge,value:string):{answered:boolean;correct:boolean;feedback:string}{
 if(challenge.type==='number'){
  const text=value.trim();if(!text||!/^[-+]?\d+(?:\.\d+)?$/.test(text))return {answered:false,correct:false,feedback:'Enter a number before checking. A blank answer is not zero.'};
  const correct=Number(text)===challenge.answer;return {answered:true,correct,feedback:correct?'The arithmetic matches.':'Check the amounts and the event each amount belongs to.'};
 }
 const selected=challenge.options?.find(option=>option.id===value);return selected?{answered:true,correct:value===challenge.correct,feedback:selected.explanation}:{answered:false,correct:false,feedback:'Choose an answer before checking.'};
}
