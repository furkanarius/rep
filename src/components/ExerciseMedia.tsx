import { useEffect, useState } from 'react';
import type { Exercise } from '../engine/types';
import { StickFigure } from './StickFigure';

export const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

export function useReducedMotion() {
  const q = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : undefined;
  const [reduced, setReduced] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const on = () => setReduced(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, [q]);
  return reduced;
}

/** Looping start → end → start crossfade (static side by side with reduced motion). */
export function ExerciseMedia({ ex, compact }: { ex: Exercise; compact?: boolean }) {
  const reduced = useReducedMotion();
  const imgs = ex.media.images ?? [];
  if (imgs.length === 2) {
    return (
      <div
        className={`media ${reduced ? 'static' : ''} ${compact && !reduced ? 'compact' : ''}`}
        role="img"
        aria-label={`${ex.name}: start and end position`}
      >
        <img src={asset(imgs[0])} alt="" className="f0" decoding="async" />
        <img src={asset(imgs[1])} alt="" className="f1" decoding="async" />
        {!reduced && <span className="credit">public domain</span>}
      </div>
    );
  }
  if (ex.media.stick) {
    return (
      <div className={`media stick ${compact ? 'compact' : ''}`} role="img" aria-label={`${ex.name}: animated demo`}>
        <StickFigure fig={ex.media.stick} reduced={reduced} />
      </div>
    );
  }
  return null;
}

export function Thumb({ ex }: { ex: Exercise }) {
  const img = ex.media.images?.[1] ?? ex.media.images?.[0];
  if (img) return <img className="thumb" src={asset(img)} alt="" loading="lazy" decoding="async" />;
  if (ex.media.stick)
    return (
      <span className="thumb stick" aria-hidden>
        <span style={{ width: 48, height: 48, display: 'block' }}>
          <StickFigure fig={ex.media.stick} reduced={false} />
        </span>
      </span>
    );
  return <span className="thumb" />;
}
