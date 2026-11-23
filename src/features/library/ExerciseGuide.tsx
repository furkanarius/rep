// The how-to content shared by the Library page and the in-workout bottom sheet.
import type { Exercise } from '../../engine/types';
import { exerciseById } from '../../engine/program';
import { BodyDiagram } from '../../components/BodyDiagram';
import { ExerciseMedia } from '../../components/ExerciseMedia';
import { IconPlay } from '../../components/Icons';

export function ExerciseGuide({ ex, showMedia = true, onOpenExercise }: { ex: Exercise; showMedia?: boolean; onOpenExercise?: (id: string) => void }) {
  const easier = ex.regressionId ? exerciseById(ex.regressionId) : undefined;
  const harder = ex.progressionId ? exerciseById(ex.progressionId) : undefined;
  const link = (e: Exercise) =>
    onOpenExercise ? (
      <button className="btn quiet" onClick={() => onOpenExercise(e.id)}>
        {e.name}
      </button>
    ) : (
      <a className="btn quiet" href={`#/library/${e.id}`}>
        {e.name}
      </a>
    );
  return (
    <div>
      {showMedia && <ExerciseMedia ex={ex} />}
      {ex.aka && <p className="muted small">Also called: {ex.aka.join(', ')}</p>}
      <h3>What it's for</h3>
      <p>{ex.purpose}</p>
      <h3>Muscles worked</h3>
      <BodyDiagram primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} />
      <h3>How to do it</h3>
      <p className="eyebrow">Set up</p>
      <ol className="steps">
        {ex.setup.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <p className="eyebrow">The movement</p>
      <ol className="steps">
        {ex.execution.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <p className="eyebrow">Breathing</p>
      <p>{ex.breathing}</p>
      <h3>Feel it in</h3>
      <p>{ex.feelItIn}</p>
      <h3>Common mistakes</h3>
      <ul className="bullets">
        {ex.commonMistakes.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
      {ex.safety && (
        <>
          <h3>Safety</h3>
          <p>{ex.safety}</p>
        </>
      )}
      {(easier || harder) && (
        <>
          <h3>Easier / harder</h3>
          <div className="stack">
            {easier && (
              <div className="row">
                <span className="muted small" style={{ width: 56 }}>
                  Easier
                </span>
                {link(easier)}
              </div>
            )}
            {harder && (
              <div className="row">
                <span className="muted small" style={{ width: 56 }}>
                  Harder
                </span>
                {link(harder)}
              </div>
            )}
          </div>
        </>
      )}
      <a className="btn block" style={{ marginTop: 16 }} href={ex.media.videoUrl ?? ex.media.videoSearchUrl} target="_blank" rel="noopener noreferrer">
        <IconPlay /> Watch a video
      </a>
      <p className="tiny muted" style={{ textAlign: 'center' }}>
        Opens YouTube. Look for a coach showing the movement slowly.
      </p>
      {ex.media.credit && <p className="tiny muted">{ex.media.credit}</p>}
    </div>
  );
}
