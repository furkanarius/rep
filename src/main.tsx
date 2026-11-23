import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './app/App';
import { installSyncTriggers, scheduleSync } from './db/sync';
import { setChangeListener } from './db/repo';

// Ask the browser to keep our IndexedDB data (iOS can otherwise evict it).
void navigator.storage?.persist?.().catch(() => {});
installSyncTriggers();
setChangeListener(() => scheduleSync(15_000));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
