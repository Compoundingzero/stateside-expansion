import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import RecoveryCodes, { validRecoveryCodes } from './RecoveryCodes';

type Mode = 'recover' | 'security';
type Task = 'password' | 'codes' | 'backup';
const tasks: Task[] = ['password', 'codes', 'backup'];
type Session = { authenticated: boolean; configured: boolean; recoveryConfigured?: boolean };
type BackupResult = { completedAt: string; integrity: { integrityCheck: 'ok'; foreignKeys: 'ok' }; retentionDays: number; retentionStatus: 'ok' | 'failed' };
type ApiResult = Partial<BackupResult> & { ok?: boolean; error?: string; fields?: Record<string, string>; recoveryCodes?: string[] };
function validBackupResult(value: ApiResult): value is ApiResult & BackupResult {
  return typeof value.completedAt === 'string' && Number.isFinite(Date.parse(value.completedAt)) && value.integrity?.integrityCheck === 'ok' && value.integrity.foreignKeys === 'ok' && typeof value.retentionDays === 'number' && Number.isInteger(value.retentionDays) && value.retentionDays > 0 && (value.retentionStatus === 'ok' || value.retentionStatus === 'failed');
}
class AccessError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) { super(message); }
}
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', mode: 'same-origin', credentials: 'include', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result: ApiResult = await response.json().catch(() => ({}));
  if (!response.ok) throw new AccessError(response.status === 429 ? 'Please wait before trying again.' : result.error || 'The request could not be completed. Check the details and try again.', response.status, result.fields || {});
  return result as T;
}

export default function OwnerAccess({ mode = 'recover' }: { mode?: Mode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [task, setTask] = useState<Task>('password');
  const [pending, setPending] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [codes, setCodes] = useState<string[] | null>(null);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [done, setDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const backupRef = useRef<HTMLDivElement>(null);
  const recovering = mode === 'recover';

  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    if (recovering) return;
    let active = true;
    setSessionError(false);
    api<Session>('/api/owner/session').then(value => { if (active) setSession(value); }).catch(() => { if (active) setSessionError(true); });
    return () => { active = false; };
  }, [recovering, sessionVersion]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error, fields]);
  useEffect(() => { if (done) successRef.current?.focus(); }, [done]);
  useEffect(() => { if (backupResult) backupRef.current?.focus(); }, [backupResult]);

  function chooseTask(next: Task) {
    if (pending) return;
    formRef.current?.reset();
    setTask(next);
    setError('');
    setFields({});
    setShowSecrets(false);
    setBackupResult(null);
  }
  function taskKey(event: KeyboardEvent<HTMLButtonElement>, current: Task) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next: Task = event.key === 'Home' ? tasks[0] : event.key === 'End' ? tasks[tasks.length - 1] : tasks[(tasks.indexOf(current) + (event.key === 'ArrowRight' ? 1 : tasks.length - 1)) % tasks.length];
    chooseTask(next);
    document.getElementById(`owner-security-tab-${next}`)?.focus();
  }
  const firstName = recovering ? 'recoveryCode' : 'currentPassword';
  const firstLabel = recovering ? 'Recovery code' : 'Current password';
  const firstId = recovering ? 'owner-recovery-code' : 'owner-current-password';
  const changingPassword = recovering || task === 'password';
  const endpoint = recovering ? '/api/owner/recover' : task === 'password' ? '/api/owner/password' : task === 'codes' ? '/api/owner/recovery-codes' : '/api/owner/backup';
  const describedBy = (name: string) => fields[name] ? `owner-access-${name}-error` : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const firstValue = String(data.get(firstName) || '');
    const newPassword = String(data.get('newPassword') || '');
    const confirmation = String(data.get('confirmation') || '');
    const invalid: Record<string, string> = {};
    if (!firstValue.trim()) invalid[firstName] = `Enter your ${recovering ? 'recovery code' : 'current password'}.`;
    if (changingPassword && (newPassword.length < 12 || newPassword.length > 128)) invalid.newPassword = 'Use a new password with 12 to 128 characters.';
    if (changingPassword && newPassword !== confirmation) invalid.confirmation = 'The passwords do not match.';
    setFields(invalid);
    if (Object.keys(invalid).length) { setError('Check the highlighted fields.'); return; }
    setPending(true);
    setError('');
    setBackupResult(null);
    try {
      const payload = recovering ? { recoveryCode: firstValue.trim(), newPassword } : task === 'password' ? { currentPassword: firstValue, newPassword } : { currentPassword: firstValue };
      const result = await api<ApiResult>(endpoint, payload);
      form.reset();
      setShowSecrets(false);
      if (!recovering && task === 'codes') {
        if (!validRecoveryCodes(result.recoveryCodes)) {
          setError('The code set was replaced, but it could not be displayed. Create another set before leaving this page.');
          return;
        }
        setCodes(result.recoveryCodes);
      } else if (!recovering && task === 'backup') {
        if (!validBackupResult(result)) { setError('The backup response could not be confirmed. Check the backup status before retrying.'); return; }
        setBackupResult(result);
      } else {
        setSession(null);
        setDone(true);
      }
    } catch (failure) {
      form.reset();
      setShowSecrets(false);
      if (failure instanceof AccessError) {
        const allowed = [firstName, 'newPassword'];
        setFields(Object.fromEntries(Object.entries(failure.fields).filter(([key, value]) => allowed.includes(key) && typeof value === 'string')));
        setError(failure.message);
      } else setError('The request could not be completed. Check your connection and try again.');
    } finally { setPending(false); }
  }

  if (codes) return <div className="owner-access-panel owner-access-wide"><RecoveryCodes codes={codes} replaced onContinue={() => { setCodes(null); window.location.replace('/owner/'); }}/></div>;
  if (done) return <div className="owner-access-panel" tabIndex={-1} ref={successRef}>
    <span className="eyebrow">OWNER ACCESS</span><h2>{recovering ? 'Access recovered.' : 'Password changed.'}</h2>
    <p>All owner sessions have been signed out. Sign in with your new password.</p>
    {recovering && <p>The recovery code you just used no longer works. Keep your remaining unused codes private, or replace the set after signing in.</p>}
    <a className="button" href="/owner/" data-forward-cta>Sign in</a>
  </div>;
  if (!recovering) {
    if (sessionError) return <div className="owner-access-panel"><p role="alert">Owner access could not be checked. Please try again.</p><button className="utility" onClick={() => setSessionVersion(value => value + 1)}>Try again</button></div>;
    if (!session) return <div className="owner-access-panel"><p role="status">Checking owner access…</p><noscript><p>JavaScript is required for secure owner access.</p></noscript></div>;
    if (!session.authenticated) return <div className="owner-access-panel"><h2>Sign in to manage owner access.</h2><p>Security settings require an authenticated owner session and your current password.</p><a className="button" href="/owner/" data-forward-cta>Sign in</a><a className="utility owner-access-back" href="/owner/recover/">Recover access</a></div>;
  }

  return <section className="owner-access-panel owner-security-panel" aria-label={recovering ? 'Recover owner access' : 'Owner security settings'}>
    {!recovering && <>
      <div className="owner-tabs owner-security-tabs" role="tablist" aria-label="Security task">{tasks.map(value => <button key={value} id={`owner-security-tab-${value}`} type="button" role="tab" aria-selected={task === value} aria-controls="owner-security-panel" tabIndex={task === value ? 0 : -1} disabled={pending} onKeyDown={event => taskKey(event, value)} onClick={() => chooseTask(value)}>{value === 'password' ? 'Password' : value === 'codes' ? 'Recovery codes' : 'Backups'}</button>)}</div>
      {session?.recoveryConfigured === false && <p className="owner-recovery-note">Recovery codes haven’t been created for this owner yet. Open Recovery codes to create a set using your current password.</p>}
    </>}
    <div id={recovering ? undefined : 'owner-security-panel'} role={recovering ? undefined : 'tabpanel'} aria-labelledby={recovering ? undefined : `owner-security-tab-${task}`}>
      <h2>{recovering ? 'Use a saved recovery code.' : task === 'password' ? 'Change your password.' : task === 'codes' ? 'Create a new recovery code set.' : 'Create a verified backup.'}</h2>
      <p>{recovering ? 'Enter one unused recovery code and choose a new password. A successful reset signs out every owner session.' : task === 'password' ? 'Confirm your current password, then choose a new one. A successful change signs out every owner session.' : task === 'codes' ? 'Confirm your current password to replace all existing recovery codes. The new codes are shown once.' : 'Confirm your current password to create an encrypted database snapshot. The saved copy is downloaded and checked before success is reported.'}</p>
      {backupResult && <div className="owner-recovery-note" role="status" tabIndex={-1} ref={backupRef}><h3>Backup verified.</h3><p>Completed <time dateTime={backupResult.completedAt}>{new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(backupResult.completedAt))}</time> in your browser’s time zone.</p><p>Restored-copy integrity and foreign-key checks passed. Retention: {backupResult.retentionDays} days.</p><p>{backupResult.retentionStatus === 'ok' ? 'Expired backup cleanup completed.' : 'Expired backup cleanup did not complete. Check backup storage access and configuration.'}</p></div>}
      <form ref={formRef} onSubmit={submit} method="post" action={endpoint} noValidate aria-busy={pending}>
        {error && <div className="submission-error-summary" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
        <div className="field"><label htmlFor={firstId}>{firstLabel}</label><input id={firstId} name={firstName} type={showSecrets ? 'text' : 'password'} autoComplete={recovering ? 'off' : 'current-password'} autoCapitalize="none" spellCheck={false} required maxLength={recovering ? 512 : 128} disabled={!ready || pending} aria-invalid={Boolean(fields[firstName])} aria-describedby={describedBy(firstName)}/>{fields[firstName] && <span className="submission-field-error" id={`owner-access-${firstName}-error`}>{fields[firstName]}</span>}</div>
        {changingPassword && <>
          <div className="field"><label htmlFor="owner-new-password">New password</label><input id="owner-new-password" name="newPassword" type={showSecrets ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} disabled={!ready || pending} aria-invalid={Boolean(fields.newPassword)} aria-describedby={['owner-new-password-hint', describedBy('newPassword')].filter(Boolean).join(' ')}/><small id="owner-new-password-hint">Use 12 to 128 characters and a password unique to this site.</small>{fields.newPassword && <span className="submission-field-error" id="owner-access-newPassword-error">{fields.newPassword}</span>}</div>
          <div className="field"><label htmlFor="owner-confirm-new-password">Confirm new password</label><input id="owner-confirm-new-password" name="confirmation" type={showSecrets ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} disabled={!ready || pending} aria-invalid={Boolean(fields.confirmation)} aria-describedby={describedBy('confirmation')}/>{fields.confirmation && <span className="submission-field-error" id="owner-access-confirmation-error">{fields.confirmation}</span>}</div>
        </>}
        <label className="owner-password-toggle"><input type="checkbox" checked={showSecrets} disabled={!ready || pending} onChange={event => setShowSecrets(event.target.checked)}/> {recovering ? 'Show recovery code and passwords' : changingPassword ? 'Show passwords' : 'Show current password'}</label>
        <button className="button" type="submit" disabled={!ready || pending} data-forward-cta>{pending ? 'Please wait…' : recovering ? 'Reset owner password' : task === 'password' ? 'Change password' : task === 'codes' ? 'Replace recovery codes' : 'Create verified backup'}</button>
      </form>
    </div>
    <a className="utility owner-access-back" href="/owner/">{recovering ? 'Back to owner sign-in' : 'Back to owner board'}</a>
    {recovering && <p className="owner-recovery-help">Recovery uses a code saved during setup or replacement. If you have no unused code and cannot sign in, this self-service route cannot restore access.</p>}
    <noscript><p className="no-js">JavaScript is required. Recovery codes and passwords are never submitted through a URL.</p></noscript>
  </section>;
}
