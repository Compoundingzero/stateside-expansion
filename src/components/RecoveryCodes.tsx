import { useEffect, useRef, useState } from 'react';

type Props = { codes: string[]; onContinue: () => void; replaced?: boolean };

export function validRecoveryCodes(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(code => typeof code === 'string' && code.length >= 16 && code.length <= 256);
}

export default function RecoveryCodes({ codes, onContinue, replaced = false }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const [saved, setSaved] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  function download() {
    setDownloadError(false);
    try {
      const text = ['ELN owner recovery codes', `Site: ${window.location.origin}`, '', 'Keep these codes private and separate from your password.', 'Each code can be used once to reset owner access. A reset signs out every session.', 'Replacing recovery codes invalidates this entire set.', '', ...codes, ''].join('\n');
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'eln-owner-recovery-codes.txt';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setDownloaded(true);
    } catch { setDownloadError(true); }
  }

  return <section className="owner-recovery-codes" aria-labelledby="owner-codes-title">
    <span className="eyebrow">SAVE ONCE</span><h2 id="owner-codes-title" tabIndex={-1} ref={headingRef}>Save your recovery codes.</h2>
    <p>Each code can be used once if you lose your owner password. Keep them somewhere private, separate from your password.</p>
    <p>You can’t display these codes again. {replaced ? 'Your previous recovery codes no longer work.' : 'While you can sign in, you can replace the set in Security settings.'}</p>
    <ol className="owner-code-list" aria-label="One-use recovery codes">{codes.map((code, index) => <li key={index}><code>{code}</code></li>)}</ol>
    <button type="button" className="utility" onClick={download}>Download recovery codes</button>
    <p className="owner-download-status" role="status">{downloadError ? 'The download could not be created. Save the displayed codes securely before continuing.' : downloaded ? 'Download created. Keep the file private.' : ''}</p>
    <label className="owner-saved-confirmation"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)}/> I have saved these recovery codes securely.</label>
    <button type="button" className="button" data-forward-cta disabled={!saved} onClick={onContinue}>Continue to owner board</button>
  </section>;
}
