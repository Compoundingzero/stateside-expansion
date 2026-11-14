import type {LearningChallenge} from './learning';
const substantiveRecord=(record:Record<string,any>)=>{
 const {fetchedAt,nextReview,substantiveVerifiedAt,verifiedAt,retrievalReviewedAt,...substantive}=record;
 return substantive;
};
/** Build-time only. A new definition, dependent article or substantive source record requires fresh practice. */
export async function versionLearningChallenges(definitions:LearningChallenge[],guides:Record<string,any>[],sources:Record<string,any>[],rules:Record<string,any>[]=[]):Promise<LearningChallenge[]>{
 const byPath=new Map(guides.filter(g=>g.status==='published').map(g=>[g.path,g])),sourceById=new Map(sources.map(s=>[s.id,s])),ruleById=new Map(rules.map(r=>[r.id,r]));
 return Promise.all(definitions.map(async definition=>{
  const {version,...content}=definition;
  const dependencies=definition.guidePaths.filter(path=>!path.startsWith('/tools/')).map(path=>{
   const guide=byPath.get(path);if(!guide)throw new Error('Unavailable learning guide: '+path);
   return {id:guide.id,path:guide.path,contentModifiedAt:guide.contentModifiedAt??null,title:guide.title,learningSummary:guide.learningSummary,sections:guide.sections,limitations:guide.limitations,ruleIds:guide.ruleIds??[],sourceIds:guide.sourceIds??[]};
  });
  const permittedSources=new Set(dependencies.flatMap(guide=>[...guide.sourceIds,...guide.ruleIds.flatMap((id:string)=>ruleById.get(id)?.sourceIds??[])]));
  const evidence=definition.sourceIds.map(id=>{
   const source=sourceById.get(id);if(!source||!permittedSources.has(id))throw new Error('Learning source must be cited by a dependent guide: '+id);
   // Review timestamps and fetch attempts do not reset mastery. Evidence, status and legal dates do.
   return substantiveRecord(source);
  });
  const dependentRules=[...new Set(dependencies.flatMap(guide=>guide.ruleIds))].map(id=>{const rule=ruleById.get(id);return rule?substantiveRecord(rule):{id};});
  const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({content,dependencies,evidence,dependentRules})));
  return {...content,version:[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')};
 }));
}
