import {createHash} from 'node:crypto';
export const editorialFields=['title','seoTitle','description','learningSummary','keyTerms','sections','practicalOutput','limitations','readMinutes','relatedPaths','learningPath'];
export const teachingSections=sections=>(sections||[]).map(({aliases,legacyIndex,...section})=>section);
export function editorialHash(g){
 const content=Object.fromEntries(editorialFields.map(key=>[key,key==='sections'?teachingSections(g.sections):g[key]]));
 return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
export function sectionText(g){return (g.sections||[]).flatMap(s=>[s.heading,...s.paragraphs||[],...s.bullets||[],...s.table?.headers||[],...(s.table?.rows||[]).flat()]).join(' ');}
export const countWords=text=>(text.match(/\b[\w'-]+\b/g)||[]).length;
