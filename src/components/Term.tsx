import { useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';
import { GLOSSARY, type TermKey } from '../lib/glossary';

/** Jargon with a tap-to-explain. */
export function Term({ k, children }: { k: TermKey; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[k];
  return (
    <>
      <button type="button" className="term" onClick={() => setOpen(true)} aria-label={`${g.term}: what does this mean?`}>
        {children ?? g.term}
      </button>
      {open && (
        <Sheet title={g.term} onClose={() => setOpen(false)}>
          <p>{g.text}</p>
        </Sheet>
      )}
    </>
  );
}
