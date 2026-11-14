import {test,expect} from '@playwright/test';
import {readdir,readFile} from 'node:fs/promises';
import {semanticSectionIds} from '../src/lib/article-presentation';

const records:any[]=[];
for(const file of await readdir('src/data'))if(file.endsWith('guides.json'))records.push(...JSON.parse(await readFile('src/data/'+file,'utf8')));
const ids=['b2-usvi-license','fdd-item-15','fdd-item-19','b2-local-jacksonville','state-employer-payroll-registration'];
const prototypes=ids.map(id=>{
 const guide=records.find(record=>record.id===id&&record.status==='published');
 if(!guide)throw new Error('Missing prototype '+id);
 return guide;
});

for(const guide of prototypes)test('one visible answer and optional references: '+guide.id,async({page})=>{
 await page.goto(guide.path);
 await expect(page.locator('h1')).toHaveText(guide.title);
 await expect(page.locator('#start-here')).toHaveCount(1);
 await expect(page.locator('.article-intro > h1 + #start-here')).toHaveText(guide.learningSummary);
 await expect(page.locator('.article-intro .lede,.article-overview')).toHaveCount(0);
 expect(await page.locator('p').evaluateAll((paragraphs,answer)=>paragraphs.filter(paragraph=>paragraph.textContent?.trim()===answer).length,guide.learningSummary)).toBe(1);
 await expect(page.locator('#what-to-prepare h2')).toHaveText('Next step');
 await expect(page.locator('#what-to-prepare p')).toHaveText(guide.practicalOutput);
 await expect(page.locator('.article-aside p')).toHaveCount(0);
 await expect(page.locator('details#sources')).not.toHaveAttribute('open','');
 if(guide.keyTerms?.length){
  await expect(page.locator('details#words-to-know')).not.toHaveAttribute('open','');
  expect(await page.locator('#words-to-know').evaluate(element=>{
   const main=[...document.querySelectorAll('.article-main-section')].at(-1);
   return !main||Boolean(main.compareDocumentPosition(element)&Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
 }else await expect(page.locator('details#words-to-know')).toHaveCount(0);
 for(const id of ['start-here','words-to-know','sources','what-to-prepare','guide-limits','official-federal-explanation','detailed-rules','documented-cases','related-preparation'])await expect(page.locator('[id="'+id+'"]')).toHaveCount(1);
 const related=page.locator('.article-related');
 expect(await related.locator('a').count()).toBeLessThanOrEqual(2);
 await expect(related.locator('p')).toHaveCount(0);
 await expect(page.locator('[data-forward-cta]')).toHaveCount(1);
 const schema=await page.locator('script[type="application/ld+json"]').evaluateAll(scripts=>scripts.map(script=>JSON.parse(script.textContent||'{}')));
 const article=schema.find(record=>record['@type']==='Article');
 expect(article.headline).toBe(guide.title);
 expect(article.dateModified).toBe(guide.contentModifiedAt);
 expect(article.author).toBeUndefined();expect(article.datePublished).toBeUndefined();
});

test('full replacement copy retains both numbered and semantic bookmarks',async({page})=>{
 const guide=prototypes.find(guide=>guide.id==='fdd-item-19');
 const entries=semanticSectionIds(guide.sections);
 for(const alias of ['section-3','how-your-team-can-use-this-information']){
  const entry=entries.find(entry=>entry.id===alias||entry.aliases.includes(alias));
  expect(entry,'Known old bookmark must remain mapped: '+alias).toBeTruthy();
  await page.goto(guide.path+'#'+alias);
  const target=page.locator('[id="'+alias+'"]');
  await expect(target).toHaveCount(1);
  expect(await target.evaluate(element=>element.closest('.article-main-section')?.id)).toBe(entry!.id);
  await expect(page.locator('[id="'+entry!.id+'"] > h2')).toBeInViewport();
 }
});

test('payroll chooser comes immediately after the answer and preserves every jurisdiction row',async({page})=>{
 const guide=prototypes.find(guide=>guide.id==='state-employer-payroll-registration');
 await page.goto(guide.path);
 expect(await page.locator('#start-here').evaluate(element=>element.nextElementSibling?.id)).toBe('choose-jurisdiction');
 const jump=page.locator('#choose-jurisdiction');
 await jump.locator('summary').click();
 await expect(jump.locator('a')).toHaveCount(51);
 const minnesota=jump.getByRole('link',{name:'Minnesota',exact:true});
 const href=await minnesota.getAttribute('href');
 await minnesota.click();
 expect(new URL(page.url()).hash).toBe(href);
 await expect(page.getByRole('heading',{name:'Minnesota',exact:true})).toBeInViewport();
 await expect(page.locator('.article-body table')).toHaveCount(51);
 await expect(page.locator('.article-body table tbody tr')).toHaveCount(102);
});

test('FDD reference links are optional and keep their historical guidance date',async({page})=>{
 await page.goto(prototypes.find(guide=>guide.id==='fdd-item-15').path);
 const sources=page.locator('details#sources');
 await expect(sources).not.toHaveAttribute('open','');
 await sources.locator(':scope > summary').click();
 const federal=page.locator('#official-federal-explanation');
 await expect(federal.locator('a')).toHaveCount(4);
 await expect(federal).toContainText('May 2008');
 await expect(federal).toContainText('current regulation');
});

test('prototype answers and jurisdiction navigation work without JavaScript',async({browser,baseURL})=>{
 const context=await browser.newContext({javaScriptEnabled:false,baseURL});
 const page=await context.newPage();
 try{
  for(const guide of prototypes){
   await page.goto(guide.path);
   await expect(page.locator('#start-here')).toBeVisible();
   await expect(page.locator('#start-here')).toHaveText(guide.learningSummary);
  }
  await page.locator('#choose-jurisdiction > summary').click();
  await expect(page.locator('#choose-jurisdiction a')).toHaveCount(51);
 }finally{await context.close();}
});

test('narrow screens keep the answer, tables and library usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const path of [...prototypes.map(guide=>guide.path),'/guides/']){
  await page.goto(path);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),path).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),path).toBe(true);
  await expect(page.locator('[data-forward-cta]')).toHaveCount(1);
 }
 await page.goto('/guides/');
 await expect(page.getByRole('searchbox',{name:'Search guides'})).toBeInViewport();
 await page.getByRole('searchbox',{name:'Search guides'}).fill('Jacksonville');
 await expect(page.locator('.guide-entry:visible')).toHaveCount(1);
 await page.locator('#browse-collections > summary').click();
 await expect(page.locator('#browse-collections a[href^="/topics/"]')).toHaveCount(21);
});
