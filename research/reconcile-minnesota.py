import json,pathlib,datetime
R=pathlib.Path('/workspace/us-expansion');D=R/'src/data';now=datetime.datetime.now(datetime.timezone.utc).isoformat();today='2026-11-12';review='AI-assisted source review; no professional legal review'
def read(f):return json.loads((D/f).read_text())
def write(f,d):(D/f).write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
ss=read('state-sources.json');sid='state-mn-disclosure'
ss=[s for s in ss if s['id']!=sid]
ss.append(dict(id=sid,url='https://www.revisor.mn.gov/statutes/cite/80C.06',title='2026 Minnesota Statutes 80C.06 — Public Offering Statement',authority='Minnesota Office of the Revisor of Statutes',type='primary',section='Subdivision 5 — Copy to franchisee; receipt',supportingPassage='The receipt shall be kept in the possession of the person offering or selling the franchise',publicationDate=None,effectiveDate=None,fetchedAt=now,substantiveVerifiedAt=now,nextReview='2026-12-12',legalStatus='effective',reviewerStatus=review,accessStatus='read',notes='Full current2026statute read. Seven-day state period is an independent requirement, not a substitute for applicable federal14calendar days. State trigger also refers to any franchise or other agreement.'))
write('state-sources.json',ss)
rr=read('state-rules.json');rid='mn-disclosure-receipt';rr=[r for r in rr if r['id']!=rid]
rr.append(dict(id=rid,title='Minnesota seven-day state disclosure and signed receipt retention',topic='sales-disclosure',jurisdiction='Minnesota',activity='Offering or selling a franchise subject to state registration requirements',affectedParty='Person offering or selling the franchise; responsible sales records manager',applicability='A franchise subject to the registration requirements imposed byMinnesota80C.02. Independently determine federal coverage/exemption.',requirement='Under80C.06subd5, supply the current public offering statement and all proposed agreements at least7days before the earlier of execution of any franchise or other agreement or payment of consideration. Obtain a signed acknowledgement before agreement/payment and retain it3years. The applicable federal14-calendar-day period remains a separate prerequisite.',exceptions='Application depends on the state registration requirement. A federal or state exemption must be independently established; this record approves none.',trigger='Earlier franchise/other agreement or consideration; receipt acknowledgement and retention',deadline='At least7days before the earlier stated event; signed receipt before execution/payment; retain receipt3years from taking it',fee=None,renewal=None,dependencies=['Relationship factsheet','State registration/exemption applicability','Independent federal disclosure analysis'],evidence=['Current statement and all proposed agreements','Dated delivery evidence','Signed prospective-franchisee receipt','Three-year retention record'],sourceIds=[sid,'fed-timing'],status='verified',legalStatus='effective',verifiedAt=today,nextReview='2026-12-12',conflicts=[],interpretationLimits=['Seven state-law days do not shorten the federal14-calendar-day requirement where it applies. Compare the actual triggers, documents and dates separately.','No automatic commitment clearance; agreement changes and receipt facts require review.'],dependentPaths=['/states/minnesota/'],reviewerStatus=review))
write('state-rules.json',rr)
gg=read('state-guides.json')
for g in gg:
 if g['path']=='/states/minnesota/':
  if rid not in g['ruleIds']:g['ruleIds'].append(rid)
  for x in [sid,'fed-timing']:
   if x not in g['sourceIds']:g['sourceIds'].append(x)
  for s in g['sections']:
   if s['heading']=='A disclosure detail still needs reconciliation':
    s['heading']='Two disclosure requirements, plus a retained receipt'
    s['paragraphs']=['The seven-day language on the agency page matches current2026Minnesota Statutes80C.06subdivision5. For a franchise subject to state registration requirements, it calls for the current public offering statement and all proposed agreements at least seven days before the earlier of any franchise or other agreement or consideration. A signed acknowledgement must be obtained before agreement/payment and retained three years.','The federal14-calendar-day disclosure requirement remains independent where applicable. The state seven-day rule does not shorten it. Keep the documents, triggers and dates separate rather than choosing whichever interval is shorter.']
    s['sourceIds']=[sid,'fed-timing']
write('state-guides.json',gg)
st=read('states.json')
for s in st:
 if s['name']=='Minnesota':
  s['franchise']['disclosure']=dict(status='verified',summary='2026statute80C.06subd5:7-day state disclosure with agreements, signed receipt before agreement/payment, retained3years. Applicable federal14-calendar-day requirement remains separate.',sourceIds=[sid,'fed-timing'])
  for x in [sid,'fed-timing']:
   if x not in s['sourceIds']:s['sourceIds'].append(x)
   if x not in s['franchise']['sourceIds']:s['franchise']['sourceIds'].append(x)
write('states.json',st)
p=R/'research/states/README.md';txt=p.read_text();txt=txt.replace('23 verified, 26 conditional and one unresolved franchise dimension; California contributes three unresolved dimensions.','24 verified and26conditional franchise dimensions; California contributes three unresolved dimensions.');txt=txt.replace('29 read primary/official guidance source records','30read primary/official guidance source records');txt=txt.replace('26 canonical requirement records','27canonical requirement records');txt=txt.replace("- Minnesota's agency registration page reproduces a seven-day addendum notice. Do not treat this as a replacement for the federal 14-calendar-day rule. Reconcile the statute, rules and current agency directions before fixing transaction dates.","- Minnesota's seven-day agency wording was reconciled against2026statute80C.06subd5. It is a current independent state requirement, with signed receipt retention for three years, rather than a replacement for federal14calendar days. Compare triggers/documents and satisfy every applicable period.");txt=txt.replace('4. Reconcile Minnesota and Maryland source conflicts and record the responsible reviewer.','4. Reconcile Maryland legacy-source language and record the responsible reviewer. Minnesota state/federal intervals are now separately documented; transaction dates remain fact-specific.');p.write_text(txt)
p=R/'research/states/batch-counts.json';c=json.loads(p.read_text());c['sourcesRead']=30;c['rules']=27;c['franchiseDimensionCounts']['verified']=24;c['franchiseDimensionCounts']['unresolved']=3;p.write_text(json.dumps(c,indent=2)+'\n')
print({'updated':'Minnesota disclosure','newSource':sid,'newRule':rid,'california':'remains blocked','reviewedAt':now})
