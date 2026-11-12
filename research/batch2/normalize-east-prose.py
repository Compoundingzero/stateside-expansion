import re,json,pathlib
R=pathlib.Path('/workspace/us-expansion');paths=[R/'research/batch2/east-guides.json',R/'research/batch2/east-jurisdictions.json',R/'src/data/batch2-east-sources.json',R/'src/data/batch2-east-rules.json']
exclude={'id','path','url','sourceIds','ruleIds','dependentPaths','sha256','supportingPassage','jurisdictions','jurisdiction','slug','country','kind','family','status','legalStatus','topic','topics','reviewStatus','reviewerStatus','accessStatus','fetchedAt','substantiveVerifiedAt','verifiedAt','lastReviewed','nextReview','publicationDate','effectiveDate','convention'}
def prose(s):
 s=re.sub(r'(?<=[a-z])(?=[A-Z])',' ',s)
 s=re.sub(r'([A-Z]{2,})(?=[a-z])',r'\1 ',s)
 s=re.sub(r'(?<=[A-Za-z])(?=\d)',' ',s)
 s=re.sub(r'(?<=\d)(?=[a-z])',' ',s)
 s=re.sub(r'(\d[A-Z])(?=[a-z])',r'\1 ',s)
 s=re.sub(r'(?<=\d)(?=(?:Chapter|Title|Section|Code|Form))',' ',s)
 s=re.sub(r',(?=\d)',', ',s)
 fixes={'currentonlythrough':'current only through','beforeagreement':'before agreement','preagreement':'pre-agreement','prepayment':'pre-payment','postsignature':'post-signature','theFDD':'the FDD','U.S.seller':'U.S. seller','U.S.state':'U.S. state','U.S.workforce':'U.S. workforce','U.S.brand':'U.S. brand','toFDD':'to FDD','andFDD':'and FDD','onlythrough':'only through','current-form':'current form'}
 for a,b in fixes.items():s=s.replace(a,b)
 return s

def walk(o,k=''):
 if k in exclude:return o
 if isinstance(o,str):return prose(o)
 if isinstance(o,list):return [walk(x,k)for x in o]
 if isinstance(o,dict):return {key:(val if key in exclude else walk(val,key))for key,val in o.items()}
 return o
for p in paths:
 obj=json.loads(p.read_text());obj=walk(obj);p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
print('Normalized prose in four final datasets; quotations, URLs and identifiers preserved.')
