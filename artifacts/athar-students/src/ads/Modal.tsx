import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './ads.css';

/** Native <dialog> modal: browser focus trap, Escape handling and focus restoration. */
export function Modal({ title, children, onClose, busy, wide }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    opener.current = document.activeElement;
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { d?.close(); (opener.current as HTMLElement | null)?.focus?.(); };
  }, []);
  return <dialog ref={ref} className={`ads-dialog ${wide ? 'ads-dialog-wide' : ''}`} dir="rtl" aria-labelledby={id}
    onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}
    onMouseDown={e => { if (!busy && e.target === e.currentTarget) onClose(); }}>
    <div className="ads-dialog-inner">
      <header className="ads-dialog-head"><h2 id={id}>{title}</h2>
        <button type="button" className="ads-x" onClick={onClose} disabled={busy} aria-label="إغلاق"><X size={16}/></button></header>
      {children}
    </div>
  </dialog>;
}

export function ConfirmDialog({ title, body, confirmLabel, danger, busy, error, onConfirm, onCancel }: {
  title: string; body: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; error?: string; onConfirm: () => void; onCancel: () => void;
}) {
  return <Modal title={title} onClose={onCancel} busy={busy}>
    <div className="ads-dialog-body">{body}</div>
    {error && <p className="ads-err" role="alert">{error}</p>}
    <div className="ads-actions">
      <button type="button" className="button button-outline button-compact" onClick={onCancel} disabled={busy} autoFocus>إلغاء</button>
      <button type="button" className={`button button-compact ${danger ? 'ads-danger' : 'button-primary'}`} onClick={onConfirm} disabled={busy}>{busy ? 'جارٍ التنفيذ…' : confirmLabel}</button>
    </div>
  </Modal>;
}
