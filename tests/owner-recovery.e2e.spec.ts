import {test as base, expect, type Page} from '@playwright/test';
import {spawn} from 'node:child_process';
import {scryptSync} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {expectOnePrimaryAction} from './fixtures/submissions';

// The suite always owns a new loopback server and temporary database. It never
// uses TEST_BASE_URL, Railway variables, the production database, or real codes.
const root = fileURLToPath(new URL('../', import.meta.url));
const password = 'Fictional-QA-owner-password-94!';
const nextPassword = 'Fictional-QA-new-password-27!';
const thirdPassword = 'Fictional-QA-third-password-62!';
type LocalServer = {origin: string; setupToken: string};

function seedLegacyOwner(path: string) {
  const db = new DatabaseSync(path);
  const salt = 'ab'.repeat(16);
  const digest = scryptSync(password, salt, 64, {N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024}).toString('hex');
  db.exec(`CREATE TABLE owner_account (id INTEGER PRIMARY KEY CHECK(id=1), password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE owner_sessions (token_hash TEXT PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES owner_account(id) ON DELETE CASCADE, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE INDEX owner_sessions_expiry ON owner_sessions(expires_at);
    CREATE TABLE submissions (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('interest','enquiry')), name TEXT, company TEXT, arr TEXT, email TEXT NOT NULL, comments TEXT, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in-progress','closed')), created_at TEXT NOT NULL);
    CREATE INDEX submissions_kind_created ON submissions(kind,created_at DESC); PRAGMA user_version=1;`);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO owner_account VALUES(1,?,?)').run(`scrypt$16384$8$1$${salt}$${digest}`, now);
  db.prepare("INSERT INTO submissions VALUES('00000000-0000-0000-0000-000000000001','interest','Legacy QA owner','Fictional migration test',NULL,'qa-legacy@example.invalid',NULL,'in-progress',?)").run(now);
  db.close();
}

const test = base.extend<{isolated: LocalServer; legacyOwner: boolean}>({
  legacyOwner: [false, {option: true}],
  isolated: async ({legacyOwner}, use) => {
    const directory = await mkdtemp(join(tmpdir(), 'eln-recovery-browser-'));
    if (legacyOwner) seedLegacyOwner(join(directory, 'eln.sqlite'));
    const reservation = createServer();
    await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = (reservation.address() as {port: number}).port;
    await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
    const origin = `http://127.0.0.1:${port}`;
    const setupToken = 'fictional-recovery-suite-only-token-'.repeat(2);
    const child = spawn(process.execPath, ['server.mjs'], {
      cwd: root,
      env: {PATH: process.env.PATH || '', NODE_ENV: 'test', PORT: String(port), PUBLIC_SITE_URL: origin, ELN_DATA_DIRECTORY: directory, ELN_SETUP_TOKEN: setupToken},
      stdio: 'ignore',
    });
    let stopped = false;
    child.once('exit', () => { stopped = true; });
    child.once('error', () => { stopped = true; });
    try {
      const deadline = Date.now() + 15000;
      let ready = false;
      while (Date.now() < deadline && !stopped) {
        ready = await fetch(`${origin}/health`).then(response => response.ok).catch(() => false);
        if (ready) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!ready) throw new Error('The disposable owner-recovery server did not start. Build the local site before running this suite.');
      await use({origin, setupToken});
    } finally {
      if (!stopped) {
        child.kill('SIGTERM');
        await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
        if (!stopped) child.kill('SIGKILL');
      }
      await rm(directory, {recursive: true, force: true});
    }
  },
});

async function request(page: Page, path: string, body?: unknown) {
  return page.evaluate(async ({path, body}) => {
    const response = await fetch(path, {method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', ...(body === undefined ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})});
    const text = await response.text();
    return {status: response.status, data: JSON.parse(text), text};
  }, {path, body});
}
async function noStoredSecrets(page: Page, values: string[]) {
  const state = await page.evaluate(() => JSON.stringify({local: Object.entries(localStorage), session: Object.entries(sessionStorage), cookies: document.cookie, history: history.state, url: location.href}));
  for (const value of values) expect(state).not.toContain(value);
  expect(new URL(page.url()).search).toBe('');
  expect(new URL(page.url()).hash).toBe('');
}
async function setup(page: Page, server: LocalServer) {
  await page.goto(`${server.origin}/owner/setup/#token=${server.setupToken}`);
  await page.getByLabel('Password', {exact: true}).fill(password);
  await page.getByLabel('Confirm password', {exact: true}).fill(password);
  await page.getByRole('button', {name: 'Set owner password', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Save your recovery codes.', exact: true})).toBeVisible();
  const list = page.getByRole('list', {name: 'One-use recovery codes'}).locator('code');
  await expect(list).toHaveCount(8);
  return list.allTextContents();
}
async function saved(page: Page) {
  await page.getByRole('checkbox', {name: 'I have saved these recovery codes securely.', exact: true}).check();
  await page.getByRole('button', {name: 'Continue to owner board', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Private submissions', exact: true})).toBeVisible();
}
async function login(page: Page, server: LocalServer, value = password) {
  await page.goto(`${server.origin}/owner/`);
  await page.getByLabel('Password', {exact: true}).fill(value);
  await page.getByRole('button', {name: 'Sign in', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Private submissions', exact: true})).toBeVisible();
}
async function recover(page: Page, server: LocalServer, code: string, value = nextPassword) {
  await page.goto(`${server.origin}/owner/recover/`);
  await page.getByLabel('Recovery code', {exact: true}).fill(code);
  await page.getByLabel('New password', {exact: true}).fill(value);
  await page.getByLabel('Confirm new password', {exact: true}).fill(value);
  await page.getByRole('button', {name: 'Reset owner password', exact: true}).click();
}

test('new setup shows eight codes once, supports a local download and clears private browser state', async ({page, isolated}) => {
  const urls: string[] = [];
  page.on('request', value => urls.push(value.url()));
  await page.setViewportSize({width: 390, height: 844});
  const codes = await setup(page, isolated);
  expect(new Set(codes).size).toBe(8);
  for (const code of codes) expect(code).toMatch(/^ELN-(?:[A-F0-9]{8}-){5}[A-F0-9]{8}$/i);
  await expectOnePrimaryAction(page);
  await expect(page.getByRole('button', {name: 'Continue to owner board', exact: true})).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download recovery codes', exact: true}).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('eln-owner-recovery-codes.txt');
  const text = await readFile((await download.path())!, 'utf8');
  for (const code of codes) expect(text).toContain(code);
  expect(text).not.toContain(password);
  await noStoredSecrets(page, [password, isolated.setupToken, ...codes]);
  await saved(page);
  await expect(page.locator('body')).not.toContainText(codes[0]);
  await page.reload();
  await expect(page.getByRole('region', {name: 'Private submissions', exact: true})).toBeVisible();
  const session = await request(page, '/api/owner/session');
  expect(session.data).toEqual({authenticated: true, configured: true, recoveryConfigured: true});
  for (const code of codes) expect(session.text).not.toContain(code);
  await page.goto(`${isolated.origin}/owner/setup/`);
  await expect(page.getByRole('heading', {name: 'Owner access is ready.', exact: true})).toBeVisible();
  expect((await request(page, '/api/owner/setup', {token: isolated.setupToken, password})).status).toBe(409);
  await noStoredSecrets(page, [password, isolated.setupToken, ...codes]);
  for (const url of urls) for (const secret of [password, isolated.setupToken, ...codes]) expect(url).not.toContain(secret);
});

test('lost-password recovery consumes one code, revokes every session and requires sign-in', async ({page, browser, isolated}) => {
  const codes = await setup(page, isolated);
  await saved(page);
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await login(otherPage, isolated);
    await recover(page, isolated, 'Fictional invalid recovery code');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('Recovery code', {exact: true})).toHaveValue('');
    await expect(page.locator('body')).not.toContainText(codes[0]);
    await recover(page, isolated, codes[0]);
    await expect(page.getByRole('heading', {name: 'Access recovered.', exact: true})).toBeVisible();
    await expectOnePrimaryAction(page);
    expect((await request(page, '/api/owner/session')).data).toEqual({authenticated: false, configured: true});
    expect((await request(otherPage, '/api/owner/submissions?kind=interest')).status).toBe(401);
    await page.getByRole('link', {name: 'Sign in', exact: true}).click();
    await page.getByLabel('Password', {exact: true}).fill(password);
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await expect(page.getByRole('alert')).toContainText('Sign-in could not be completed');
    await login(page, isolated, nextPassword);
    await recover(page, isolated, codes[0], thirdPassword);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Access recovered.', exact: true})).toHaveCount(0);
    await recover(page, isolated, codes[1], thirdPassword);
    await expect(page.getByRole('heading', {name: 'Access recovered.', exact: true})).toBeVisible();
    await login(page, isolated, thirdPassword);
    await noStoredSecrets(page, [password, nextPassword, thirdPassword, ...codes]);
  } finally { await other.close(); }
});

test('password change requires reauthentication, revokes sessions and preserves unused recovery codes', async ({page, browser, isolated}) => {
  const codes = await setup(page, isolated);
  await saved(page);
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await login(otherPage, isolated);
    await page.getByRole('link', {name: 'Security settings', exact: true}).click();
    await expect(page.getByRole('tab', {name: 'Password', exact: true})).toHaveAttribute('aria-selected', 'true');
    await expectOnePrimaryAction(page);
    await page.getByLabel('Current password', {exact: true}).fill('Fictional-wrong-current-password');
    await page.getByLabel('New password', {exact: true}).fill(nextPassword);
    await page.getByLabel('Confirm new password', {exact: true}).fill('Fictional-mismatch-password');
    await page.getByRole('button', {name: 'Change password', exact: true}).click();
    await expect(page.getByRole('alert')).toContainText('highlighted');
    await expect(page.getByLabel('Confirm new password', {exact: true})).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('Confirm new password', {exact: true}).fill(nextPassword);
    await page.getByRole('button', {name: 'Change password', exact: true}).click();
    await expect(page.getByRole('alert')).toContainText('current password');
    await expect(page.getByLabel('Current password', {exact: true})).toHaveValue('');
    await page.getByLabel('Current password', {exact: true}).fill(password);
    await page.getByLabel('New password', {exact: true}).fill(nextPassword);
    await page.getByLabel('Confirm new password', {exact: true}).fill(nextPassword);
    await page.getByRole('button', {name: 'Change password', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'Password changed.', exact: true})).toBeVisible();
    expect((await request(page, '/api/owner/session')).data.authenticated).toBe(false);
    expect((await request(otherPage, '/api/owner/session')).data.authenticated).toBe(false);
    await login(page, isolated, nextPassword);
    await recover(page, isolated, codes[0], thirdPassword);
    await expect(page.getByRole('heading', {name: 'Access recovered.', exact: true})).toBeVisible();
    await noStoredSecrets(page, [password, nextPassword, thirdPassword, ...codes]);
  } finally { await other.close(); }
});

test('replacing the recovery set requires the current password and invalidates the old codes', async ({page, isolated}) => {
  const oldCodes = await setup(page, isolated);
  await saved(page);
  await page.getByRole('link', {name: 'Security settings', exact: true}).click();
  await page.getByRole('tab', {name: 'Password', exact: true}).press('ArrowRight');
  await expect(page.getByRole('tab', {name: 'Recovery codes', exact: true})).toBeFocused();
  await expectOnePrimaryAction(page);
  await expect(page.getByLabel('New password', {exact: true})).toHaveCount(0);
  await page.getByLabel('Current password', {exact: true}).fill('Fictional-wrong-current-password');
  await page.getByRole('button', {name: 'Replace recovery codes', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('current password');
  await page.getByLabel('Current password', {exact: true}).fill(password);
  await page.getByRole('button', {name: 'Replace recovery codes', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Save your recovery codes.', exact: true})).toBeVisible();
  const codes = await page.getByRole('list', {name: 'One-use recovery codes'}).locator('code').allTextContents();
  expect(codes).toHaveLength(8);
  expect(codes.some(code => oldCodes.includes(code))).toBe(false);
  await expect(page.locator('body')).toContainText('Your previous recovery codes no longer work.');
  await saved(page);
  await page.goto(`${isolated.origin}/owner/security/`);
  await expect(page.getByRole('heading', {name: 'Change your password.', exact: true})).toBeVisible();
  await expect(page.locator('body')).not.toContainText(codes[0]);
  await recover(page, isolated, oldCodes[0]);
  await expect(page.getByRole('alert')).toBeVisible();
  await recover(page, isolated, codes[0]);
  await expect(page.getByRole('heading', {name: 'Access recovered.', exact: true})).toBeVisible();
  await noStoredSecrets(page, [password, nextPassword, ...oldCodes, ...codes]);
});

test('manual backup requires the current password and reports failure or verified safe metadata clearly', async ({page, isolated}) => {
  const codes = await setup(page, isolated);
  await saved(page);
  await page.setViewportSize({width: 390, height: 844});
  await page.getByRole('link', {name: 'Security settings', exact: true}).click();
  await page.getByRole('tab', {name: 'Password', exact: true}).press('End');
  await expect(page.getByRole('tab', {name: 'Backups', exact: true})).toBeFocused();
  await expect(page.getByLabel('New password', {exact: true})).toHaveCount(0);
  await expectOnePrimaryAction(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByLabel('Current password', {exact: true}).fill('Fictional-wrong-current-password');
  await page.getByRole('button', {name: 'Create verified backup', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('current password');
  await page.getByLabel('Current password', {exact: true}).fill(password);
  const unavailable = page.waitForResponse(response => response.url().endsWith('/api/owner/backup') && response.request().method() === 'POST');
  await page.getByRole('button', {name: 'Create verified backup', exact: true}).click();
  expect((await unavailable).status()).toBe(503); // This isolated server has no object-storage configuration.
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Backup verified.', exact: true})).toHaveCount(0);
  await expect(page.getByLabel('Current password', {exact: true})).toHaveValue('');
  // Exercise the safe-result presentation without contacting real object storage.
  await page.route('**/api/owner/backup', route => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({ok: true, completedAt: '2026-11-13T00:30:00.000Z', integrity: {integrityCheck: 'ok', foreignKeys: 'ok'}, retentionDays: 6, retentionStatus: 'failed'})}));
  await page.getByLabel('Current password', {exact: true}).fill(password);
  await page.getByRole('button', {name: 'Create verified backup', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Backup verified.', exact: true})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Retention: 6 days.');
  await expect(page.getByRole('status')).toContainText('cleanup did not complete');
  await expect(page.getByRole('status').locator('time')).toHaveAttribute('datetime', '2026-11-13T00:30:00.000Z');
  await expect(page.getByLabel('Current password', {exact: true})).toHaveValue('');
  await noStoredSecrets(page, [password, isolated.setupToken, ...codes]);
  expect((await request(page, '/api/owner/session')).data.authenticated).toBe(true);
});

test('recovery and security routes stay private, fit mobile and cannot submit secrets without JavaScript', async ({page, browser, isolated}) => {
  await page.setViewportSize({width: 390, height: 844});
  for (const path of ['/owner/', '/owner/recover/', '/owner/security/', '/owner/setup/']) {
    const response = await page.goto(isolated.origin + path);
    expect(response?.headers()['cache-control']).toContain('no-store');
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expectOnePrimaryAction(page, false);
  }
  await page.goto(`${isolated.origin}/owner/security/`);
  await expect(page.getByRole('heading', {name: 'Sign in to manage owner access.', exact: true})).toBeVisible();
  await expect(page.getByLabel('Current password', {exact: true})).toHaveCount(0);
  await page.getByRole('link', {name: 'Recover access', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Recover owner access', exact: true})).toBeVisible();
  const sitemap = await page.request.get(`${isolated.origin}/sitemap.xml`);
  expect(await sitemap.text()).not.toContain('/owner/');
  const noScript = await browser.newContext({javaScriptEnabled: false});
  try {
    const noScriptPage = await noScript.newPage();
    await noScriptPage.goto(`${isolated.origin}/owner/recover/`);
    const form = noScriptPage.locator('form');
    await expect(form).toHaveAttribute('method', 'post');
    await expect(form).toHaveAttribute('action', '/api/owner/recover');
    await expect(form.getByRole('button', {name: 'Reset owner password', exact: true})).toBeDisabled();
    expect(await form.locator('input').evaluateAll(inputs => inputs.every(input => input.disabled))).toBe(true);
    await noStoredSecrets(noScriptPage, [password, isolated.setupToken]);
  } finally { await noScript.close(); }
});

test.describe('existing version-one owner', () => {
  test.use({legacyOwner: true});
  test('migration preserves records and offers recovery-code creation with current-password reauthentication', async ({page, isolated}) => {
    await login(page, isolated);
    await expect(page.locator('body')).toContainText('Recovery codes haven’t been created for this owner yet.');
    await expect(page.getByText('qa-legacy@example.invalid', {exact: true})).toBeVisible();
    expect((await request(page, '/api/owner/session')).data.recoveryConfigured).toBe(false);
    await page.locator('.owner-toolbar').getByRole('link', {name: 'Security settings', exact: true}).click();
    await page.getByRole('tab', {name: 'Recovery codes', exact: true}).click();
    await page.getByLabel('Current password', {exact: true}).fill(password);
    await page.getByRole('button', {name: 'Replace recovery codes', exact: true}).click();
    await expect(page.getByRole('list', {name: 'One-use recovery codes'}).locator('code')).toHaveCount(8);
    await saved(page);
    await expect(page.getByText('qa-legacy@example.invalid', {exact: true})).toBeVisible();
    expect((await request(page, '/api/owner/session')).data.recoveryConfigured).toBe(true);
    await expect(page.locator('.owner-recovery-note')).toHaveCount(0);
  });
});
