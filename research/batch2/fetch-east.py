import urllib.request,concurrent.futures,json,hashlib,pathlib,datetime,subprocess
from html.parser import HTMLParser
R=pathlib.Path('/workspace/us-expansion/research/raw/batch2/east');R.mkdir(parents=True,exist_ok=True)
urls={
'ak-bizopp':'https://www.law.alaska.gov/consumer/BizOpps.html',
'ak-law':'https://www.akleg.gov/basis/statutes.asp#45.66',
'ak-app':'https://law.alaska.gov/pdf/consumer/busopp-reg-and-renewal.pdf',
'az-definition':'https://www.azleg.gov/ars/44/01271.htm',
'az-disclosure':'https://www.azleg.gov/ars/44/01276-01.htm',
'az-registration':'https://www.azleg.gov/ars/44/01272.htm',
'ar-2023':'https://arkleg.state.ar.us/Home/FTPDocument?path=%2FACTS%2F2023R%2FPublic%2FACT847.pdf',
'ar-2025':'https://arkleg.state.ar.us/Bills/Detail?ddBienniumSession=2025%2F2025R&id=HB1177',
'ct-guidelines':'https://portal.ct.gov/dob/business-opportunities/bus-opps/guidelines-for-business-opportunity-registration-in-connecticut',
'ct-form':'https://portal.ct.gov/-/media/dob/business-opportunities/form-ct-boia-ex-eff-09-30-2025.pdf',
'ct-act':'https://www.cga.ct.gov/current/pub/chap_672c.htm',
'fl-agency':'https://www.fdacs.gov/Business-Services/Sellers-of-Business-Franchises',
'fl-guide':'https://ccmedia.fdacs.gov/content/download/116040/file/Franchise-Exemption-Application-Packet-Guide.pdf',
'fl-statute':'https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0559/Sections/0559.802.html',
'ga-agency':'https://consumer.georgia.gov/business-services/multilevel-distribution-companies-sale-business-opportunities',
'id-agency':'https://business.idaho.gov/licenses/',
'ia-bizopp':'https://www.legis.iowa.gov/docs/publications/ICC/2026/attachments/551A_ADA.pdf',
'ia-franchise':'https://www.legis.iowa.gov/docs/publications/ICC/2026/attachments/523H_ADA.pdf',
'ky-exemption':'https://apps.legislature.ky.gov/law/Statutes/statute.aspx?id=54557',
'ky-rules':'https://apps.legislature.ky.gov/law/kar/titles/040/012/410/',
'la-definition':'https://legis.la.gov/legis/Law.aspx?d=104155&p=y',
'la-prohibitions':'https://www.legis.la.gov/legis/LawPrint.aspx?d=104157',
'la-realestate':'https://www.legis.la.gov/legis/Law.aspx?d=93305',
'me-law':'https://legislature.maine.gov/statutes/32/title32ch69-B.pdf',
'ma-classification':'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXXI/Chapter149/Section148B',
'mo-relationship':'https://revisor.mo.gov/main/OneSection.aspx?section=407.405',
'mo-definition':'https://revisor.mo.gov/main/OneSection.aspx?section=407.400',
'mo-bizopp':'https://revisor.mo.gov/main/OneSection.aspx?section=409.1000',
'mo-prohibitions':'https://revisor.mo.gov/main/OneSection.aspx?section=409.1003',
'al-2026':'https://alison.legislature.state.al.us/files/pdf/SearchableInstruments/2026RS/SB138-enr.pdf',
'al-status':'https://alison.legislature.state.al.us/files/pdf/2026RS/EndOfDay/H-Calendar-21.pdf',
'de-law':'https://delcode.delaware.gov/title6/c025/sc05/index.html',
'co-agency':'https://coag.gov/licensing/business-resources/',
'ks-agency':'https://www.ag.ks.gov/divisions/consumer-protection'
}
class P(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.out=[]
 def handle_starttag(self,t,a):
  if t in ('script','style','nav','header','footer'):self.skip+=1
 def handle_endtag(self,t):
  if t in ('script','style','nav','header','footer') and self.skip:self.skip-=1
 def handle_data(self,d):
  if not self.skip and d.strip():self.out.append(d.strip())
def f(it):
 k,u=it
 try:
  with urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0 (public source review)'}),timeout=35) as r:b=r.read();ct=r.headers.get('Content-Type','');final=r.url;http=r.status
  h=hashlib.sha256(b).hexdigest();pdf='application/pdf' in ct or b[:4]==b'%PDF'
  raw=R/(k+('.pdf' if pdf else '.html'));raw.write_bytes(b)
  if pdf:
   subprocess.run(['pdftotext','-layout',str(raw),str(R/(k+'.txt'))],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);txt=(R/(k+'.txt')).read_text()
  else:
   p=P();p.feed(b.decode('utf-8','replace'));txt='\n'.join(p.out);(R/(k+'.txt')).write_text(txt)
  return dict(id=k,url=u,finalUrl=final,http=http,bytes=len(b),sha256=h,fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),firstLine=txt[:100])
 except Exception as e:return dict(id=k,url=u,error=str(e),attemptedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as e:out=list(e.map(f,urls.items()))
(R/'fetch-log.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
