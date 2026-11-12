/** Deterministic planning arithmetic. A blank, invalid, or negative input is unknown. */
export type Numeric = string | number | null | undefined;
export const numberOrNull = (value: Numeric): number | null => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const total = (values: (number | null)[]) => values.some(v => v === null) ? null : (values as number[]).reduce((a,b) => a+b,0);
export const unitCostKeys = ['labour','payroll','manager','occupancy','insurance','materials','marketing','sales','overhead'] as const;
export type UnitInput = Record<typeof unitCostKeys[number] | 'revenue' | 'royalty', Numeric>;
export function unitEconomics(input: UnitInput, revenueMultiplier = 1) {
  const originalRevenue = numberOrNull(input.revenue);
  const revenue = originalRevenue === null ? null : originalRevenue * revenueMultiplier;
  const royaltyRate = numberOrNull(input.royalty);
  const royalty = revenue === null || royaltyRate === null || royaltyRate > 100 ? null : revenue * royaltyRate / 100;
  const operatingCosts = total(unitCostKeys.map(k => numberOrNull(input[k])));
  const operatingProfit = revenue === null || royalty === null || operatingCosts === null ? null : revenue-operatingCosts-royalty;
  return {revenue,royalty,operatingCosts,operatingProfit,margin:operatingProfit === null || !revenue ? null : operatingProfit/revenue*100,unknowns:[...unitCostKeys,'revenue','royalty'].filter(k => numberOrNull(input[k as keyof UnitInput]) === null || (k === 'royalty' && (royaltyRate ?? 0)>100))};
}
export type SupportInput = Record<'units'|'unitRevenue'|'royalty'|'retainedShare'|'withholding'|'training'|'field'|'travel'|'recruitment'|'localisation'|'compliance'|'overhead', Numeric>;
export function supportEconomics(input: SupportInput) {
  const values = Object.fromEntries(Object.entries(input).map(([k,v])=>[k,numberOrNull(v)])) as Record<keyof SupportInput,number|null>;
  const unknowns = Object.keys(input).filter(k=>values[k as keyof SupportInput]===null);
  if(values.units!==null && !Number.isInteger(values.units)) unknowns.push('units (whole operating units)');
  for (const key of ['royalty','retainedShare','withholding'] as const) if ((values[key]??0)>100) unknowns.push(key);
  if (unknowns.length) return {gross:null,allocated:null,netReceipts:null,costs:null,surplus:null,unknowns};
  const v = values as Record<keyof SupportInput,number>;
  const gross=v.units*v.unitRevenue*v.royalty/100;
  const allocated=gross*v.retainedShare/100;
  const netReceipts=allocated*(1-v.withholding/100);
  const costs=v.training+v.field+v.travel+v.recruitment+v.localisation+v.compliance+v.overhead;
  return {gross,allocated,netReceipts,costs,surplus:netReceipts-costs,unknowns};
}
export interface RunwayInput {start:string;cash:Numeric;opening:Numeric;deposit:Numeric;inventory:Numeric;reserve:Numeric;monthlyRevenue:Numeric;monthlyExpense:Numeric;debt:Numeric;delay:Numeric;receivables:Numeric;}
export function cashRunway(input: RunwayInput) {
  const numericKeys=['cash','opening','deposit','inventory','reserve','monthlyRevenue','monthlyExpense','debt','delay','receivables'] as const;
  const v=Object.fromEntries(numericKeys.map(k=>[k,numberOrNull(input[k])])) as Record<typeof numericKeys[number],number|null>;
  const unknowns=numericKeys.filter(k=>v[k]===null) as string[];
  const start=/^\d{4}-\d{2}$/.test(input.start)?new Date(input.start+'-01T00:00:00Z'):null;
  if (!start || !Number.isFinite(start.valueOf())) unknowns.push('start');
  if (v.delay!==null && (!Number.isInteger(v.delay)||v.delay>24)) unknowns.push('delay (whole months, 0–24)');
  if (v.receivables!==null && (!Number.isInteger(v.receivables)||v.receivables>12)) unknowns.push('receivables (whole months, 0–12)');
  if (unknowns.length) return {rows:[],fundingNeed:null,gap:null,firstShortfall:null,unknowns};
  const n=v as Record<typeof numericKeys[number],number>;
  let cumulative=-(n.opening+n.deposit+n.inventory);
  let lowest=cumulative;
  const rows:{month:string,collections:number,operatingOutflow:number,debtService:number,net:number,balance:number}[]=[];
  const firstBalance=n.cash+cumulative;
  let firstShortfall=firstBalance<0?'Before opening':null;
  for(let i=0;i<12;i++) {
    const d=new Date(start!.valueOf());d.setUTCMonth(d.getUTCMonth()+i);
    const month=d.toISOString().slice(0,7);
    // Expense starts at month 1, even during an opening delay. Collection follows service plus collection lag.
    const collections=i>=n.delay+n.receivables?n.monthlyRevenue:0;
    const net=collections-n.monthlyExpense-n.debt;
    cumulative+=net;lowest=Math.min(lowest,cumulative);
    const balance=n.cash+cumulative;
    if(balance<0&&!firstShortfall)firstShortfall=month;
    rows.push({month,collections,operatingOutflow:n.monthlyExpense,debtService:n.debt,net,balance});
  }
  const fundingNeed=Math.max(0,-lowest)+n.reserve;
  return {rows,fundingNeed,gap:Math.max(0,fundingNeed-n.cash),firstShortfall,unknowns};
}
export const partnerFundingGap=(launch:Numeric,reserve:Numeric,available:Numeric)=>{
  const vals=[launch,reserve,available].map(numberOrNull);
  return vals.some(v=>v===null)?null:Math.max(0,vals[0]!+vals[1]!-vals[2]!);
};
export function weightedMarketScore(scores:Numeric[],weights:Numeric[]) {
  if(scores.length!==weights.length||!scores.length)return null;
  const s=scores.map(numberOrNull),w=weights.map(numberOrNull);
  if(s.some(x=>x===null||x>5)||w.some(x=>x===null))return null;
  const weightTotal=(w as number[]).reduce((a,b)=>a+b,0);
  return weightTotal===0?null:(s as number[]).reduce((sum,value,i)=>sum+value*w[i]!,0)/weightTotal;
}
