import urllib.request, concurrent.futures, re, json, pathlib, datetime
from html.parser import HTMLParser
root=pathlib.Path('/workspace/us-expansion/research/states');root.mkdir(parents=True,exist_ok=True)
urls={
'ca-instructions':'https://dfpi.ca.gov/regulated-industries/franchises/instructions-on-how-to-file-a-complete-franchise-application/',
'ca-law':'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=CORP&division=5.&title=4.&part=2.&chapter=2.&article=',
'ca-franchises':'https://dfpi.ca.gov/regulated-industries/franchises/',
'tx-faq':'https://www.sos.state.tx.us/statdoc/faqs2700.shtml',
'ny-franchise':'https://ag.ny.gov/resources/organizations/investments-registration-regulation/franchisors-franchisees',
'wa-franchise':'https://dfi.wa.gov/franchises',
'wa-law':'https://app.leg.wa.gov/RCW/default.aspx?cite=19.100&full=true',
'il-franchise':'https://illinoisattorneygeneral.gov/consumer-protection/franchise/',
'il-law':'https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=2380&ChapterID=67',
'md-franchise':'https://www.marylandattorneygeneral.gov/Pages/Securities/franchise.aspx',
'va-franchise':'https://www.scc.virginia.gov/pages/Franchise-Registration',
'wi-franchise':'https://dfi.wi.gov/Pages/Securities/Franchise.aspx',
'mn-franchise':'https://mn.gov/commerce/licensing/list/business/franchise.jsp',
'hi-franchise':'https://cca.hawaii.gov/sec/registration/franchise/',
'in-franchise':'https://www.in.gov/sos/securities/securities-division/franchise/',
'mi-franchise':'https://www.michigan.gov/ag/about/bureaus/cp/franchise',
'nd-franchise':'https://www.securities.nd.gov/industry/franchise-registration',
'ri-franchise':'https://dbr.ri.gov/divisions/securities/franchises.php',
'sd-franchise':'https://dlr.sd.gov/securities/franchises.aspx',
'fl-franchise':'https://forms.freshfromflorida.com/10001.pdf',
'ct-business':'https://portal.ct.gov/dob/business-opportunities/business-opportunities/business-opportunity-registration',
'or-franchise':'https://dfr.oregon.gov/business/licensing/financial/Pages/franchises.aspx',
'nj-law':'https://www.njconsumeraffairs.gov/Statutes/Franchise-Practices-Act.pdf',
'pr-law':'https://bvirtualogp.pr.gov/ogp/Bvirtual/leyesreferencia/PDF/75-1964.pdf'
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
(root/'fetch-log.json').write_text(json.dumps(res,indent=2));print(json.dumps(res,indent=2))
