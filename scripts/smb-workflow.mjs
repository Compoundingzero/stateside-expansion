import {readFile,readdir,writeFile} from 'node:fs/promises';
import {editorialHash} from './smb-edit-utils.mjs';
const directory='research/smb-edit';
const workflow=JSON.parse(await readFile(`${directory}/workflow.json`,'utf8'));
const guides=(await Promise.all((await readdir('src/data')).filter(f=>f.endsWith('guides.json')).map(async f=>JSON.parse(await readFile(`src/data/${f}`,'utf8'))))).flat();
const current=new Map(guides.map(g=>[g.id,g]));
const [action,file]=process.argv.slice(2);
for(const entry of workflow.articles){
 const guide=current.get(entry.id);
 if(entry.contentHash&&guide&&entry.contentHash!==editorialHash(guide)){
  entry.state='revision-needed';entry.staleReview=true;
 }
}
if(action==='sources'){
 const expected=JSON.parse(await readFile('research/improvements/manifest.json','utf8')).verificationDependentExpansions;
 const integrations=JSON.parse(await readFile(`${directory}/source-integrations.json`,'utf8').catch(()=>'[]'));
 workflow.sourceQuestions=expected.map(question=>{
  const result=integrations.findLast(i=>i.id===question.id);
  return {...question,state:result?.decision||'pending',conclusion:result?.conclusion,remainingLimits:result?.remainingLimits,decisionFile:result?.decisionFile};
 });
 await writeFile(`${directory}/workflow.json`,JSON.stringify(workflow,null,2)+'\n');
}
if(action==='review'){
 const reviews=JSON.parse(await readFile(file,'utf8'));
 for(const review of reviews){
  const entry=workflow.articles.find(a=>a.id===review.id),g=current.get(review.id);
  if(!entry||!g||review.reviewedHash!==editorialHash(g))throw Error(`${review.id}: review does not match the current article`);
  if(!review.notes?.trim()||!review.reviewer?.trim()||!['approved','revise'].includes(review.decision))throw Error(`${review.id}: incomplete independent review`);
  entry.state=review.decision==='approved'?'independently-reviewed':'revision-needed';
  entry.reviewedHash=review.reviewedHash;entry.review=review;delete entry.staleReview;
 }
 await writeFile(`${directory}/workflow.json`,JSON.stringify(workflow,null,2)+'\n');
}
if(!action||['status','review','sources'].includes(action)){
 const counts={};for(const article of workflow.articles)counts[article.state]=(counts[article.state]||0)+1;
 const queue=workflow.articles.filter(a=>!['validated','live-verified'].includes(a.state)).map(a=>({id:a.id,state:a.state,next:a.state==='audited'?'Edit the article against its owner question':a.state==='drafted'?'Have another reviewer read the current revision':a.state==='revision-needed'?'Address review findings, then review the changed revision':'Run source, fragment and rendering checks'}));
 const sourceQuestions={};for(const item of workflow.sourceQuestions||[])sourceQuestions[item.state]=(sourceQuestions[item.state]||0)+1;
 const tracked=new Set(workflow.articles.map(a=>a.id));
 const newlyPublished=guides.filter(g=>g.status==='published'&&!tracked.has(g.id)).map(g=>({id:g.id,path:g.path,next:'Audit and add this article to the current revision workflow'}));
 console.log(JSON.stringify({articles:workflow.articles.length,stages:counts,sourceQuestions,newlyPublished,next:queue.slice(0,8),sourceReviewDatesAutomaticallyRefreshed:false}));
}else throw Error('Use status, sources or review <review.json>');
