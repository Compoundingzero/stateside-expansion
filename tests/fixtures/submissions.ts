import {expect,type Page} from '@playwright/test';
/** This suite must never claim an owner or create form data on production. */
export const submissionBaseURL=process.env.SUBMISSIONS_E2E_BASE_URL||'http://127.0.0.1:3001';
export const localSetupToken=process.env.SUBMISSIONS_E2E_SETUP_TOKEN||'';
export const localOwnerPassword='Qa-only-owner-password-94!fictional';
export const fictionalInterest={name:'Example Person',company:'Fictional QA Operations',arr:'USD 1,200,000 annually — fictional test',email:'qa-interest@example.invalid'};
export const fictionalEnquiry={comments:'Fictional QA enquiry: regional support,\nwith a second line about working capital.',email:'qa-contact@example.invalid'};
export function assertLocalTestTarget(){
 const target=new URL(submissionBaseURL);
 if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname))throw new Error('Owner-claim tests are restricted to a temporary local test database and local server.');
 if(localSetupToken.length<32)throw new Error('Provide a deterministic test-only SUBMISSIONS_E2E_SETUP_TOKEN of at least 32 characters matching the temporary server.');
}
export async function browserRequest(page:Page,path:string,method='GET',payload?:unknown){
 if(new URL(page.url()).origin!==new URL(submissionBaseURL).origin)throw new Error('The local submission test navigated outside its isolated server.');
 return page.evaluate(async({path,method,payload})=>{
  const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',...(payload===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})});
  const text=await response.text();let data:any=null;try{data=JSON.parse(text)}catch{}
  return {status:response.status,text,data,cacheControl:response.headers.get('cache-control'),contentType:response.headers.get('content-type'),disposition:response.headers.get('content-disposition')};
 },{path,method,payload});
}
export async function expectNoStoredOwnerSecrets(page:Page){
 const stored=await page.evaluate(()=>JSON.stringify({local:Object.entries(localStorage),session:Object.entries(sessionStorage),visibleCookies:document.cookie}));
 expect(stored).not.toContain(localSetupToken);
 expect(stored).not.toContain(localOwnerPassword);
}
export async function expectOnePrimaryAction(page:Page,required=true){
 const actions=page.locator('[data-forward-cta]');
 if(required)await expect(actions).toHaveCount(1);else expect(await actions.count()).toBeLessThanOrEqual(1);
 for(const top of [0,500,50000]){
  await page.evaluate(y=>window.scrollTo(0,y),top);
  expect(await actions.evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<window.innerHeight}).length)).toBeLessThanOrEqual(1);
 }
}
