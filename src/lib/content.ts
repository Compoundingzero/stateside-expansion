const modules = import.meta.glob('../data/*.json', {eager:true,import:'default'});
export type RecordData = Record<string, any>;
const data = Object.entries(modules).map(([path,records])=>({name:path.split('/').pop()!,records:Array.isArray(records)?records:[]}));
export const guides:RecordData[] = data.filter(x=>x.name.endsWith('guides.json')).flatMap(x=>x.records);
export const published = guides.filter(g=>g.status==='published');
export const sources:RecordData[] = data.filter(x=>x.name.endsWith('sources.json')).flatMap(x=>x.records);
export const rules:RecordData[] = data.filter(x=>x.name.endsWith('rules.json')).flatMap(x=>x.records);
export const states:RecordData[] = data.find(x=>x.name==='states.json')?.records??[];
export const origins:RecordData[] = data.find(x=>x.name==='origins.json')?.records??[];
export const markets:RecordData[] = data.find(x=>x.name==='markets.json')?.records??[];
export const toolDefinitions:RecordData[] = data.find(x=>x.name==='tool-definitions.json')?.records??[];
export const siteDependencies:RecordData[] = data.find(x=>x.name==='site-dependencies.json')?.records??[];
export const sourceById = (id:string)=>sources.find(s=>s.id===id);
export const ruleById = (id:string)=>rules.find(s=>s.id===id);
export const tools = [
{slug:'management-dependence',mode:'management',name:'Management dependence',description:'Map who owns the work, where the owner is still needed, and what evidence is missing.',stage:0},
{slug:'relationship-factsheet',mode:'relationship',name:'Relationship factsheet',description:'Describe the rights, payments, support and controls behind your proposed model.',stage:1},
{slug:'market-comparison',mode:'markets',name:'Market comparison',description:'Compare customer fit and operating assumptions. Keep unknowns visible.',stage:2},
{slug:'us-unit-economics',mode:'economics',name:'U.S. unit economics',description:'Test a management-run unit under downside, base and upside assumptions.',stage:3},
{slug:'brand-support-economics',mode:'support',name:'Brand & master support',description:'See whether recurring income can fund the support you have promised.',stage:3},
{slug:'cash-runway',mode:'runway',name:'Cash runway',description:'Model dated cash flows, opening delays, working capital and funding needs.',stage:3},
{slug:'fdd-comparison',mode:'fdd',name:'FDD comparison',description:'Record document years, entities, cohorts and missing disclosure information.',stage:4},
{slug:'partner-evidence',mode:'partner',name:'Partner evidence',description:'Separate self-reported claims from accessible capital and operating evidence.',stage:4},
{slug:'launch-planner',mode:'launch',name:'Launch dependencies',description:'Assign the work before offers, payments, employment, imports and opening.',stage:5}
];
export const stages=['Management','U.S. model','First market','Economics','Partner','Launch requirements','Decision'];
export const topicNames:Record<string,string>={'classification':'Relationship classification','sales-disclosure':'Sales & disclosure','relationship':'Ongoing relationship','corporate-tax':'Corporate & tax','immigration':'Immigration & people','employment':'Employment','products-supply':'Products & supply','premises-opening':'Premises & opening','ip-data':'IP & data','commercial-feasibility':'Commercial feasibility'};
export const statusLabel=(value:any):string=> typeof value==='string'?value.replaceAll('-',' '):value?.status?.replaceAll('-',' ')??'not researched';
