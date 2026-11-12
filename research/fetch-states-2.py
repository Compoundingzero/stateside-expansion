import urllib.request, concurrent.futures, re, json, pathlib, datetime
from html.parser import HTMLParser
root=pathlib.Path('/workspace/us-expansion/research/states');root.mkdir(parents=True,exist_ok=True)
urls={
'ny-guide':'https://ag.ny.gov/resources/government-organizations/franchise-regulation/franchise-registration-guide',
'wi-faq':'https://dfi.wi.gov/Pages/Securities/Filings/FranchiseFAQ.aspx',
'wi-filing':'https://dfi.wi.gov/Pages/Securities/Filings/Franchising.aspx',
'mn-register':'https://mn.gov/commerce/money/industry/franchises/register-a-franchise.jsp',
'mn-law':'https://www.revisor.mn.gov/statutes/cite/80C.02',
'hi-filings':'https://www.cca.hawaii.gov/breg/franchise-filings/',
'hi-tips':'https://cca.hawaii.gov/wp-content/uploads/2026/04/Helpful-Tips-for-Franchise-Filing.pdf'
}
class P(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.out=[]
 def handle_starttag(self,t,a):
  if t in ('script','style','nav','header','footer'):self.skip+=1
 def handle_endtag(self,t):
  if t in ('script','style','nav','header','footer') and self.skip:self.skip-=1
 def handle_data(self,d):
  if not self.skip and d.strip():self.out.append(d.strip())
def fetch(it):
 k,u=it
 try:
  req=urllib.request.Request(u,headers={'User-Agent':'StatesideResearch/1.0 (source verification)'})
  with urllib.request.urlopen(req,timeout=35) as r:b=r.read();status=r.status;final=r.url;ct=r.headers.get('Content-Type','')
  if 'pdf' in ct or u.endswith('.pdf'):
   (root/(k+'.pdf')).write_bytes(b);txt='PDF downloaded; requires text extraction'
  else:
   p=P();p.feed(b.decode('utf-8','replace'));txt='\n'.join(p.out);(root/(k+'.txt')).write_text(txt)
  return {'id':k,'url':u,'finalUrl':final,'http':status,'bytes':len(b),'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'excerpt':txt[:100]}
 except Exception as e:return {'id':k,'url':u,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:res=list(ex.map(fetch,urls.items()))
(root/'fetch-log-2.json').write_text(json.dumps(res,indent=2));print(json.dumps(res,indent=2))
