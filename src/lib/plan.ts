import {unitEconomics,supportEconomics,cashRunway,partnerFundingGap,type UnitInput,type SupportInput,type RunwayInput} from './calculations';
export const stages=['Management','U.S. model','First market','Economics','Partner','Launch requirements','Decision'] as const;
export const evidenceStatuses=['Not started','Drafted','Evidence recorded','Confirmed by the responsible person','Needs updating'];
export const fddItems=['5 — Initial fees','6 — Other fees','7 — Initial investment','8 — Suppliers and purchasing','11 — Assistance and training','12 — Territory','15 — Participation in operations','17 — Renewal, termination, transfer and disputes','19 — Financial performance representations','20 — Outlets and franchisee contacts','21 — Financial statements'];
export const citations=[
  {title:'FTC Franchise Rule Compliance Guide',url:'https://www.ftc.gov/business-guidance/resources/franchise-rule-compliance-guide'},
  {title:'Federal disclosure timing: 16 CFR 436.2',url:'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-436/subpart-B/section-436.2'},
  {title:'Federal exemption rules: 16 CFR 436.8',url:'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-436/subpart-E/section-436.8'},
  {title:'USCIS ownership and control',url:'https://www.uscis.gov/policy-manual/volume-2-part-l-chapter-5'},
  {title:'U.S. treaty-country list',url:'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/treaty.html'},
  {title:'PACER national index: federal coverage only',url:'https://pacer.uscourts.gov/find-case/search-national-index'}
];
export interface Responsibility {task:string;role:string;ownerOnly:string;evidence:string;status:string;confirmedBy:string;date:string;}
export interface Task {id:string;title:string;gate:string;role:string;prerequisite:string;status:string;evidence:string;due:string;source:string;}
export interface Market {name:string;state:string;municipality:string;county:string;demand:string;operating:string;cost:string;scores:string[];}
export interface Plan {
  version:1; origin:string;industry:string;management:string;intent:string;mobility:string;imports:string;regulated:string;model:string;ip:string;payments:string;controls:string;assistance:string;contracting:string;supportRole:string;offerLocations:string;ownership:string;responsibilities:Responsibility[];markets:Market[];weights:string[];selectedMarket:string;validation:string;
  unit:UnitInput;support:SupportInput;runway:RunwayInput;financeContext:{location:string;date:string;sourceType:string;notes:string};partner:{accessible:string;launch:string;reserve:string;netWorth:string;territory:string;principles:string;requirements:Responsibility[]};fdds:{entity:string;year:string;url:string;cohort:string;exclusions:string;verification:string;items:string[]}[];tasks:Task[];decision:string;nextAction:string;nextOwner:string;decisionDate:string;
}
export function defaultPlan():Plan {return {
  version:1,origin:'',industry:'',management:'Not known',intent:'Investigate a pilot while the owner remains abroad',mobility:'No U.S. work planned',imports:'Not decided',regulated:'Not known',model:'Not decided',ip:'',payments:'',controls:'',assistance:'',contracting:'',supportRole:'',offerLocations:'',ownership:'',
  responsibilities:['Sales and key accounts','Technical decisions and quality','People, hiring and cover','Suppliers and procurement','Finance and receivables','Training and field support'].map(task=>({task,role:'',ownerOnly:'Not known',evidence:'',status:'Not started',confirmedBy:'',date:''})),
  markets:[0,1].map(()=>({name:'',state:'',municipality:'',county:'',demand:'',operating:'',cost:'',scores:['','','']})),weights:['3','2','1'],selectedMarket:'',validation:'',
  unit:{revenue:'1000000',labour:'510000',payroll:'30000',manager:'120000',occupancy:'60000',insurance:'30000',materials:'80000',royalty:'6',marketing:'0',sales:'40000',overhead:'70000'},
  support:{units:'5',unitRevenue:'1000000',royalty:'6',retainedShare:'50',withholding:'0',training:'30000',field:'60000',travel:'15000',recruitment:'20000',localisation:'10000',compliance:'25000',overhead:'30000'},
  runway:{start:'2026-12',cash:'200000',opening:'200000',deposit:'25000',inventory:'25000',reserve:'150000',monthlyRevenue:'50000',monthlyExpense:'45000',debt:'0',delay:'1',receivables:'1'},
  financeContext:{location:'Fictional U.S. operation — market not selected',date:'2026-11-12',sourceType:'Fictional assumption',notes:'All amounts are USD. Unit and support figures are annual. Cash ledger is monthly. These are fictional learning inputs, not market benchmarks. Replace every input with dated evidence; tax, reinvestment and financing terms remain unresolved.'},
  partner:{accessible:'200000',launch:'250000',reserve:'150000',netWorth:'4000000',territory:'Pilot operating area, exact boundaries undecided',principles:'Rights staged against evidence; define national accounts, online leads, service standards, support, milestones and cure periods.',requirements:['Accessible capital and competing commitments','Operating experience and account references','Management capacity and succession','Entity and ownership records','Federal, state and local dispute search scope','Subfranchise recruitment and support capacity'].map(task=>({task,role:'',ownerOnly:'Not known',evidence:'',status:'Not started',confirmedBy:'',date:''}))},
  fdds:[0,1].map(()=>({entity:'',year:'',url:'',cohort:'',exclusions:'',verification:'Not checked against source',items:fddItems.map(()=> '')})),
  tasks:[
    {id:'classification',title:'Review actual relationship and relevant jurisdictions before offers',gate:'Pre-offer',role:'',prerequisite:'Relationship factsheet and offer locations',status:'Not started',evidence:'',due:'',source:citations[0].url},
    {id:'state',title:'Resolve state registration, notices, exemptions and advertising',gate:'Pre-offer',role:'',prerequisite:'classification',status:'Not started',evidence:'',due:'',source:'/coverage/'},
    {id:'disclosure',title:'Set disclosure delivery and signing/payment controls',gate:'Pre-signature/payment',role:'',prerequisite:'classification, state',status:'Not started',evidence:'',due:'',source:citations[1].url},
    {id:'mobility',title:'Resolve ownership and work-authorisation facts if U.S. work is planned',gate:'Pre-employment/import',role:'',prerequisite:'People-mobility and ownership map',status:'Not started',evidence:'',due:'',source:citations[3].url},
    {id:'supply',title:'Identify importer, exact product and regulator if importing',gate:'Pre-employment/import',role:'',prerequisite:'Product specification and importer allocation',status:'Not started',evidence:'',due:'',source:'https://www.cbp.gov/trade/basic-import-export'},
    {id:'location',title:'Confirm address-specific use, permits, insurance and sector permissions',gate:'Pre-opening',role:'',prerequisite:'Pending location selection',status:'Not started',evidence:'',due:'',source:'/coverage/#local'},
    {id:'people',title:'Assign employer, payroll, worker classification, safety and local wage review',gate:'Pre-opening',role:'',prerequisite:'Actual employee work location',status:'Not started',evidence:'',due:'',source:'https://www.dol.gov/general/topic/wages'},
    {id:'ongoing',title:'Calendar source review, renewals, FDD updates and evidence refresh',gate:'Ongoing',role:'',prerequisite:'Named responsible people and confirmed applicable obligations',status:'Not started',evidence:'',due:'',source:'/methodology/'}
  ],decision:'Further investigation',nextAction:'',nextOwner:'',decisionDate:''
};}
/** Recover only known fields of the current schema; corrupt saved values become visible defaults. */
export function restorePlan(value:unknown):Plan {
  const merge=(fallback:unknown,candidate:unknown):unknown=>{
    if(Array.isArray(fallback))return fallback.map((item,index)=>merge(item,Array.isArray(candidate)?candidate[index]:undefined));
    if(fallback && typeof fallback==='object')return Object.fromEntries(Object.entries(fallback).map(([key,item])=>[key,merge(item,candidate&&typeof candidate==='object'?(candidate as Record<string,unknown>)[key]:undefined)]));
    return typeof candidate===typeof fallback?candidate:fallback;
  };
  return merge(defaultPlan(),value) as Plan;
}
export function planIssues(plan:Plan) {
  const issues:string[]=[];
  if(!plan.origin)issues.push('Home market is not recorded.');
  if(!plan.industry)issues.push('Business activity is not recorded.');
  if(plan.responsibilities.some(r=>!r.role||r.ownerOnly==='Not known'||r.ownerOnly==='Yes'))issues.push('Owner dependencies or responsibility cover still need evidence.');
  if(plan.model==='Not decided'||!plan.payments||!plan.controls)issues.push('Relationship facts and required-payment/control review are incomplete.');
  if(!plan.selectedMarket)issues.push('No first market selected; address-specific permissions remain pending.');
  if(!plan.validation)issues.push('U.S. customer-demand validation is not documented.');
  if(unitEconomics(plan.unit).unknowns.length)issues.push('Unit economics have missing or invalid inputs.');
  issues.push('Tax, debt, reinvestment, actual quotations and local costs require separate evidence.');
  if(plan.mobility!=='No U.S. work planned')issues.push('Move ownership and people-mobility review before commitments dependent on U.S. work.');
  if(plan.imports!=='No')issues.push('Import and domestic-substitution responsibilities remain to be resolved.');
  if(plan.regulated!=='No')issues.push('Professional and sector operating rules require early investigation.');
  if(plan.tasks.some(t=>t.status!=='Confirmed by the responsible person'||!t.role||!t.evidence))issues.push('Launch tasks are drafted planning records, not authorisations or legal clearance.');
  if([...plan.responsibilities,...plan.partner.requirements].some(r=>r.status==='Confirmed by the responsible person'&&(!r.confirmedBy||!r.date||!r.evidence)))issues.push('Some requested confirmations lack the responsible person, evidence reference or date and remain unresolved.');
  return issues;
}
export function exportPlan(plan:Plan) {return {title:'U.S. Expansion Brief',exportedAt:new Date().toISOString(),privacy:'Created in this browser; no server-stored plan or public URL.',scope:'Educational preparation. No legal classification, exemption approval, partner certification or visa determination.',inputBasis:plan.financeContext,plan,calculations:{scenarios:[['Downside',0.8],['Base',1],['Upside',1.2]].map(([label,m])=>({label,...unitEconomics(plan.unit,m as number)})),support:supportEconomics(plan.support),runway:cashRunway(plan.runway),partnerGap:partnerFundingGap(plan.partner.launch,plan.partner.reserve,plan.partner.accessible)},unresolved:planIssues(plan),sources:citations,sourceNote:'Linked authorities are reading routes. User facts and applicability have not received professional legal review; consult guide pages for actual source-review dates.'};}
