import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

type Kind = 'interest' | 'enquiry';
type Status = 'new' | 'in-progress' | 'closed';
type Submission = { id: string; kind: Kind; name?: string; company?: string; arr?: string; email: string; comments?: string; status: Status; createdAt: string };
type Session = { authenticated: boolean; configured: boolean };
type BoardResult = { submissions: Submission[]; retentionDays?: number };
const LANES: { status: Status; label: string }[] = [{ status: 'new', label: 'New' }, { status: 'in-progress', label: 'In progress' }, { status: 'closed', label: 'Closed' }];

class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, mode: 'same-origin', credentials: 'include', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new RequestError(response.status === 429 ? 'Please wait before trying again.' : body.error || 'The request could not be completed. Please try again.', response.status);
  return body as T;
}
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}
function validSubmission(value: unknown): value is Submission {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<Submission>;
  return typeof row.id === 'string' && typeof row.email === 'string' && typeof row.createdAt === 'string' && (row.kind === 'interest' || row.kind === 'enquiry') && LANES.some(lane => lane.status === row.status);
}

export default function OwnerBoard({ mode = 'board' }: { mode?: 'board' | 'setup' }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState('');
  const [sessionVersion, setSessionVersion] = useState(0);
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState('');
  const authErrorRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<Kind>('interest');
  const [records, setRecords] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [message, setMessage] = useState('');
  const [pendingRecord, setPendingRecord] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const deleteCancel = useRef<HTMLButtonElement>(null);
  const deleteOrigin = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (mode !== 'setup') return;
    function consumeSetupFragment() {
      if (!window.location.hash) return;
      const parameters = new URLSearchParams(window.location.hash.slice(1));
      const candidate = parameters.get('token') || '';
      // Consume both initial and same-document setup links immediately. The
      // token remains only in component memory until an explicit setup POST.
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      setSetupToken(candidate.length >= 32 && candidate.length <= 512 ? candidate : null);
      setAuthError('');
    }
    consumeSetupFragment();
    window.addEventListener('hashchange', consumeSetupFragment);
    return () => window.removeEventListener('hashchange', consumeSetupFragment);
  }, [mode]);

  useEffect(() => {
    let active = true;
    setSessionError('');
    request<Session>('/api/owner/session').then(result => {
      if (!active) return;
      setSession(result);
      if (result.configured) setSetupToken(null);
    }).catch(() => { if (active) setSessionError('Owner access could not be checked. Please try again.'); });
    return () => { active = false; };
  }, [mode, sessionVersion]);

  useEffect(() => { if (authError) authErrorRef.current?.focus(); }, [authError]);

  useEffect(() => {
    if (!session?.authenticated || mode !== 'board') return;
    const controller = new AbortController();
    let active = true;
    setRecords([]);
    setLoading(true);
    setLoadError('');
    setMessage('');
    request<BoardResult>(`/api/owner/submissions?kind=${kind}`, { signal: controller.signal }).then(result => {
      if (!active) return;
      if (!Array.isArray(result.submissions) || !result.submissions.every(validSubmission)) throw new Error('Invalid response');
      setRecords(result.submissions.filter(row => row.kind === kind));
      setRetentionDays(typeof result.retentionDays === 'number' && result.retentionDays > 0 ? result.retentionDays : null);
    }).catch(error => {
      if (!active || controller.signal.aborted) return;
      if (error instanceof RequestError && error.status === 401) expireSession();
      else setLoadError('Submissions could not be loaded. Please try again.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [session?.authenticated, kind, refreshVersion, mode]);

  useEffect(() => {
    if (deleteTarget && deleteDialog.current) {
      if (!deleteDialog.current.open) deleteDialog.current.showModal();
      deleteCancel.current?.focus();
    } else {
      deleteDialog.current?.close();
    }
  }, [deleteTarget]);

  function expireSession() {
    setRecords([]);
    setDeleteTarget(null);
    setSession({ authenticated: false, configured: true });
    setAuthError('Your owner session has expired. Sign in again.');
    setMessage('');
  }

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authPending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get('password') || '');
    const confirmation = String(data.get('confirmation') || '');
    const settingUp = mode === 'setup';
    if (password.length < 12 || password.length > 128) { setAuthError('Use a password with 12 to 128 characters.'); return; }
    if (settingUp && password !== confirmation) { setAuthError('The passwords do not match.'); return; }
    if (settingUp && !setupToken) { setAuthError('Open your private setup link to continue.'); return; }
    setAuthError('');
    setAuthPending(true);
    try {
      await request<{ ok: boolean }>(settingUp ? '/api/owner/setup' : '/api/owner/login', { method: 'POST', body: JSON.stringify(settingUp ? { token: setupToken, password } : { password }) });
      form.reset();
      setShowPassword(false);
      if (settingUp) {
        setSetupToken(null);
        window.location.assign('/owner/');
      } else setSession({ authenticated: true, configured: true });
    } catch (error) {
      form.reset();
      setAuthError(error instanceof RequestError ? error.message : 'Sign-in could not be completed. Check your connection and try again.');
    } finally { setAuthPending(false); }
  }

  async function logout() {
    setLogoutPending(true);
    setMessage('');
    try {
      await request('/api/owner/logout', { method: 'POST', body: '{}' });
      setRecords([]);
      setDeleteTarget(null);
      setSession({ authenticated: false, configured: true });
      setAuthError('');
    } catch { setMessage('Sign-out could not be completed. Please try again.'); }
    finally { setLogoutPending(false); }
  }

  async function changeStatus(row: Submission, status: Status) {
    if (pendingRecord || row.status === status) return;
    setPendingRecord(row.id);
    setMessage('');
    try {
      const result = await request<{ ok: boolean; submission: Submission }>(`/api/owner/submissions/${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (!validSubmission(result.submission)) throw new Error('Invalid response');
      setRecords(items => items.map(item => item.id === row.id ? result.submission : item));
      setMessage(`Submission moved to ${LANES.find(lane => lane.status === status)?.label}.`);
      requestAnimationFrame(() => document.getElementById(`owner-status-${row.id}`)?.focus());
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) expireSession();
      else setMessage('The status could not be changed. Please try again.');
    } finally { setPendingRecord(null); }
  }

  function closeDelete() {
    if (pendingRecord) return;
    setDeleteTarget(null);
    setDeleteError('');
    requestAnimationFrame(() => deleteOrigin.current?.focus());
  }

  async function removeSubmission() {
    if (!deleteTarget || pendingRecord) return;
    const id = deleteTarget.id;
    setPendingRecord(id);
    setDeleteError('');
    try {
      await request(`/api/owner/submissions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setRecords(items => items.filter(item => item.id !== id));
      setDeleteTarget(null);
      setMessage('Submission deleted.');
      requestAnimationFrame(() => document.getElementById(`owner-tab-${kind}`)?.focus());
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) expireSession();
      else setDeleteError('The submission could not be deleted. Please try again.');
    } finally { setPendingRecord(null); }
  }

  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    setMessage('');
    try {
      const response = await fetch(`/api/owner/export?kind=${kind}`, { mode: 'same-origin', credentials: 'include', cache: 'no-store', redirect: 'error', headers: { Accept: 'text/csv' } });
      if (response.status === 401) { expireSession(); return; }
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `eln-${kind === 'interest' ? 'interests' : 'enquiries'}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage('CSV downloaded. Keep exported copies private.');
    } catch { setMessage('The CSV could not be downloaded. Please try again.'); }
    finally { setExporting(false); }
  }

  function tabKey(event: KeyboardEvent<HTMLButtonElement>, current: Kind) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next: Kind = event.key === 'Home' ? 'interest' : event.key === 'End' ? 'enquiry' : current === 'interest' ? 'enquiry' : 'interest';
    setKind(next);
    document.getElementById(`owner-tab-${next}`)?.focus();
  }

  if (sessionError) return <div className="owner-access-panel"><p role="alert">{sessionError}</p><button className="utility" onClick={() => setSessionVersion(value => value + 1)}>Try again</button></div>;
  if (!session) return <div className="owner-access-panel"><p role="status">Checking owner access…</p><noscript><p>JavaScript is required for secure owner access. No submissions are included in this page.</p></noscript></div>;

  if (mode === 'setup') {
    if (session.authenticated) return <div className="owner-access-panel"><h2>Owner access is ready.</h2><a className="utility" href="/owner/">Open owner board</a></div>;
    if (session.configured) return <div className="owner-access-panel"><h2>Owner access is already set up.</h2><p>Use your owner password to sign in.</p><a className="utility" href="/owner/">Go to owner sign-in</a></div>;
    if (!setupToken) return <div className="owner-access-panel"><h2>A private setup link is required.</h2><p>Open the private setup link supplied for this site. Setup links can be used once.</p></div>;
  } else if (!session.configured) return <div className="owner-access-panel"><h2>Owner access has not been set up.</h2><p>Use the private setup link supplied for this site to choose your owner password.</p></div>;

  if (mode === 'setup' || !session.authenticated) return <div className="owner-access-panel">
    <h2>{mode === 'setup' ? 'Choose your password.' : 'Sign in.'}</h2>
    <form onSubmit={authenticate} method="post" action={mode === 'setup' ? '/api/owner/setup' : '/api/owner/login'} noValidate aria-busy={authPending}>
      {authError && <div className="submission-error-summary" role="alert" tabIndex={-1} ref={authErrorRef}>{authError}</div>}
      <div className="field"><label htmlFor="owner-password">Password</label><input id="owner-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} required minLength={12} maxLength={128} aria-describedby="owner-password-hint" disabled={authPending}/><small id="owner-password-hint">Use 12 to 128 characters. A longer password or passphrase is easier to keep unique.</small></div>
      {mode === 'setup' && <div className="field"><label htmlFor="owner-confirmation">Confirm password</label><input id="owner-confirmation" name="confirmation" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} disabled={authPending}/></div>}
      <label className="owner-password-toggle"><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)}/> Show password</label>
      <button className="button" type="submit" disabled={authPending} data-forward-cta>{authPending ? 'Please wait…' : mode === 'setup' ? 'Set owner password' : 'Sign in'}</button>
    </form>
  </div>;

  return <section className="owner-workspace" aria-label="Private submissions">
    <div className="owner-toolbar"><div className="owner-tabs" role="tablist" aria-label="Submission type">{(['interest', 'enquiry'] as Kind[]).map(tab => <button key={tab} id={`owner-tab-${tab}`} type="button" role="tab" aria-selected={kind === tab} aria-controls="owner-board-panel" tabIndex={kind === tab ? 0 : -1} onKeyDown={event => tabKey(event, tab)} onClick={() => setKind(tab)}>{tab === 'interest' ? 'Interests' : 'Enquiries'}</button>)}</div><div className="owner-utilities"><button type="button" className="utility" onClick={() => setRefreshVersion(value => value + 1)} disabled={loading || Boolean(pendingRecord)}>Refresh</button><button type="button" className="utility" onClick={exportCsv} disabled={exporting}>{exporting ? 'Exporting…' : 'Export CSV'}</button><button type="button" className="utility" onClick={logout} disabled={logoutPending}>{logoutPending ? 'Signing out…' : 'Sign out'}</button></div></div>
    <p className="owner-private-note">Private owner view. Dates are shown in your browser’s time zone.{retentionDays ? ` Records are retained for up to ${retentionDays.toLocaleString()} days. You can delete a record sooner.` : ''}</p>
    <p className="owner-live-message" role="status" aria-live="polite" aria-atomic="true">{message}</p>
    <div id="owner-board-panel" role="tabpanel" aria-labelledby={`owner-tab-${kind}`} tabIndex={0} aria-busy={loading}>
      {loading ? <p role="status" className="owner-loading">Loading {kind === 'interest' ? 'interest registrations' : 'enquiries'}…</p> : loadError ? <div className="submission-error-summary" role="alert"><p>{loadError}</p><button type="button" className="utility" onClick={() => setRefreshVersion(value => value + 1)}>Try again</button></div> : <div className="owner-board">{LANES.map(lane => {
        const items = records.filter(row => row.status === lane.status);
        return <section className="owner-lane" key={lane.status} aria-labelledby={`owner-lane-${lane.status}`}><div className="owner-lane-heading"><h2 id={`owner-lane-${lane.status}`}>{lane.label}</h2><span className="owner-lane-count" aria-label={`${items.length} submissions`}>{items.length}</span></div>{items.length === 0 ? <p className="owner-empty">No {kind === 'interest' ? 'interest registrations' : 'enquiries'} here.</p> : <ol className="owner-card-list">{items.map(row => <li key={row.id}><article className="owner-card" aria-labelledby={`owner-card-${row.id}`} data-submission-id={row.id}>
          <div className="owner-card-header"><h3 id={`owner-card-${row.id}`}>{row.kind === 'interest' ? row.name || 'Interest registration' : 'Enquiry'}</h3><time dateTime={row.createdAt}>{dateLabel(row.createdAt)}</time></div>
          {row.kind === 'interest' ? <dl className="owner-card-details"><div><dt>Company</dt><dd>{row.company || 'Not provided'}</dd></div><div><dt>ARR</dt><dd>{row.arr || 'Not provided'}</dd></div></dl> : <p className="owner-comment">{row.comments || 'No comments provided.'}</p>}
          <a className="owner-email" href={`mailto:${encodeURIComponent(row.email)}`}>{row.email}</a>
          <div className="owner-card-controls"><div className="field"><label htmlFor={`owner-status-${row.id}`}>Status<span className="visually-hidden"> for {row.name || 'enquiry'} received {dateLabel(row.createdAt)}</span></label><select id={`owner-status-${row.id}`} value={row.status} disabled={Boolean(pendingRecord)} onChange={event => changeStatus(row, event.target.value as Status)}>{LANES.map(option => <option key={option.status} value={option.status}>{option.label}</option>)}</select></div><button className="utility owner-delete" type="button" disabled={Boolean(pendingRecord)} aria-label={`Delete ${row.kind === 'interest' ? 'interest registration' : 'enquiry'}${row.name ? ` from ${row.name}` : ''}`} onClick={event => { deleteOrigin.current = event.currentTarget; setDeleteError(''); setDeleteTarget(row); }}>Delete</button></div>
        </article></li>)}</ol>}</section>;
      })}</div>}
    </div>
    {deleteTarget && <dialog className="owner-confirm-dialog" ref={deleteDialog} aria-labelledby="owner-delete-title" aria-describedby="owner-delete-description" onCancel={event => { event.preventDefault(); closeDelete(); }}>
      <span className="eyebrow">DELETE RECORD</span><h2 id="owner-delete-title">Delete this submission?</h2><p id="owner-delete-description">This removes the record from the owner board. It cannot remove copies you have already exported.</p>{deleteError && <p className="submission-field-error" role="alert">{deleteError}</p>}<div className="owner-dialog-actions"><button ref={deleteCancel} type="button" className="utility" onClick={closeDelete} disabled={Boolean(pendingRecord)}>Cancel</button><button className="button" type="button" onClick={removeSubmission} disabled={Boolean(pendingRecord)} data-forward-cta>{pendingRecord ? 'Deleting…' : 'Delete submission'}</button></div>
    </dialog>}
  </section>;
}
