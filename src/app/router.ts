import { useEffect, useState } from 'react';

/** Hash routing (#/today, #/workout/:id …) so GitHub Pages needs no server rewrites. */
export function useRoute(): string[] {
  const parse = () => (window.location.hash.replace(/^#\/?/, '') || 'today').split('?')[0].split('/').filter(Boolean);
  const [parts, setParts] = useState(parse);
  useEffect(() => {
    const on = () => {
      setParts(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}

export const go = (path: string) => {
  window.location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
};
export const back = (fallback = 'today') => {
  if (window.history.length > 1) window.history.back();
  else go(fallback);
};
