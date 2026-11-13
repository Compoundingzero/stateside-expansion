import {test,expect} from '@playwright/test';

test('an FDD learning path connects readable lessons and accurate search metadata',async({page})=>{
 await page.goto('/topics/fdd/');
 const lesson=page.getByRole('link',{name:/FDD Item 19:/}).first();
 await expect(lesson).toBeVisible();await lesson.click();
 await expect(page).toHaveURL(/\/fdd\/item-19\/$/);
 await expect(page).toHaveTitle(/FDD Item 19: Financial Performance Representations and Earnings/);
 const heading=await page.locator('h1').innerText();
 expect(heading).toContain('what do the sales and profit figures really mean');
 const records=await page.locator('script[type="application/ld+json"]').evaluateAll(scripts=>scripts.map(script=>JSON.parse(script.textContent||'{}')));
 const article=records.find(record=>record['@type']==='Article');
 expect(article.headline).toBe(heading);expect(article.publisher.name).toContain('ELN');
 expect(article.dateModified).toBe(await page.locator('.article-date time[datetime*="T"]').getAttribute('datetime'));
 const crumbs=records.find(record=>record['@type']==='BreadcrumbList');
 expect(crumbs.itemListElement.some((item:any)=>item.item.endsWith('/topics/fdd/'))).toBe(true);
 const relatedCount=await page.locator('#related-preparation li').count();
 expect(relatedCount).toBeGreaterThanOrEqual(3);expect(relatedCount).toBeLessThanOrEqual(5);
 await expect(page.locator('[data-forward-cta]')).toHaveCount(1);
});

test('an existing numbered section link retains its original lesson after an insertion',async({page})=>{
 await page.goto('/fdd/item-19/#section-3');
 const section=page.locator('section').filter({has:page.locator('#section-3')});
 await expect(section.locator('h2')).toHaveText('How your team can use this information');
 await expect(section.locator('h2')).toBeInViewport();
});

test('payroll readers can jump directly to a jurisdiction without losing reference rows',async({page})=>{
 await page.goto('/us-expansion/state-employer-payroll-registration/');
 const jump=page.locator('#choose-jurisdiction');
 await jump.locator('summary').click();
 await expect(jump.locator('a')).toHaveCount(51);
 await jump.getByRole('link',{name:'Minnesota',exact:true}).click();
 await expect(page).toHaveURL(/#minnesota$/);
 await expect(page.getByRole('heading',{name:'Minnesota',exact:true})).toBeInViewport();
 await expect(page.locator('.article-body table')).toHaveCount(51);
});

test('article tables and hub navigation fit a narrow screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const path of ['/territories/us-virgin-islands/','/comparisons/dallas-san-antonio-occupancy/','/fdd/item-21/','/topics/employment/']){
  await page.goto(path);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),path).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),path).toBe(true);
  await expect(page.locator('[data-forward-cta]')).toHaveCount(1);
 }
});
