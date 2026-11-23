import { lazy, Suspense, useEffect } from 'react';
import { DataProvider, useData } from './data';
import { useRoute, back } from './router';
import { ToastProvider } from '../components/Toast';
import { IconBack, IconGear, IconLibrary, IconPlan, IconProgress, IconToday } from '../components/Icons';
import { Today } from '../features/today/Today';
const Workout = lazy(() => import('../features/workout/Workout').then((m) => ({ default: m.Workout })));
const Plan = lazy(() => import('../features/plan/Plan').then((m) => ({ default: m.Plan })));
const Progress = lazy(() => import('../features/progress/Progress').then((m) => ({ default: m.Progress })));
const SessionDetail = lazy(() => import('../features/progress/SessionDetail').then((m) => ({ default: m.SessionDetail })));
const Library = lazy(() => import('../features/library/Library').then((m) => ({ default: m.Library })));
const ExercisePage = lazy(() => import('../features/library/ExercisePage').then((m) => ({ default: m.ExercisePage })));
const Settings = lazy(() => import('../features/settings/Settings').then((m) => ({ default: m.Settings })));
const About = lazy(() => import('../features/settings/About').then((m) => ({ default: m.About })));
const Onboarding = lazy(() => import('../features/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })));
import { exerciseById } from '../engine/program';

export function App() {
  return (
    <ToastProvider>
      <DataProvider>
        <Shell />
      </DataProvider>
    </ToastProvider>
  );
}

const TABS = [
  { id: 'today', label: 'Today', Icon: IconToday },
  { id: 'plan', label: 'Plan', Icon: IconPlan },
  { id: 'progress', label: 'Progress', Icon: IconProgress },
  { id: 'library', label: 'Library', Icon: IconLibrary },
];

function Shell() {
  const d = useData();
  const parts = useRoute();
  const [route, arg] = parts;

  useEffect(() => {
    const root = document.documentElement;
    if (d.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', d.settings.theme);
  }, [d.settings.theme]);

  if (!d.settings.onboardingDone)
    return (
      <Suspense fallback={null}>
        <Onboarding />
      </Suspense>
    );

  if (route === 'workout' && arg) {
    return (
      <main className="app focus">
        <Suspense fallback={null}>
          <Workout id={arg} />
        </Suspense>
      </main>
    );
  }

  let title = 'Today';
  let page: React.ReactNode;
  let showBack = false;
  switch (route) {
    case 'plan':
      title = 'Plan';
      page = <Plan />;
      break;
    case 'progress':
      title = 'Progress';
      page = <Progress />;
      break;
    case 'history':
      title = 'Session';
      page = arg ? <SessionDetail id={arg} /> : <Progress />;
      showBack = true;
      break;
    case 'library':
      title = arg ? 'Exercise' : 'Library';
      page = arg ? <ExercisePage id={arg} /> : <Library />;
      showBack = !!arg;
      if (arg && !exerciseById(arg)) page = <Library />;
      break;
    case 'settings':
      title = 'Settings';
      page = <Settings />;
      showBack = true;
      break;
    case 'about':
      title = 'About';
      page = <About />;
      showBack = true;
      break;
    default:
      title = 'Today';
      page = <Today />;
  }
  const activeTab = route === 'history' ? 'progress' : TABS.some((t) => t.id === route) ? route : route === 'settings' || route === 'about' ? '' : 'today';

  return (
    <>
      <main className="app">
        <header className="header">
          <div className="row" style={{ gap: 4 }}>
            {showBack && (
              <button className="icon-btn" onClick={() => back(route === 'history' ? 'progress' : route === 'library' ? 'library' : 'today')} aria-label="Back" style={{ marginLeft: -12 }}>
                <IconBack />
              </button>
            )}
            <h1>{title}</h1>
          </div>
          {route !== 'settings' && (
            <a className="icon-btn" href="#/settings" aria-label="Settings">
              <IconGear />
            </a>
          )}
        </header>
        <Suspense fallback={<p className="page muted">Loading…</p>}>{page}</Suspense>
      </main>
      <div className="tabbar">
        <nav aria-label="Main">
          {TABS.map(({ id, label, Icon }) => (
            <a key={id} href={`#/${id}`} aria-current={activeTab === id ? 'page' : undefined}>
              <Icon />
              {label}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}
