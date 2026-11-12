import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'**/*.e2e.spec.ts',fullyParallel:false,workers:1,retries:0,timeout:45000,
 use:{baseURL:process.env.TEST_BASE_URL||'http://127.0.0.1:3000',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']},trace:'retain-on-failure',screenshot:'only-on-failure'},
 reporter:[['list'],['html',{outputFolder:'artifacts/browser-report',open:'never'}]],
 outputDir:'artifacts/browser-results'
});
