import json,re,pathlib
R=pathlib.Path('/workspace/us-expansion');paths=[R/'research/batch2/east-guides.json',R/'research/batch2/east-jurisdictions.json',R/'src/data/batch2-east-sources.json',R/'src/data/batch2-east-rules.json']
exclude={'id','path','url','sourceIds','ruleIds','dependentPaths','sha256','supportingPassage','jurisdictions','jurisdiction','slug','country','kind','family','status','legalStatus','topic','topics','reviewStatus','reviewerStatus','accessStatus','fetchedAt','substantiveVerifiedAt','verifiedAt','lastReviewed','nextReview','publicationDate','effectiveDate','convention'}
def text(s):
 for a,b in {'C olorado':' Colorado','A ct':' Act','S ubchapter':' Subchapter','R egular':' Regular','S ection':' Section','B 2B':'B2B','14-dayrule':'14-day rule','theU.S.':'the U.S.','aU.S.':'a U.S.','withinstate':'within state','currentlaw':'current law'}.items():s=s.replace(a,b)
 s=re.sub(r'\)(?=[A-Za-z])',') ',s)
 s=re.sub(r';(?=[A-Za-z0-9])','; ',s)
 s=re.sub(r'(?<=[a-zA-Z])\((?=(?:a|b|c|d|chapter|1|2)\b)', ' (',s)
 return re.sub(r' {2,}',' ',s)
def walk(o,k=''):
 if k in exclude:return o
 if isinstance(o,str):return text(o)
 if isinstance(o,list):return[walk(v,k)for v in o]
 if isinstance(o,dict):return {key:(value if key in exclude else walk(value,key))for key,value in o.items()}
 return o
for p in paths:
 x=walk(json.loads(p.read_text()));p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n')
# Scoped Louisiana correction after independent editorial review.
p=R/'research/batch2/east-guides.json';gg=json.loads(p.read_text())
for g in gg:
 if g['jurisdictions']==['Louisiana']:
  g['description']='Specified device-location, buyback and earnings promises need separate screening; bond duties have their own limited scope.'
  for s in g['sections']:
   s['paragraphs']=[v.replace('It separately describes location assistance, buyback and earnings/refund representations.','It separately describes assistance with specified vending, display or amusement-device locations, along with buyback and earnings/refund representations.')for v in s['paragraphs']]
   if 'bullets'in s:s['bullets']=[v.replace('every location, income, refund or buyback promise','every specified device-location, income, refund or buyback promise')for v in s['bullets']]
p.write_text(json.dumps(gg,indent=2,ensure_ascii=False)+'\n')
p=R/'src/data/batch2-east-rules.json';rr=json.loads(p.read_text())
for r in rr:
 if r['id']=='b2-east-la-definition':r['requirement']=r['requirement'].replace('Other location, buyback and earnings/refund triggers','Other specified vending/display/amusement-device location, buyback and earnings/refund triggers');r['trigger']=r['trigger'].replace('location assistance','specified device-location assistance')
p.write_text(json.dumps(rr,indent=2,ensure_ascii=False)+'\n')
print('Final public prose and Louisiana device-location scope corrected.')
