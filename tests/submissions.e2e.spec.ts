import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {assertLocalTestTarget,browserRequest,expectNoStoredOwnerSecrets,expectOnePrimaryAction,fictionalInterest,fictionalEnquiry,localOwnerPassword,localSetupToken,submissionBaseURL} from './fixtures/submissions';

// These tests require a fresh, disposable database. They never create a live owner.
test.use({baseURL:submissionBaseURL});
test.describe.serial('ELN intake and private owner board — isolated local database',()=>{
 test.skip(!localSetupToken,'Set a deterministic test-only SUBMISSIONS_E2E_SETUP_TOKEN matching a fresh temporary local server.');
 test.beforeAll(()=>assertLocalTestTarget());
 test('interest has exactly four public fields, accessible errors and a durable successful submission',async({page})=>{
  const posts:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/interest'))posts.push(r.url())});
  await page.goto('/interest/');await page.getByLabel('Your name',{exact:true}).waitFor();
  const fields=await page.locator('form input,form textarea,form select').evaluateAll(els=>els.filter(el=>!el.closest('[aria-hidden="true"]')&&getComputedStyle(el).display!=='none').map(el=>(el as HTMLInputElement).name));
  expect(fields.sort()).toEqual(['arr','company','email','name']);
  await expectOnePrimaryAction(page);await page.getByRole('button',{name:'Register interest',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('not been submitted');expect(posts).toHaveLength(0);
  await expect(page.getByLabel('Your name',{exact:true})).toHaveAttribute('aria-invalid','true');
  await page.getByLabel('Your name',{exact:true}).fill(fictionalInterest.name);
  await page.getByLabel('Company',{exact:true}).fill(fictionalInterest.company);
  await page.getByLabel(/^ARR \(annual recurring revenue\)/).fill(fictionalInterest.arr);
  await page.getByLabel('Email',{exact:true}).fill('not-an-email');
  await page.getByRole('button',{name:'Register interest',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('valid email');expect(posts).toHaveLength(0);
  await page.getByLabel('Email',{exact:true}).fill(fictionalInterest.email);
  const response=page.waitForResponse(r=>r.url().endsWith('/api/interest')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Register interest',exact:true}).click();expect((await response).status()).toBe(202);
  await expect(page.getByRole('status')).toContainText('Your submission has been received');
  await expect(page.getByRole('status')).not.toContainText(fictionalInterest.email);expect(posts).toHaveLength(1);
 });
 test('contact has exactly two public fields and submits multiline comments',async({page})=>{
  await page.goto('/contact/');await page.getByLabel('Comments',{exact:true}).waitFor();
  const fields=await page.locator('form input,form textarea,form select').evaluateAll(els=>els.filter(el=>!el.closest('[aria-hidden="true"]')&&getComputedStyle(el).display!=='none').map(el=>(el as HTMLInputElement).name));
  expect(fields.sort()).toEqual(['comments','email']);await expectOnePrimaryAction(page);
  await page.getByRole('button',{name:'Send enquiry',exact:true}).click();await expect(page.getByRole('alert')).toContainText('not been submitted');
  await page.getByLabel('Comments',{exact:true}).fill(fictionalEnquiry.comments);await page.getByLabel('Email',{exact:true}).fill(fictionalEnquiry.email);
  const response=page.waitForResponse(r=>r.url().endsWith('/api/enquiries')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Send enquiry',exact:true}).click();expect((await response).status()).toBe(202);
  await expect(page.getByRole('status')).toContainText('Your submission has been received');
 });
 test('a failed submission preserves the entered fields and can be retried',async({page})=>{
  await page.goto('/contact/');await page.getByLabel('Comments',{exact:true}).fill('Fictional QA retry message');await page.getByLabel('Email',{exact:true}).fill('qa-retry@example.invalid');
  await page.route('**/api/enquiries',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic temporary failure; please retry.'})}));
  await page.getByRole('button',{name:'Send enquiry',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Synthetic temporary failure');
  await expect(page.getByLabel('Comments',{exact:true})).toHaveValue('Fictional QA retry message');await expect(page.getByLabel('Email',{exact:true})).toHaveValue('qa-retry@example.invalid');
  await expectOnePrimaryAction(page);await page.unroute('**/api/enquiries');
  const response=page.waitForResponse(r=>r.url().endsWith('/api/enquiries')&&r.request().method()==='POST');await page.getByRole('button',{name:'Send enquiry',exact:true}).click();expect((await response).status()).toBe(202);
  await expect(page.getByRole('status')).toContainText('Your submission has been received');
 });
 test('public forms use POST and stay disabled without JavaScript instead of leaking fields into URLs',async({browser})=>{
  const noScript=await browser.newContext({baseURL:submissionBaseURL,javaScriptEnabled:false});const page=await noScript.newPage();
  for(const [path,endpoint,button] of [['/interest/','/api/interest','Register interest'],['/contact/','/api/enquiries','Send enquiry']]){
   await page.goto(path);const form=page.locator('form[data-submission-kind]');await expect(form).toHaveAttribute('method','post');await expect(form).toHaveAttribute('action',endpoint);
   await expect(form.getByRole('button',{name:button,exact:true})).toBeDisabled();
   expect(await form.locator('input,textarea,select').evaluateAll(els=>els.filter(el=>!el.closest('[aria-hidden="true"]')).every(el=>(el as HTMLInputElement).disabled))).toBe(true);
   expect(new URL(page.url()).search).toBe('');
  }
  await noScript.close();
 });
 test('server validation rejects invalid data and anonymous users receive no owner records or CSV',async({page})=>{
  await page.goto('/owner/');
  const invalid=await browserRequest(page,'/api/interest','POST',{name:'',company:'Fictional QA',email:'bad-email',website:''});expect(invalid.status).toBe(400);expect(invalid.data.fields).toHaveProperty('email');
  const trap=await browserRequest(page,'/api/interest','POST',{name:'Invisible QA bot',company:'Fictional QA bot',email:'qa-honeypot@example.invalid',website:'filled-by-qa'});expect(trap.status).toBe(202);
  for(const path of ['/api/owner/submissions?kind=interest','/api/owner/submissions?kind=enquiry','/api/owner/export?kind=interest']){
   const response=await browserRequest(page,path);expect(response.status).toBe(401);expect(response.text).not.toContain(fictionalInterest.email);expect(response.text).not.toContain(fictionalEnquiry.comments);expect(response.cacheControl).toContain('no-store');
  }
  await expect(page.locator('body')).not.toContainText(fictionalInterest.email);await expect(page.locator('body')).not.toContainText(fictionalEnquiry.email);
 });
 test('interest, contact and unauthenticated owner screens fit mobile with at most one primary action',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const path of ['/interest/','/contact/','/owner/']){
   await page.goto(path);await expect(page.locator('h1')).toBeVisible();await expectOnePrimaryAction(page,path!=='/owner/');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
 });
 test('a setup fragment opened on the already loaded page is captured and removed without claiming the owner',async({page})=>{
  const setupPosts:string[]=[];page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/owner/setup')setupPosts.push(request.url())});
  await page.goto('/owner/setup/');
  await expect(page.getByRole('heading',{name:'A private setup link is required.',exact:true})).toBeVisible();
  await expect(page.getByLabel('Password',{exact:true})).toHaveCount(0);
  await page.evaluate(()=>{(window as Window&{__elnSameDocumentMarker?:string}).__elnSameDocumentMarker='same-document-test';});
  await page.goto(`/owner/setup/#token=${encodeURIComponent(localSetupToken)}`);
  // Same-document navigation must work; a full reload could hide the regression.
  expect(await page.evaluate(()=>(window as Window&{__elnSameDocumentMarker?:string}).__elnSameDocumentMarker)).toBe('same-document-test');
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();await expect(page.getByLabel('Confirm password',{exact:true})).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');expect(page.url()).not.toContain(localSetupToken);
  await expectOnePrimaryAction(page);await expectNoStoredOwnerSecrets(page);
  await page.goBack();expect(new URL(page.url()).hash).toBe('');expect(page.url()).not.toContain(localSetupToken);
  await page.goForward();expect(new URL(page.url()).hash).toBe('');expect(page.url()).not.toContain(localSetupToken);
  const session=await browserRequest(page,'/api/owner/session');expect(session.data).toEqual({authenticated:false,configured:false});
  expect(setupPosts).toHaveLength(0);
 });
 test('one-use owner setup, private status lanes, deletion, safe CSV and sign-in/out work end to end',async({page,context,browser})=>{
  const requestURLs:string[]=[];page.on('request',request=>requestURLs.push(request.url()));
  await page.goto('/owner/');
  const before=await browserRequest(page,'/api/owner/session');expect(before.data).toEqual({authenticated:false,configured:false});
  const formula=await browserRequest(page,'/api/interest','POST',{name:'=1+1',company:'Fictional, Formula QA',email:'qa-formula@example.invalid',website:''});expect(formula.status).toBe(202);
  await page.goto('/privacy/');await page.goto(`/owner/setup/#token=${encodeURIComponent(localSetupToken)}`);
  await page.getByLabel('Password',{exact:true}).waitFor();expect(new URL(page.url()).origin).toBe(new URL(submissionBaseURL).origin);expect(new URL(page.url()).hash).toBe('');
  expect(JSON.stringify(await page.evaluate(()=>history.state))).not.toContain(localSetupToken);
  await expectOnePrimaryAction(page);await expectNoStoredOwnerSecrets(page);
  await page.getByLabel('Password',{exact:true}).fill(localOwnerPassword);await page.getByLabel('Confirm password',{exact:true}).fill('Mismatched QA password');
  await page.getByRole('button',{name:'Set owner password',exact:true}).click();await expect(page.getByRole('alert')).toContainText('do not match');
  await page.getByLabel('Confirm password',{exact:true}).fill(localOwnerPassword);
  const setupResponse=page.waitForResponse(r=>r.url().endsWith('/api/owner/setup')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Set owner password',exact:true}).click();expect((await setupResponse).status()).toBe(200);
  await expect(page.getByRole('region',{name:'Private submissions',exact:true})).toBeVisible();
  await expectNoStoredOwnerSecrets(page);
  const ownerCookies=(await context.cookies()).filter(cookie=>cookie.name.includes('eln-owner'));
  expect(ownerCookies).toHaveLength(1);expect(ownerCookies[0].httpOnly).toBe(true);expect(ownerCookies[0].sameSite).toBe('Strict');expect(ownerCookies[0].path).toBe('/');
  // The fragment-bearing history entry was replaced, not merely hidden after a redirect.
  await page.goBack();expect(new URL(page.url()).hash).toBe('');expect(page.url()).not.toContain(localSetupToken);
  await page.goForward();await expect(page.getByRole('region',{name:'Private submissions',exact:true})).toBeVisible();
  const interests=await browserRequest(page,'/api/owner/submissions?kind=interest');expect(interests.status).toBe(200);expect(interests.cacheControl).toContain('no-store');
  const lead=interests.data.submissions.find((row:any)=>row.email===fictionalInterest.email);
  expect(lead).toMatchObject({...fictionalInterest,status:'new',kind:'interest'});
  expect(interests.data.submissions.some((row:any)=>row.email==='qa-honeypot@example.invalid')).toBe(false);
  const initialCard=()=>page.locator(`[data-submission-id="${lead.id}"]`);
  await expect(initialCard()).toBeVisible();
  for(const [value,label] of [['in-progress','In progress'],['closed','Closed']]){
   const changed=page.waitForResponse(r=>r.url().endsWith(`/api/owner/submissions/${lead.id}`)&&r.request().method()==='PATCH');
   await initialCard().getByRole('combobox').selectOption(value);expect((await changed).status()).toBe(200);
   await expect(page.getByRole('region',{name:label,exact:true}).locator(`[data-submission-id="${lead.id}"]`)).toBeVisible();
  }
  await page.reload();await expect(page.getByRole('region',{name:'Closed',exact:true}).locator(`[data-submission-id="${lead.id}"]`)).toBeVisible();
  const csvPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const csv=await csvPromise;
  const csvText=await readFile((await csv.path())!,'utf8');expect(csvText).toContain(fictionalInterest.email);expect(csvText).toContain(fictionalInterest.arr);expect(csvText).toContain('"\'=1+1"');expect(csvText).toContain('"Fictional, Formula QA"');
  await page.getByRole('tab',{name:'Enquiries',exact:true}).click();
  await expect(page.locator('.owner-card').filter({hasText:fictionalEnquiry.email})).toContainText('second line about working capital.');
  const enquiryCsvPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const enquiryCsv=await enquiryCsvPromise;
  const enquiryText=await readFile((await enquiryCsv.path())!,'utf8');expect(enquiryText).toContain('"'+fictionalEnquiry.comments+'"');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await expectOnePrimaryAction(page,false);
  await page.getByRole('tab',{name:'Enquiries',exact:true}).focus();await page.keyboard.press('ArrowLeft');await expect(page.getByRole('tab',{name:'Interests',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(initialCard()).toBeVisible();await initialCard().getByRole('button',{name:/^Delete interest registration/}).click();
  const dialog=page.getByRole('dialog',{name:'Delete this submission?',exact:true});await expect(dialog).toBeVisible();await expectOnePrimaryAction(page);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(initialCard()).toBeVisible();
  await initialCard().getByRole('button',{name:/^Delete interest registration/}).click();
  const removed=page.waitForResponse(r=>r.url().endsWith(`/api/owner/submissions/${lead.id}`)&&r.request().method()==='DELETE');
  await dialog.getByRole('button',{name:'Delete submission',exact:true}).click();expect((await removed).status()).toBe(200);await expect(initialCard()).toHaveCount(0);
  await page.reload();await expect(page.getByRole('region',{name:'Private submissions',exact:true})).toBeVisible();await expect(initialCard()).toHaveCount(0);
  const afterDelete=await browserRequest(page,'/api/owner/submissions?kind=interest');expect(afterDelete.data.submissions.some((row:any)=>row.id===lead.id)).toBe(false);
  const reused=await browserRequest(page,'/api/owner/setup','POST',{token:localSetupToken,password:localOwnerPassword});expect(reused.status).toBe(409);
  const outsider=await browser.newContext({baseURL:submissionBaseURL});const outsidePage=await outsider.newPage();await outsidePage.goto('/owner/');
  await expect(outsidePage.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();expect((await browserRequest(outsidePage,'/api/owner/submissions?kind=enquiry')).status).toBe(401);
  await expect(outsidePage.locator('body')).not.toContainText(fictionalEnquiry.email);await outsider.close();
  const logout=page.waitForResponse(r=>r.url().endsWith('/api/owner/logout')&&r.request().method()==='POST');await page.getByRole('button',{name:'Sign out',exact:true}).click();expect((await logout).status()).toBe(200);
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();expect((await browserRequest(page,'/api/owner/submissions?kind=enquiry')).status).toBe(401);await expect(page.locator('body')).not.toContainText('qa-formula@example.invalid');
  await page.getByLabel('Password',{exact:true}).fill('An incorrect QA-only password');const badLogin=page.waitForResponse(r=>r.url().endsWith('/api/owner/login')&&r.request().method()==='POST');await page.getByRole('button',{name:'Sign in',exact:true}).click();expect((await badLogin).status()).toBe(401);await expect(page.getByRole('alert')).toContainText('Sign-in could not be completed');
  await page.getByLabel('Password',{exact:true}).fill(localOwnerPassword);const login=page.waitForResponse(r=>r.url().endsWith('/api/owner/login')&&r.request().method()==='POST');await page.getByRole('button',{name:'Sign in',exact:true}).click();expect((await login).status()).toBe(200);await expect(page.getByRole('region',{name:'Private submissions',exact:true})).toBeVisible();
  await expectNoStoredOwnerSecrets(page);expect(requestURLs.some(url=>url.includes(localSetupToken)||url.includes(localOwnerPassword))).toBe(false);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 });
});
