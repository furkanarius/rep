import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from './Icons';

/** Bottom sheet. Only one is shown at a time by design (no modal pile-ups). */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}

/** In-app confirm dialog (never the browser's confirm()). */
export function Confirm({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <>
      <div className="scrim" onClick={onCancel} />
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {body && <div className="muted">{body}</div>}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn grow" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button className={`btn grow ${danger ? 'danger solid' : 'primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
