import {test,expect} from '@playwright/test';
import {readdir,readFile} from 'node:fs/promises';
const storageKey='eln-learning-v1';
const files=await readdir('src/data');
const guides=(await Promise.all(files.filter(file=>file.endsWith('guides.json')).map(async file=>JSON.parse(await readFile('src/data/'+file,'utf8'))))).flat().filter(guide=>guide.status==='published');
const tools=JSON.parse(await readFile('src/data/tool-definitions.json','utf8'));

test('all published guides and tools have accessible library links without gates',async({page})=>{
 await page.goto('/learn/');await expect(page.getByRole('heading',{level:1})).toHaveText('A clearer next decision.');
 const catalog=await page.request.get('/learn/catalog.json');expect(catalog.status()).toBe(200);expect(catalog.headers()['x-robots-tag']).toBe('noindex');
 expect((await catalog.json()).items).toHaveLength(guides.length+tools.length);
 await expect(page.locator('.learning-library .learning-reading-row')).toHaveCount(guides.length+tools.length);
 for(const guide of guides)await expect(page.locator('.learning-library a[href="'+guide.path+'"]')).toHaveCount(1);
 for(const tool of tools)await expect(page.locator('.learning-library a[href="'+tool.path+'"]')).toHaveCount(1);
 await expect(page.getByRole('checkbox',{name:'Remember learning progress on this device'})).not.toBeChecked();
 await expect(page.locator('[data-forward-cta]')).toHaveCount(1);
 await page.getByLabel('Find a guide, place or tool').fill('Item 19');
 await expect(page.locator('.learning-library a[href="/fdd/item-19/"]')).toHaveText('FDD Item 19: what can you say about earnings?');
 expect(await page.locator('.learning-library .learning-reading-row').count()).toBeLessThan(guides.length+tools.length);
});

test('progress stays off by default, then opt-in saves minimal progress with idempotent XP, export and reset',async({page})=>{
 const mutations:string[]=[];page.on('request',request=>{if(request.method()!=='GET')mutations.push(request.method()+' '+request.url());});
 await page.goto('/learn/');const first=page.locator('#path-detail .learning-reading-row').first();
 await first.getByRole('button',{name:/^Mark complete:/}).click();
 expect(await page.evaluate(key=>localStorage.getItem(key),storageKey)).toBeNull();
 await page.getByRole('checkbox',{name:'Remember learning progress on this device'}).check();
 await first.getByRole('button',{name:/^Bookmark:/}).click();
 const practice=page.locator('[data-challenge-id="licence-label"]');await practice.locator(':scope > summary').click();
 await practice.getByLabel('Examine the complete relationship, then any exclusion or exemption.').check();
 await practice.getByRole('button',{name:'Check the reasoning'}).click();await expect(page.locator('.learning-score>strong')).toHaveText(/^\s*30\s*XP\s*$/);
 await practice.getByRole('button',{name:'Check the reasoning'}).click();await expect(page.locator('.learning-score>strong')).toHaveText(/^\s*30\s*XP\s*$/);
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),storageKey);
 expect(saved.remember).toBe(true);expect(Object.keys(saved.progress)).toEqual(['version','items','solved','activePath','lastItem']);
 expect(saved.progress.solved['licence-label']).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(saved)).not.toMatch(/email|company|answer|licence title/i);
 await page.reload();await expect(page.locator('.learning-score>strong')).toHaveText(/^\s*30\s*XP\s*$/);await expect(page.locator('#path-detail .learning-reading-row').first().getByRole('button',{name:/^Unmark complete:/})).toHaveAttribute('aria-pressed','true');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export learning progress'}).click();const download=await downloadPromise;
 expect(download.suggestedFilename()).toBe('eln-learning-progress.json');const exported=JSON.parse(await readFile((await download.path())!,'utf8'));expect(exported.solved['licence-label']).toBe(saved.progress.solved['licence-label']);
 await page.evaluate(()=>localStorage.setItem('unrelated-plan-fixture','keep'));
 await page.getByRole('button',{name:'Reset learning progress'}).click();await page.getByRole('button',{name:'Clear learning progress',exact:true}).click();
 expect(await page.evaluate(key=>localStorage.getItem(key),storageKey)).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('unrelated-plan-fixture'))).toBe('keep');
 await expect(page.locator('.learning-score>strong')).toHaveText(/^\s*0\s*XP\s*$/);await expect(page.getByRole('checkbox',{name:'Remember learning progress on this device'})).not.toBeChecked();expect(mutations).toEqual([]);
});

test('blank is unknown, zero is valid and stale practice versions lose mastery until revisited',async({page})=>{
 await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({remember:true,progress:{version:1,items:{},solved:{'manager-remainder':'a'.repeat(64)},activePath:'economics',lastItem:null}})),storageKey);
 await page.goto('/learn/?path=economics');await expect(page.locator('.learning-score>strong')).toHaveText(/^\s*0\s*XP\s*$/);
 const practice=page.locator('[data-challenge-id="manager-remainder"]');await expect(practice.locator(':scope > summary')).toContainText('updated since your practice');await practice.locator(':scope > summary').click();
 await practice.getByRole('button',{name:'Check the reasoning'}).click();await expect(practice.getByRole('status')).toContainText('blank answer is not zero');
 await practice.getByLabel('Your answer (USD)').fill('0');await practice.getByRole('button',{name:'Check the reasoning'}).click();
 await expect(practice.getByRole('status')).toContainText('$180,000 − $120,000 − $60,000 = $0');await expect(page.locator('.learning-score>strong')).toHaveText(/^\s*20\s*XP\s*$/);
 await practice.getByRole('button',{name:'Check the reasoning'}).click();await expect(page.locator('.learning-score>strong')).toHaveText(/^\s*20\s*XP\s*$/);
});

test('clearing site storage in another tab also stops remembering in the open learning page',async({page,context})=>{
 await page.goto('/learn/');await page.getByRole('checkbox',{name:'Remember learning progress on this device'}).check();
 await page.locator('#path-detail .learning-reading-row').first().getByRole('button',{name:/^Mark complete:/}).click();
 await expect(page.locator('.learning-score>strong')).toHaveText(/^\s*10\s*XP\s*$/);
 const other=await context.newPage();try{await other.goto('/learn/');await expect(other.locator('.learning-score>strong')).toHaveText(/^\s*10\s*XP\s*$/);await other.evaluate(()=>localStorage.clear());
  await expect(page.locator('.learning-score>strong')).toHaveText(/^\s*0\s*XP\s*$/);await expect(page.getByRole('checkbox',{name:'Remember learning progress on this device'})).not.toBeChecked();
  await page.locator('#path-detail .learning-reading-row').first().getByRole('button',{name:/^Mark complete:/}).click();expect(await page.evaluate(key=>localStorage.getItem(key),storageKey)).toBeNull();
 }finally{await other.close();}
});

test('the session restores only real catalogue items on initial load and cross-tab updates',async({page,context})=>{
 const stored={remember:true,progress:{version:1,items:{'guide:fdd-item-15':{status:'complete',bookmarked:true},'tool:economics':{status:'complete',bookmarked:false},'guide:invented-but-valid':{status:'complete',bookmarked:true},'tool:invented-tool':{status:'complete',bookmarked:true}},solved:{},activePath:'model-offer',lastItem:'guide:invented-but-valid'}};
 await page.addInitScript(({key,saved})=>localStorage.setItem(key,JSON.stringify(saved)),{key:storageKey,saved:stored});
 await page.goto('/fdd/item-15/');await expect(page.locator('[data-learning-item="guide:fdd-item-15"]').getByRole('button',{name:'Marked as read',exact:true})).toBeEnabled();
 const other=await context.newPage();try{
  await other.goto('/learn/');await expect(other.locator('.learning-score>strong')).toHaveText(/^\s*25\s*XP\s*$/);
  const inspectExport=async()=>{const pending=other.waitForEvent('download');await other.getByRole('button',{name:'Export learning progress'}).click();return JSON.parse(await readFile((await(await pending).path())!,'utf8'));};
  let exported=await inspectExport();expect(Object.keys(exported.items).sort()).toEqual(['guide:fdd-item-15','tool:economics']);expect(exported.lastItem).toBeNull();
  await page.evaluate(({key,saved})=>localStorage.setItem(key,JSON.stringify({...saved,progress:{...saved.progress,items:{...saved.progress.items,'tool:economics':{status:'reading',bookmarked:true}}}})),{key:storageKey,saved:stored});
  await expect(other.locator('.learning-score>strong')).toHaveText(/^\s*10\s*XP\s*$/);
  exported=await inspectExport();expect(Object.keys(exported.items).sort()).toEqual(['guide:fdd-item-15','tool:economics']);expect(exported.lastItem).toBeNull();
 }finally{await other.close();}
});

test('an unavailable catalogue keeps controls usable without restoring or overwriting saved records',async({page})=>{
 const saved=JSON.stringify({remember:true,progress:{version:1,items:{'guide:fdd-item-15':{status:'complete',bookmarked:true},'guide:invented':{status:'complete',bookmarked:true}},solved:{},activePath:'model-offer',lastItem:'guide:invented'}});
 await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:storageKey,value:saved});
 await page.route('**/learn/catalog.json',route=>route.fulfill({status:503,body:'Unavailable'}));
 await page.goto('/learn/');await expect(page.getByRole('alert')).toContainText('existing saved copy has not been changed');
 await page.locator('#path-detail .learning-reading-row').first().getByRole('button',{name:/^Mark complete:/}).click();
 await expect(page.locator('.learning-score>strong')).toHaveText(/^\s*10\s*XP\s*$/);
 const practice=page.locator('[data-challenge-id="licence-label"]');await practice.locator(':scope > summary').click();
 await practice.getByLabel('Examine the complete relationship, then any exclusion or exemption.').check();
 await practice.getByRole('button',{name:'Check the reasoning'}).click();await expect(page.locator('.learning-score>strong')).toHaveText(/^\s*30\s*XP\s*$/);
 await page.getByRole('checkbox',{name:'Remember learning progress on this device'}).click();
 await expect(page.getByRole('checkbox',{name:'Remember learning progress on this device'})).not.toBeChecked();
 expect(await page.evaluate(key=>localStorage.getItem(key),storageKey)).toBe(saved);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export learning progress'}).click();const exported=JSON.parse(await readFile((await(await pending).path())!,'utf8'));
 expect(exported.items['guide:invented']).toBeUndefined();expect(exported.items['guide:fdd-item-15']).toBeUndefined();expect(Object.keys(exported.items)).toHaveLength(1);expect(exported.solved['licence-label']).toMatch(/^[a-f0-9]{64}$/);expect(exported.answer).toBeUndefined();
});

test('article bookmarks and tool status connect to the same optional library',async({page})=>{
 await page.goto('/fdd/item-15/');const article=page.locator('[data-learning-item="guide:fdd-item-15"]');await article.locator('.learning-privacy>summary').click();
 await article.getByRole('checkbox',{name:'Remember learning progress on this device'}).check();await article.getByRole('button',{name:'Mark as read',exact:true}).click();await article.getByRole('button',{name:/^Bookmark:/}).click();
 await page.goto('/tools/us-unit-economics/');const tool=page.locator('[data-learning-item="tool:economics"]');await tool.getByRole('button',{name:'Mark tool as tried'}).click();
 await page.goto('/learn/');await expect(page.locator('.learning-score>strong')).toHaveText(/^\s*25\s*XP\s*$/);
 await page.getByRole('combobox',{name:'Show',exact:true}).selectOption('bookmarks');await expect(page.locator('.learning-library .learning-reading-row')).toHaveCount(1);await expect(page.locator('.learning-library a')).toHaveAttribute('href','/fdd/item-15/');
});

test('corrupt or blocked local storage preserves reading and remembers the selected path only after opt-in',async({page})=>{
 await page.goto('/learn/');await page.evaluate(key=>localStorage.setItem(key,'{bad json'),storageKey);await page.goto('/learn/?path=people');
 await expect(page.getByRole('alert')).toContainText('could not be read');await expect(page.getByRole('checkbox',{name:'Remember learning progress on this device'})).not.toBeChecked();
 await expect(page.locator('#active-path-title')).toHaveText('Plan the people doing the work.');
 await page.evaluate(()=>{const original=Storage.prototype.setItem;(window as any).__elnRestoreStorage=()=>{Storage.prototype.setItem=original;delete(window as any).__elnRestoreStorage;};Storage.prototype.setItem=function(){throw new DOMException('Storage blocked','QuotaExceededError');};});
 await page.getByRole('checkbox',{name:'Remember learning progress on this device'}).click();await expect(page.getByRole('alert')).toContainText('could not save');await expect(page.getByRole('checkbox',{name:'Remember learning progress on this device'})).not.toBeChecked();
 await expect(page.locator('#path-detail a').first()).toHaveAttribute('href','/us-expansion/business-visits/');
 await page.evaluate(()=>(window as any).__elnRestoreStorage());
 await page.getByRole('checkbox',{name:'Remember learning progress on this device'}).check();
 expect((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),storageKey)).progress.activePath).toBe('people');
 await page.locator('.learning-path-picker>summary').click();await page.getByRole('navigation',{name:'Learning paths'}).getByRole('link',{name:/Make the numbers work/}).click();
 expect((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),storageKey)).progress.activePath).toBe('economics');
 await page.goBack();await expect(page.locator('#active-path-title')).toHaveText('Plan the people doing the work.');
 expect((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),storageKey)).progress.activePath).toBe('people');
 await page.goto('/learn/');await expect(page.locator('#active-path-title')).toHaveText('Plan the people doing the work.');await expect(page.locator('[data-forward-cta]')).toHaveAttribute('href','/us-expansion/business-visits/');
});

test('learning and quiet hooks fit mobile and remain keyboard accessible with one primary action',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width:390,height:844});
 for(const path of ['/learn/','/learn/?path=people','/fdd/item-19/','/tools/cash-runway/']){
  await page.goto(path);await expect(page.locator('[data-forward-cta]')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path).toBe(true);
  await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path).toBe(true);
 }
 await page.goto('/learn/');await page.locator('.learning-path-picker>summary').click();const pathLink=page.getByRole('navigation',{name:'Learning paths'}).getByRole('link',{name:/Plan the people/});await pathLink.focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Plan the people doing the work.',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});

test('public articles remain complete without JavaScript and learning never gates them',async({browser,baseURL})=>{
 const context=await browser.newContext({javaScriptEnabled:false,baseURL});const page=await context.newPage();
 try{
  await page.goto('/fdd/item-15/');await expect(page.locator('#start-here')).toBeVisible();await expect(page.locator('.article-main-section')).toHaveCount(3);await expect(page.locator('[data-learning-item] button').first()).toBeDisabled();
  await page.goto('/tools/us-unit-economics/');await expect(page.getByRole('heading',{level:1})).toHaveCount(1);await expect(page.getByRole('heading',{level:1})).toHaveText('U.S. unit economics');await expect(page.locator('.planning-shell .lede')).toBeVisible();
  await page.goto('/learn/');await expect(page.getByLabel('Find a guide, place or tool')).toBeDisabled();await expect(page.locator('.learning-noscript')).toBeVisible();await expect(page.locator('.learning-library .learning-reading-row')).toHaveCount(guides.length+tools.length);
  await page.locator('[data-challenge-id="licence-label"]>summary').click();await page.locator('[data-challenge-id="licence-label"] .learning-practice-explanation>summary').click();await expect(page.locator('[data-challenge-id="licence-label"] .learning-practice-explanation')).toContainText('State definitions and sales duties');
  await page.locator('.learning-path-picker>summary').click();await page.getByRole('navigation',{name:'Learning paths'}).getByRole('link',{name:/Plan the people/}).click();
  await expect(page).toHaveURL(/path=people#learning-path-people$/);await expect(page.locator('#learning-path-people')).toBeVisible();await expect(page.locator('#learning-path-people a[href="/us-expansion/business-visits/"]')).toHaveCount(1);
 }finally{await context.close();}
});

test('selected-path actions stay relevant and browser Back restores the earlier path',async({page})=>{
 const economics=guides.find(guide=>guide.path==='/us-expansion/management-independence/')!;
 await page.addInitScript(({key,item})=>localStorage.setItem(key,JSON.stringify({remember:true,progress:{version:1,items:{[item]:{status:'reading',bookmarked:false}},solved:{},activePath:'economics',lastItem:item}})),{key:storageKey,item:'guide:'+economics.id});
 await page.goto('/learn/?path=people');await expect(page.locator('#active-path-title')).toHaveText('Plan the people doing the work.');
 await expect(page.locator('[data-forward-cta]')).toHaveAttribute('href','/us-expansion/business-visits/');
 await expect(page.locator('.learning-path-picker')).not.toHaveAttribute('open','');
 await page.locator('.learning-path-picker>summary').click();
 await page.getByRole('navigation',{name:'Learning paths'}).getByRole('link',{name:/Make the numbers work/}).click();
 await expect(page).toHaveURL(/path=economics#path-detail$/);await expect(page.locator('[data-forward-cta]')).toContainText('Resume:');
 await expect(page.locator('[data-forward-cta]')).toHaveAttribute('href',economics.path);
 await page.goBack();await expect(page.locator('#active-path-title')).toHaveText('Plan the people doing the work.');
 await expect(page.locator('[data-forward-cta]')).toHaveAttribute('href','/us-expansion/business-visits/');
 await page.goForward();await expect(page.locator('#active-path-title')).toHaveText('Make the numbers work.');
});

test('library search uses the public explanation and empty filters offer a clear way back',async({page})=>{
 await page.goto('/learn/');await page.getByRole('link',{name:'Search the full library',exact:true}).click();
 await expect(page.getByLabel('Find a guide, place or tool')).toBeFocused();
 await page.getByLabel('Find a guide, place or tool').fill('billed route');
 const travel=page.locator('.learning-library [data-catalog-key="guide:nr-guide-travel"]');
 await expect(travel).toBeVisible();await expect(travel.locator('.learning-item-description')).toContainText('hours billed at customer premises');
 await page.getByLabel('Find a guide, place or tool').fill('no-such-guide-xyz');
 await expect(page.getByRole('heading',{name:'No matching readings yet.'})).toBeVisible();
 await page.getByRole('button',{name:'Clear search and filters'}).click();
 await expect(page.getByLabel('Find a guide, place or tool')).toHaveValue('');await expect(page.getByLabel('Find a guide, place or tool')).toBeFocused();
 await page.getByRole('combobox',{name:'Show',exact:true}).selectOption('bookmarks');
 await expect(page.getByRole('heading',{name:'Keep a useful reading for later.'})).toBeVisible();
 await page.getByRole('button',{name:'Clear search and filters'}).click();
 await expect(page.getByRole('combobox',{name:'Show',exact:true})).toHaveValue('all');
 await expect(page.locator('.learning-library .learning-reading-row')).toHaveCount(guides.length+tools.length);
});

test('finishing the starting steps leads to optional practice, not an unrelated reading',async({page})=>{
 await page.goto('/learn/');const steps=page.locator('#path-detail>ol>.learning-reading-row');
 for(let index=0;index<await steps.count();index++)await steps.nth(index).getByRole('button',{name:/^Mark complete:/}).click();
 await expect(page.locator('.learning-path-complete')).toContainText('Starting steps marked complete');
 await expect(page.locator('[data-forward-cta]')).toHaveText(/Try this path’s practice/);
 await expect(page.locator('[data-forward-cta]')).toHaveAttribute('href','#path-practice');
 await page.locator('[data-forward-cta]').click();await expect(page.locator('#path-practice h3')).toBeInViewport();
 await expect(page.locator('#path-detail>ol a')).toHaveCount(5);
});
