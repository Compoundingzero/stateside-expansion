"""Read-only checks for the scoped industry2 publication proposals."""
import hashlib
import json
import re
import unicodedata
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
RAW = BASE / 'research/raw/batch3/industry2'
read = lambda p: json.loads((BASE / p).read_text())
sources = read('src/data/batch3-industry2-sources.json')
rules = read('src/data/batch3-industry2-rules.json')
guides = read('research/batch3/industry2-guides.json')
decisions = read('research/batch3/industry2-candidate-updates.json')
all_sources = {s['id']: s for p in (BASE/'src/data').glob('*sources.json') for s in json.loads(p.read_text())}
all_rules = {r['id']: r for p in (BASE/'src/data').glob('*rules.json') for r in json.loads(p.read_text())}
prior = {r['candidateId']: r for r in read('research/batch3/planning-candidate-decisions.json')}

def normalize(s):
    s = unicodedata.normalize('NFKC', s).casefold().translate(str.maketrans({'“':'"','”':'"','‘':"'",'’':"'"}))
    s = re.sub(r'(?<=\w)-\s+(?=\w)', '', s)  # PDF line-wrap hyphenation
    return re.sub(r'\s+', ' ', s)

reader_files = {
    'b3-i2-auto-apply-reader': ['bar-reader-1.txt'],
    'b3-i2-auto-wir-reader': ['bar-reader-1.txt', 'bar-reader-2.txt'],
    'b3-i2-retail-sale-law': ['cpsc-2068-reader.txt'],
    'b3-i2-retail-resale-faq': ['cpsc-resale-faq-guide-reader.txt'],
    'b3-i2-ca-law2026': ['cslb-law-2026.txt'],
}
hash_count = 0
for s in sources:
    body = '\n'.join((RAW/f).read_text() for f in reader_files.get(s['id'], [s['id']+'.txt']))
    assert normalize(s['supportingPassage']) in normalize(body), ('unmatched source quotation', s['id'])
    if 'sha256' in s:
        paths = [RAW/(s['id']+ext) for ext in ('.html', '.pdf')]
        if s['id'] == 'b3-i2-ca-law2026': paths = [RAW/'cslb-law-2026.pdf']
        assert any(p.exists() and hashlib.sha256(p.read_bytes()).hexdigest() == s['sha256'] for p in paths), ('raw hash mismatch', s['id'])
        hash_count += 1
    else:
        assert s['accessStatus'] == 'retrieved-and-read-via-public-reader'
        assert s['fetchedAt'] == '2026-11-13'

for records, key in ((sources,'id'), (rules,'id'), (guides,'id'), (guides,'path'), (decisions,'candidateId')):
    assert len({r[key] for r in records}) == len(records), ('duplicate', key)
for r in rules:
    assert r['fee'] is None and r['status'] == 'verified'
    assert r['sourceIds'] and all(i in all_sources for i in r['sourceIds'])
    assert all(p in {g['path'] for g in guides} for p in r['dependentPaths'])
for g in guides:
    assert g['limitations'] and g['practicalOutput'] and g['sections']
    assert all(i in all_sources for i in g['sourceIds'])
    assert all(i in all_rules for i in g['ruleIds'])
    for s in g['sections']:
        assert all(i in g['sourceIds'] for i in s.get('sourceIds',[])), ('undeclared section source',g['id'])
        assert s.get('paragraphs') or s.get('table',{}).get('rows')
        if s.get('table'): assert all(len(row) == len(s['table']['headers']) for row in s['table']['rows'])
for d in decisions:
    assert d['originalQuestion'] == prior[d['candidateId']]['originalQuestion']
    assert d['originalPracticalOutput'] == prior[d['candidateId']]['originalPracticalOutput']
    assert len(d['unresolvedResearch']) >= 3
    assert d['canonicalPath'] in {g['path'] for g in guides}
    assert d['decision'] in ('publish','merge')
aliases = [d for d in decisions if d['decision']=='merge']
assert {d['canonicalPath'] for d in aliases} == {'/industries/hair-salons/','/industries/vehicle-maintenance/'}
assert {g['id'] for g in guides if g['path'] in {d['canonicalPath'] for d in aliases}} == {'b2-salons','b2-auto'}
assert len(guides)==16 and len(decisions)==16 and len(sources)==29 and len(rules)==25
print(json.dumps({'guideRecords':len(guides),'newGuides':14,'existingGuideRevisions':2,'candidateDecisions':len(decisions),'sourcePassagesMatched':len(sources),'rawHashesMatched':hash_count,'publicReaderSources':len(sources)-hash_count,'rules':len(rules),'errors':0}))
