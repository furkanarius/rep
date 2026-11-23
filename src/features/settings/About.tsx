import { stages } from '../../engine/program';
import { Term } from '../../components/Term';

export function About() {
  return (
    <div className="page">
      <h2 style={{ marginTop: 4 }}>About the plan</h2>
      <p>
        Rep is built for one goal: turn a complete beginner into someone genuinely strong and athletic in about a year, without needing to
        think about programming.
      </p>
      <h3>How it works</h3>
      <ul className="bullets">
        <li>
          <strong>Progress unlocks the plan, not the calendar.</strong> There are 5 stages. You move up by doing the sessions, training
          regularly and hitting strength targets that scale with your body weight. Train less and it just takes longer.
        </li>
        <li>
          <strong>Small, steady increases.</strong> Most exercises use <Term k="double">double progression</Term>: add reps until you hit the
          top of the range on every set, then add a little weight. In Stage 3 the big lifts use <Term k="linear">linear progression</Term>.
        </li>
        <li>
          <strong>"How did that feel?"</strong> Easy, Solid or Max replaces gym jargon like <Term k="rir">RIR</Term>. I use it to decide
          when to add weight and when you need a break.
        </li>
        <li>
          <strong>Lighter weeks when the data says so.</strong> If lifts stall, most sets feel like Max, or something hurts twice in a week,
          I'll suggest a <Term k="deload">deload</Term>. You can always say no.
        </li>
        <li>
          <strong>Built around your cycling.</strong> No heavy leg day the day before a long ride. Log rides with one tap.
        </li>
        <li>
          <strong>Missed days are fine.</strong> After a week off, the next session is a little lighter (a <Term k="reentry">re-entry session</Term>
          ). Nothing is lost.
        </li>
      </ul>
      <h3>The stages</h3>
      <ol className="steps">
        {stages.map((s) => (
          <li key={s.id}>
            <strong>{s.name}</strong> ({s.weeksHint}): {s.purpose}
          </li>
        ))}
      </ol>
      <h3>About that belly</h3>
      <p>
        Honest truth: ab exercises don't burn belly fat. Fat loss comes from eating a bit less than you burn, plus all your training and
        cycling. Building muscle makes that easier and changes how you look as the fat comes off. The core work here is for strength,
        posture and a healthy back.
      </p>
      <h3>Safety</h3>
      <p>
        This is a general training app, not medical advice. Stop any exercise that causes sharp pain, and check with a doctor if pain
        persists. Learn each movement with light weights first, use the safety pins on barbell lifts, and never train through sharp pain.
      </p>
      <h3>Your data</h3>
      <p>
        Everything stays on this device. No account, no tracking, no ads. Back it up with a file export or private Gist sync in Settings.
      </p>
      <h3>Credits</h3>
      <p className="small">
        Exercise photos: free-exercise-db by yuhonas (public domain, Unlicense), derived from wrkout/exercises.json (public domain). Exercise instructions written for Rep.
      </p>
    </div>
  );
}
