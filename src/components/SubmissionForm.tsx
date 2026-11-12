import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

type Kind = 'interest' | 'enquiry';
type Fields = Record<string, string>;
type ApiResult = { message?: string; error?: string; fields?: Fields };

const LABELS: Fields = { name: 'Your name', company: 'Company', arr: 'ARR', email: 'Email', comments: 'Comments' };

export default function SubmissionForm({ kind = 'interest' }: { kind?: Kind }) {
  const prefix = useId().replaceAll(':', '');
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Fields>({});
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const isInterest = kind === 'interest';

  useEffect(() => {
    if (message && !sent) errorRef.current?.focus();
    if (sent) successRef.current?.focus();
  }, [errors, message, sent]);

  const id = (name: string) => `${prefix}-${name}`;
  const describedBy = (name: string, hint = false) => [hint ? id(`${name}-hint`) : '', errors[name] ? id(`${name}-error`) : ''].filter(Boolean).join(' ') || undefined;
  const fieldError = (name: string) => errors[name] ? <span className="submission-field-error" id={id(`${name}-error`)}>{errors[name]}</span> : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = Object.fromEntries(Array.from(data.entries()).map(([key, value]) => [key, String(value).trim()])) as Fields;
    const nextErrors: Fields = {};
    if (isInterest && !values.name) nextErrors.name = 'Enter your name.';
    if (isInterest && !values.company) nextErrors.company = 'Enter your company.';
    if (!isInterest && !values.comments) nextErrors.comments = 'Enter your comments.';
    if (!values.email) nextErrors.email = 'Enter your email address.';
    else if ((form.elements.namedItem('email') as HTMLInputElement).validity.typeMismatch) nextErrors.email = 'Enter a valid email address.';
    for (const field of isInterest ? ['name', 'company', 'arr'] : ['comments']) {
      const limit = field === 'comments' ? 5000 : 160;
      if ((values[field] || '').length > limit) nextErrors[field] = `Use ${limit.toLocaleString()} characters or fewer.`;
    }
    if ((values.email || '').length > 254) nextErrors.email = 'Use an email address of 254 characters or fewer.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage('Check the highlighted fields. Your details have not been submitted.');
      return;
    }
    setPending(true);
    setMessage('');
    try {
      const payload = isInterest
        ? { name: values.name, company: values.company, arr: values.arr || '', email: values.email, website: values.website || '' }
        : { comments: values.comments, email: values.email, website: values.website || '' };
      const response = await fetch(isInterest ? '/api/interest' : '/api/enquiries', {
        method: 'POST', mode: 'same-origin', credentials: 'include', cache: 'no-store', redirect: 'error',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const result: ApiResult = await response.json().catch(() => ({}));
      if (!response.ok) {
        const allowed = isInterest ? ['name', 'company', 'arr', 'email'] : ['comments', 'email'];
        setErrors(Object.fromEntries(Object.entries(result.fields || {}).filter(([key, value]) => allowed.includes(key) && typeof value === 'string')));
        setMessage(response.status === 429 ? 'Please wait before trying again.' : result.error || 'Your submission could not be received. Please try again.');
        return;
      }
      form.reset();
      setErrors({});
      setMessage('Your submission has been received.');
      setSent(true);
    } catch {
      setMessage('Your submission could not be received. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  if (sent) return <div className="submission-success" role="status" tabIndex={-1} ref={successRef}>
    <span className="eyebrow">RECEIVED</span><h2>Thank you.</h2><p>{message}</p>
  </div>;

  return <form ref={formRef} onSubmit={submit} method="post" action={isInterest ? '/api/interest' : '/api/enquiries'} noValidate className="submission-form" data-submission-kind={kind} aria-busy={pending}>
    {message && <div className="submission-error-summary" role="alert" tabIndex={-1} ref={errorRef}>
      <p>{message}</p>
      {Object.keys(errors).length > 0 && <ul>{Object.entries(errors).map(([name, error]) => <li key={name}><a href={`#${id(name)}`}>{LABELS[name] || name}: {error}</a></li>)}</ul>}
    </div>}
    <div className="submission-fields">
      {isInterest ? <>
        <div className="field"><label htmlFor={id('name')}>Your name</label><input id={id('name')} name="name" autoComplete="name" required maxLength={160} aria-invalid={Boolean(errors.name)} aria-describedby={describedBy('name')} disabled={pending || !ready}/>{fieldError('name')}</div>
        <div className="field"><label htmlFor={id('company')}>Company</label><input id={id('company')} name="company" autoComplete="organization" required maxLength={160} aria-invalid={Boolean(errors.company)} aria-describedby={describedBy('company')} disabled={pending || !ready}/>{fieldError('company')}</div>
        <div className="field"><label htmlFor={id('arr')}>ARR (annual recurring revenue) <span className="submission-optional">Optional</span></label><input id={id('arr')} name="arr" maxLength={160} aria-invalid={Boolean(errors.arr)} aria-describedby={describedBy('arr', true)} disabled={pending || !ready}/><small id={id('arr-hint')}>Currency + amount, not recurring, or not known.</small>{fieldError('arr')}</div>
      </> : <div className="field"><label htmlFor={id('comments')}>Comments</label><textarea id={id('comments')} name="comments" required maxLength={5000} rows={7} aria-invalid={Boolean(errors.comments)} aria-describedby={describedBy('comments', true)} disabled={pending || !ready}/><small id={id('comments-hint')}>Please leave out confidential documents, account numbers and sensitive personal information.</small>{fieldError('comments')}</div>}
      <div className="field"><label htmlFor={id('email')}>Email</label><input id={id('email')} name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} aria-invalid={Boolean(errors.email)} aria-describedby={describedBy('email')} disabled={pending || !ready}/>{fieldError('email')}</div>
    </div>
    <div className="submission-trap" aria-hidden="true"><label htmlFor={id('website')}>Leave this field empty</label><input id={id('website')} name="website" type="text" autoComplete="off" tabIndex={-1} defaultValue=""/></div>
    <p className="submission-privacy">We’ll use these details to respond to your {isInterest ? 'interest' : 'enquiry'}. <a href="/privacy/">Read the privacy notice</a>.</p>
    <button className="button submission-submit" type="submit" disabled={pending || !ready} data-forward-cta>{pending ? 'Submitting…' : isInterest ? 'Register interest' : 'Send enquiry'}<span className="arrow-icon" aria-hidden="true"/></button>
    <noscript><p className="no-js">JavaScript is required to submit this form securely.</p></noscript>
  </form>;
}
