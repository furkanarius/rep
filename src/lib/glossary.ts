export const GLOSSARY = {
  rep: { term: 'Rep', text: 'One full movement, down and up. "10 reps" means doing it 10 times in a row.' },
  set: { term: 'Set', text: 'A group of reps done without stopping. "3 sets × 10" means 10 reps, rest, 10 reps, rest, 10 reps.' },
  rir: {
    term: 'Reps in reserve (RIR)',
    text: 'How many more reps you could have done. Rep asks "How did that feel?" instead: Easy ≈ 4+ left, Solid ≈ 2–3 left, Max ≈ 0–1 left.',
  },
  deload: { term: 'Deload', text: 'A lighter week (about 60% weight, 2 sets) so your body can catch up. You come back stronger.' },
  e1rm: {
    term: 'Estimated 1-rep max (e1RM)',
    text: 'The most you could probably lift once, estimated from a normal set (weight × (1 + reps ÷ 30)). You never have to test it for real.',
  },
  double: {
    term: 'Double progression',
    text: 'First add reps until you hit the top of the range on every set, then add a little weight and start again from the bottom of the range.',
  },
  linear: {
    term: 'Linear progression',
    text: 'Add a little weight every session you get all your reps. The fastest way for a beginner to get strong. Miss twice in a row and you drop 10% to build back up.',
  },
  warmup: {
    term: 'Warm-up sets',
    text: 'Lighter sets before your working sets to rehearse the movement. They don\'t count toward your progress. Skip them if you\'re short on time, but they help on heavy days.',
  },
  bw: {
    term: 'Body-weight targets',
    text: 'Strength targets scale with your body weight, so "1.5 × body weight" means 1.5 times your latest 7-day average weight. Rep shows the actual number for you.',
  },
  technique: {
    term: 'Technique check',
    text: 'A short self-check for the harder lifts. Read the points, do a light set (filming yourself helps) and tick the ones you nailed.',
  },
  reentry: {
    term: 'Re-entry session',
    text: 'After a break, the first session back is a bit lighter (about 80–90%) with 2 sets, so you don\'t get wrecked. Normal progress resumes right after.',
  },
  stage: {
    term: 'Stage',
    text: 'The plan has 5 stages. You move up by doing the work and hitting targets, not because weeks pass. Training less just means it takes longer.',
  },
  volume: {
    term: 'Volume',
    text: 'How much work you did: hard sets per muscle per week. Around 10–16 sets per muscle per week is the sweet spot for growth.',
  },
} as const;

export type TermKey = keyof typeof GLOSSARY;
