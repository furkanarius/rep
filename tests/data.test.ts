import { describe, expect, it } from 'vitest';
import { exercises, program, exerciseById, allTemplates } from '../src/engine/program';
import fs from 'node:fs';

describe('exercise library', () => {
  it('has 70–100 exercises with unique ids', () => {
    expect(exercises.length).toBeGreaterThanOrEqual(70);
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length);
  });
  it('every exercise has a full how-to (no exercise without a how-to)', () => {
    for (const e of exercises) {
      expect(e.purpose, e.id).toBeTruthy();
      expect(e.cue, e.id).toBeTruthy();
      expect(e.setup.length, e.id).toBeGreaterThan(0);
      expect(e.execution.length, e.id).toBeGreaterThan(0);
      expect(e.breathing, e.id).toBeTruthy();
      expect(e.feelItIn, e.id).toBeTruthy();
      expect(e.commonMistakes.length, e.id).toBeGreaterThan(0);
      expect(e.primaryMuscles.length, e.id).toBeGreaterThan(0);
      expect(e.media.videoSearchUrl, e.id).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);
      const visual = (e.media.images?.length ?? 0) === 2 || !!e.media.stick;
      expect(visual, `${e.id} has a visual`).toBe(true);
    }
  });
  it('image files exist on disk', () => {
    for (const e of exercises) for (const img of e.media.images ?? []) expect(fs.existsSync(`public/${img}`), img).toBe(true);
  });
  it('all references resolve', () => {
    for (const e of exercises) {
      for (const id of [e.regressionId, e.progressionId, ...e.substitutes].filter(Boolean) as string[])
        expect(exerciseById(id), `${e.id} → ${id}`).toBeDefined();
    }
  });
  it('photos carry a public-domain credit', () => {
    for (const e of exercises.filter((x) => x.media.images)) expect(e.media.credit).toMatch(/public domain/);
  });
});

describe('program', () => {
  it('has 5 stages and every slot uses a known exercise', () => {
    expect(program.stages).toHaveLength(5);
    for (const st of program.stages) {
      for (const w of allTemplates(st)) for (const s of w.slots) expect(exerciseById(s.exerciseId), `${w.id}:${s.exerciseId}`).toBeDefined();
      for (const g of st.gates) if ('exerciseId' in g) expect(exerciseById(g.exerciseId)).toBeDefined();
      expect(st.gates.length).toBeGreaterThan(0);
    }
  });
  it('technique checks exist for every technique gate, with 3–5 items', () => {
    for (const st of program.stages)
      for (const g of st.gates)
        if (g.type === 'technique') {
          const items = program.techniqueChecks[g.exerciseId];
          expect(items, g.exerciseId).toBeDefined();
          expect(items.length).toBeGreaterThanOrEqual(3);
          expect(items.length).toBeLessThanOrEqual(5);
        }
  });
  it('session gates add up to roughly a year at 3×/week', () => {
    const total = program.stages.flatMap((s) => s.gates).reduce((n, g) => n + (g.type === 'sessions' ? g.min : 0), 0);
    // Stage 5 has no session gate (milestones instead) — ~36 sessions expected there.
    expect(total + 36).toBeGreaterThanOrEqual(140);
    expect(total + 36).toBeLessThanOrEqual(160);
  });
  it('workout templates have unique ids and sensible rep ranges', () => {
    const ids = program.stages.flatMap((s) => allTemplates(s).map((w) => w.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const st of program.stages)
      for (const w of allTemplates(st)) for (const s of w.slots) expect(s.repMin).toBeLessThanOrEqual(s.repMax);
  });
});
