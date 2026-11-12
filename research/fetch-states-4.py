import urllib.request, concurrent.futures, re, json, pathlib, datetime
from html.parser import HTMLParser
root=pathlib.Path('/workspace/us-expansion/research/states');root.mkdir(parents=True,exist_ok=True)
urls={
'in-info':'https://securities.sos.in.gov/general-information/franchise/',
'nd-info':'https://www.insurance.nd.gov/securities/filing-and-registration/franchise-registration-and-renewal',
'ri-info':'https://dbr.ri.gov/banking-securities-and-charitable-organizations/securities-and-charities/franchising',
'ri-law':'https://webserver.rilegislature.gov/Statutes/TITLE19/19-28.1/19-28.1-5.htm',
'ri-rule':'https://rules.sos.ri.gov/regulations/Part/230-50-10-1',
'sd-info':'https://dlr.sd.gov/securities/franchise_registration.aspx',
'sd-notice':'https://sdlegislature.gov/api/Statutes/37-5B-4.html',
'sd-duration':'https://sdlegislature.gov/api/Statutes/37-5B-5.html',
'sd-ads':'https://sdlegislature.gov/api/Statutes/37-5B-23.html',
'ca-section':'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CORP&sectionNum=31113.'
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
(root/'fetch-log-4.json').write_text(json.dumps(res,indent=2));print(json.dumps(res,indent=2))
