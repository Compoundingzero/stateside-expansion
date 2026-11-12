import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const action=(page:any)=>page.locator('[data-forward-cta]');
test('Singapore owner remaining abroad completes the useful journey and exports all workspaces',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/plan/');
 await page.getByLabel('Home market',{exact:true}).fill('Singapore');
 await page.getByLabel('Business activity',{exact:true}).fill('Established commercial cleaning business');
 await expect(page.getByLabel('Will anyone physically work in the U.S.?')).toHaveValue('No U.S. work planned');
 await page.getByLabel('Will products or equipment be imported?').selectOption('No');
 await page.getByLabel('Could professional or sector operating licences apply?').selectOption('Not known');
 await action(page).click();
 const rows=page.locator('details.panel');
 for(let i=0;i<6;i++){
  const row=rows.nth(i);if(!(await row.getAttribute('open')!==null))await row.locator('summary').click();
  await row.getByLabel('Responsible role',{exact:true}).fill(`Manager ${i+1}`);
  await row.getByLabel('Still depends on the owner?').selectOption('No');
  await row.getByLabel('Evidence reference and limitation').fill('Fictional QA example: SOP and absence-cover trial; needs real evidence.');
  await row.getByLabel('Evidence status').selectOption('Evidence recorded');
 }
 await action(page).click();
 await page.getByLabel('Proposed commercial model').selectOption('IP licensing');
 await page.getByLabel('Brand, IP and software rights received').fill('Brand, operating manual and scheduling software');
 await page.getByLabel('All direct and indirect required payments').fill('Illustrative initial fee and 6% revenue royalty; affiliate payments to be investigated');
 await page.getByLabel('Operating controls and trademark quality controls').fill('Brand quality standards; mandatory service process to be reviewed');
 await page.getByLabel('Initial and continuing assistance').fill('Training and remote operational support');
 await action(page).click();
 await page.getByLabel('Who signs contracts with whom?').fill('Parent licenses U.S. operator; operator signs customer and employment contracts');
 await page.getByLabel('Who recruits, trains, supports and monitors?').fill('U.S. operator recruits technicians; parent trains trainers and supports quality');
 await page.getByLabel('Where will offers be made and received?').fill('Not decided; Texas operating area under investigation');
 await action(page).click();
 await page.getByLabel('Commercial market / metro').nth(0).fill('Houston');
 await page.getByLabel('State',{exact:true}).nth(0).fill('Texas');
 await page.getByLabel('Actual municipality').nth(0).fill('Houston');
 await page.getByLabel('County',{exact:true}).nth(0).fill('Harris');
 await page.getByLabel('Customer fit and demand evidence').nth(0).fill('Assumption: recurring B2B commercial cleaning; customer interviews pending');
 await page.getByLabel('First market to investigate (or not decided)').fill('Houston, Texas — investigation only');
 await page.getByLabel('Smallest practical demand/delivery validation activity').fill('COO to interview five facility buyers before territory commitments; no demonstrated U.S. demand yet');
 await action(page).click();
 await expect(page.getByText('Annual operating profit',{exact:true}).locator('..').locator('strong')).toHaveText('$0');
 await action(page).click();await expect(page.getByText('Continuing support surplus / (shortfall)')).toBeVisible();
 await action(page).click();await expect(page.getByText('Dated monthly cash flows — USD')).toBeVisible();
 await action(page).click();await expect(page.getByText('Demonstrated project funding gap')).toBeVisible();
 await action(page).click();await expect(page.getByText('What evidence still needs to be established?')).toBeVisible();
 await action(page).click();await expect(page.getByText('Pre-offer',{exact:true}).first()).toBeVisible();
 await action(page).click();
 await page.getByLabel('Named next action').fill('COO to obtain market and jurisdiction evidence before any offers');
 await page.getByLabel('Responsible role',{exact:true}).fill('COO');
 const downloadPromise=page.waitForEvent('download');await action(page).click();const download=await downloadPromise;
 const exported=JSON.parse(await readFile((await download.path())!,'utf8'));
 expect(exported.plan.origin).toBe('Singapore');expect(exported.plan.mobility).toBe('No U.S. work planned');
 expect(exported.calculations.scenarios[1].operatingProfit).toBe(0);expect(exported.plan.tasks).toHaveLength(8);
 expect(exported.plan.fdds).toHaveLength(2);expect(exported.unresolved.length).toBeGreaterThan(0);
 expect(exported.unresolved.join(' ')).not.toContain('Move ownership and people-mobility review');
 const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Printable brief / save as PDF'}).click();const popup=await popupPromise;
 await expect(popup.getByRole('heading',{name:'U.S. Expansion Brief',exact:true})).toBeVisible();
 await expect(popup.getByRole('heading',{name:'7. Launch dependencies'})).toBeVisible();
 expect(errors).toEqual([]);
});
test('clearing a cost produces unknown instead of a favourable zero',async({page})=>{
 await page.goto('/tools/us-unit-economics/');
 const profit=page.getByText('Annual operating profit',{exact:true}).locator('..').locator('strong');
 await expect(profit).toHaveText('$0');await page.getByLabel('Insurance',{exact:true}).fill('');
 await expect(profit).toHaveText('Not known');await expect(page.getByRole('status').filter({hasText:'Missing or invalid inputs'})).toContainText('Insurance');
});
test('saving is optional, opt-in persists, reset clears, and inputs trigger no plan network traffic',async({page})=>{
 const requests:{url:string,method:string}[]=[];page.on('request',req=>requests.push({url:req.url(),method:req.method()}));
 await page.goto('/plan/');await page.getByLabel('Home market',{exact:true}).fill('Private-marker-Singapore');
 await page.reload();await expect(page.getByLabel('Home market',{exact:true})).toHaveValue('');
 await page.getByLabel('Home market',{exact:true}).fill('Private-marker-Singapore');
 await page.getByLabel('Remember this non-sensitive draft on this browser').check();
 await page.reload();await expect(page.getByLabel('Home market',{exact:true})).toHaveValue('Private-marker-Singapore');
 await page.getByRole('button',{name:'Reset browser draft'}).click();await page.getByRole('button',{name:'Confirm reset'}).click();
 await expect(page.getByLabel('Home market',{exact:true})).toHaveValue('');
 expect(await page.evaluate(()=>localStorage.getItem('stateside-expansion-draft-v1'))).toBeNull();
 expect(requests.every(req=>req.method==='GET')).toBe(true);expect(requests.some(req=>req.url.includes('Private-marker'))).toBe(false);
});
test('article context selects relevant stage without forced onboarding',async({page})=>{
 await page.goto('/plan/?stage=1&topic=License%20classification&jurisdiction=Texas');
 await expect(page.getByRole('heading',{name:'U.S. model',exact:true})).toBeVisible();
 await expect(page.getByText('Reading carried into this plan:',{exact:false})).toContainText('Texas');
});
for(const viewport of [{width:1440,height:950},{width:390,height:844}])test(`one forward CTA and no page overflow at ${viewport.width}px, including scrolling`,async({page})=>{
 await page.setViewportSize(viewport);
 for(const route of ['/plan/','/tools/us-unit-economics/','/tools/fdd-comparison/','/tools/launch-planner/']){
  await page.goto(route);await expect(action(page)).toHaveCount(1);
  const scrolls=[0,500,1200,50000];
  for(const top of scrolls){await page.evaluate(y=>window.scrollTo(0,y),top);const visible=await action(page).evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<window.innerHeight}).length);expect(visible).toBeLessThanOrEqual(1);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 }
});
test('browser profiles cannot read each other’s drafts and public HTML contains no draft data',async({browser,page})=>{
 await page.goto('/plan/');await page.getByLabel('Home market',{exact:true}).fill('Private-profile-marker');
 await page.getByLabel('Remember this non-sensitive draft on this browser').check();
 const other=await browser.newContext({baseURL:new URL(page.url()).origin});const otherPage=await other.newPage();await otherPage.goto('/plan/');
 await expect(otherPage.getByLabel('Home market',{exact:true})).toHaveValue('');
 const publicHtml=await page.request.get('/');expect(await publicHtml.text()).not.toContain('Private-profile-marker');
 await other.close();
});
test('printable export escapes user content rather than executing it',async({page})=>{
 await page.goto('/plan/');await page.getByLabel('Home market',{exact:true}).fill('<script>window.draftInjected=1</script>');
 await page.getByRole('button',{name:'7. Decision',exact:true}).click();
 const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Printable brief / save as PDF'}).click();const popup=await popupPromise;
 await expect(popup.getByRole('heading',{name:'U.S. Expansion Brief',exact:true})).toBeVisible();
 expect(await popup.evaluate(()=>Object.prototype.hasOwnProperty.call(window,'draftInjected'))).toBe(false);
 expect(await popup.locator('body').innerText()).toContain('<script>window.draftInjected=1</script>');
});
