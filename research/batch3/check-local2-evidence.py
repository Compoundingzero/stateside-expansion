"""Read-only evidence, reference and retained-gap checks for local2."""
import hashlib,json,re,unicodedata
from collections import Counter
from pathlib import Path
BASE=Path(__file__).resolve().parents[2]
RAW=BASE/'research/raw/batch3/local2'
load=lambda p:json.loads((BASE/p).read_text())
sources=load('src/data/batch3-local2-sources.json');rules=load('src/data/batch3-local2-rules.json')
guides=load('research/batch3/local2-guides.json');decisions=load('research/batch3/local2-candidate-decisions.json')
markets=load('research/batch3/local2-market-updates.json')
prior={x['candidateId']:x for x in load('research/batch3/planning-candidate-decisions.json')}
known_sources={s['id'] for p in (BASE/'src/data').glob('*sources.json') for s in json.loads(p.read_text())}
known_rules={r['id'] for p in (BASE/'src/data').glob('*rules.json') for r in json.loads(p.read_text())}
known_guides={g['path']:g for p in (BASE/'src/data').glob('*guides.json') for g in json.loads(p.read_text()) if g['status']=='published'}
known_guides.update({g['path']:g for g in load('research/batch3/industry2-guides.json')+guides})
def norm(s):
    s=unicodedata.normalize('NFKC',s).casefold().translate(str.maketrans({'“':'"','”':'"','‘':"'",'’':"'"}))
    s=re.sub(r'(?<=\w)-\s+(?=\w)','',s)
    return re.sub(r'\s+',' ',s)
for s in sources:
    assert norm(s['supportingPassage']) in norm((RAW/(s['id']+'.txt')).read_text()),s['id']
    assert any(p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==s['sha256'] for p in [RAW/(s['id']+e) for e in ('.html','.pdf')]),s['id']
for rows,key in ((sources,'id'),(rules,'id'),(guides,'id'),(guides,'path'),(decisions,'candidateId'),(markets,'id')):
    assert len(rows)==len({x[key] for x in rows}),key
for r in rules:
    assert r['fee'] is None and r['sourceIds']
    assert all(s in known_sources for s in r['sourceIds'])
    assert all(p in {g['path'] for g in guides} for p in r['dependentPaths'])
for g in guides:
    assert g['limitations'] and g['practicalOutput'] and len(g['sections'])>=4
    assert all(s in known_sources for s in g['sourceIds']) and all(r in known_rules for r in g['ruleIds'])
    for s in g['sections']:
        assert s['heading'] and (s['paragraphs'] or s.get('table',{}).get('rows'))
        assert all(i in g['sourceIds'] for i in s['sourceIds'])
        if s.get('table'):assert all(len(row)==len(s['table']['headers']) for row in s['table']['rows'])
for x in decisions:
    assert x['originalQuestion']==prior[x['candidateId']]['originalQuestion']
    assert x['originalPracticalOutput']==prior[x['candidateId']]['originalPracticalOutput']
    assert x['unresolvedResearch'] and x['nextResearchQuestion'] and x['futurePublicationGate']
    assert all(s in known_sources for s in x['sourceIds']) and all(r in known_rules for r in x['ruleIds'])
    assert all(e['path'] in known_guides and e['answeredOutput'] for e in x['evidenceScopes'])
    assert all(e['evidenceState'] in ('published-canonical','reviewed-proposal-pending-integration') for e in x['evidenceScopes'])
    if x['decision']=='retire':
        assert x['canonicalPath'] in known_guides and x['retirementScope']
        assert x['localSectorStatus']=='not-researched'
        assert any(e['role']=='local-process' for e in x['evidenceScopes'])
        assert any(e['role'].startswith('industry-baseline') for e in x['evidenceScopes'])
    if x['decision']=='publish':assert x['canonicalPath'] in {g['path'] for g in guides}
    if x['family']=='local-hub':assert x['decision']=='needs-research'
assert Counter(x['family'] for x in decisions)=={'local-hub':38,'local-sector':120}
assert Counter(x['decision'] for x in decisions)=={'needs-research':142,'retire':14,'publish':2}
assert all(m['status']=='conditional' and m['unresolved'] for m in markets)
assert len(sources)==6 and len(rules)==4 and len(guides)==2 and len(markets)==2
print(json.dumps({'auditedCandidates':158,'hubsRetained':38,'sectors':120,'retiredDuplicateMapConcepts':14,'scopedPublications':2,'needsResearch':142,'sourcePassagesMatched':6,'rawHashesMatched':6,'rules':4,'conditionalMarketUpdates':2,'errors':0}))
