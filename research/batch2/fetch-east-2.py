import urllib.request,concurrent.futures,json,hashlib,pathlib,datetime,subprocess
from html.parser import HTMLParser
R=pathlib.Path('/workspace/us-expansion/research/raw/batch2/east');R.mkdir(parents=True,exist_ok=True)
urls={
'ia-currentrelationship':'https://www.legis.iowa.gov/docs/code/2026/537A.10.pdf',
'ia-amendments':'https://www.legis.iowa.gov/law/statutory/acts/amended?year=2026',
'ks-opinion':'https://www.ag.ks.gov/home/showpublisheddocument/22944/638784276862300000',
'id-consumer':'https://www.ag.idaho.gov/consumer-protection/consumer-complaints/',
'co-2026labor':'https://olls.info/crs/crs2026-title-08.htm',
'ga-mark':'https://sos.ga.gov/page/trademarks-and-service-marks-faq',
'ms-2018':'https://billstatus.ls.state.ms.us/documents/2018/html/SB/2800-2899/SB2805SG.htm'
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
(R/'fetch-log-2.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
