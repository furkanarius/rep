// Core domain types shared by the engine, the database layer and the UI.
// All loads are stored in KILOGRAMS internally and converted at the edges.

export type Muscle =
  | 'chest'
  | 'front-delts'
  | 'side-delts'
  | 'rear-delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'lats'
  | 'upper-back'
  | 'lower-back'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

export type Pattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'horizontal-push'
  | 'vertical-push'
  | 'horizontal-pull'
  | 'vertical-pull'
  | 'carry'
  | 'core-anti-extension'
  | 'core-anti-rotation'
  | 'core-flexion'
  | 'isolation';

export type Equipment =
  | 'machine'
  | 'cable'
  | 'dumbbell'
  | 'barbell'
  | 'bodyweight'
  | 'bench'
  | 'rack'
  | 'pullup-bar'
  | 'smith'
  | 'trap-bar'
  | 'kettlebell';

export type LoadType = 'stack' | 'dumbbell-per-hand' | 'barbell-total' | 'bodyweight' | 'assisted' | 'time';

export type StickPose = {
  /** Angles in degrees, measured from straight down, clockwise toward the figure's front (right). */
  torso: number;
  head?: number;
  upperArm: number;
  forearm: number;
  upperArm2?: number;
  forearm2?: number;
  thigh: number;
  shin: number;
  thigh2?: number;
  shin2?: number;
  /** Hip position as fraction of the viewBox (0..1). */
  hipX: number;
  hipY: number;
};

export type StickFigure = {
  start: StickPose;
  end: StickPose;
  /** Equipment drawn in the accent colour. */
  props?: ('dumbbell' | 'barbell' | 'bench' | 'bar-overhead' | 'floor' | 'kettlebell')[];
};

export type Exercise = {
  id: string;
  name: string;
  aka?: string[];
  pattern: Pattern;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
  level: 1 | 2 | 3 | 4 | 5;
  purpose: string;
  cue: string;
  setup: string[];
  execution: string[];
  breathing: string;
  feelItIn: string;
  commonMistakes: string[];
  safety?: string;
  regressionId?: string;
  progressionId?: string;
  substitutes: string[];
  loadType: LoadType;
  /** 'seconds' for holds and carries. Defaults to reps (or seconds for loadType 'time'). */
  measure?: 'reps' | 'seconds';
  /** Unilateral exercises: reps are per side. */
  perSide?: boolean;
  /** Bodyweight moves that progress by adding load (pull-ups, dips). */
  canAddWeight?: boolean;
  defaultIncrementLb: number;
  defaultRestSec: number;
  /** Conservative first-time weight for the "find your weight" flow, in lb. */
  startLb?: number;
  /** Empty-bar weight for barbell-total moves that use a lighter bar (EZ bar, Smith machine). */
  barLb?: number;
  media: {
    /** Source entry in yuhonas/free-exercise-db (public domain). */
    datasetId?: string;
    images?: string[];
    animation?: 'crossfade' | 'svg';
    stick?: StickFigure;
    videoUrl?: string;
    videoSearchUrl: string;
    credit?: string;
  };
};

export type SlotRole = 'main' | 'secondary' | 'accessory' | 'core';
export type ProgressionScheme = 'double' | 'linear';

export type Slot = {
  exerciseId: string;
  role: SlotRole;
  sets: number;
  repMin: number;
  repMax: number;
  restSec?: number;
  progression: ProgressionScheme;
  note?: string;
};

export type Focus = 'full' | 'upper' | 'lower';

export type WorkoutTemplate = {
  id: string;
  name: string;
  shortName: string;
  focus: Focus;
  /** Hard lower-body work: avoided the day before / of a long ride. */
  lowerHeavy: boolean;
  estMinutes: number;
  description: string;
  intensity?: 'heavy' | 'moderate' | 'light';
  slots: Slot[];
};

export type LiftAccept = { exerciseId: string; factor: number };

export type Gate =
  | { id: string; type: 'sessions'; min: number }
  | { id: string; type: 'consistency'; minPerWeek: number; weeksRequired: number; windowWeeks: number }
  | {
      id: string;
      type: 'lift';
      exerciseId: string;
      ratio: number;
      reps: number;
      accept?: LiftAccept[];
    }
  | {
      id: string;
      type: 'e1rm';
      exerciseId: string;
      ratio: number;
      accept?: LiftAccept[];
    }
  | {
      id: string;
      type: 'assist';
      exerciseId: string;
      maxAssistRatio: number;
      reps: number;
      orStrictExerciseId: string;
      orStrictReps: number;
    }
  | { id: string; type: 'bodyweightReps'; exerciseId: string; reps: number; accept?: string[] }
  | { id: string; type: 'technique'; exerciseId: string };

export type Specialization = {
  id: string;
  name: string;
  description: string;
  weeks: number;
  extraSlots: Slot[];
};

export type Stage = {
  id: string;
  number: number;
  name: string;
  purpose: string;
  summary: string;
  weeksHint: string;
  whatsNew: string[];
  split: 'full' | 'upper-lower';
  /** First N sessions of the stage use `introSets` sets per exercise. */
  introSessions?: number;
  introSets?: number;
  deloadEveryWeeks: number;
  workouts: WorkoutTemplate[];
  optionalWorkouts?: (WorkoutTemplate & { unlock: { minPerWeek: number; weeks: number }; unlockText: string })[];
  gates: Gate[];
  specializations?: Specialization[];
  /** Year-2 replacement gates for the final stage. */
  year2Gates?: Gate[];
};

export type StandardLevel = { label: string; ratio: number };
export type StrengthStandard = {
  id: string;
  name: string;
  exerciseIds: string[];
  levels: StandardLevel[];
};

export type Program = {
  version: number;
  stages: Stage[];
  techniqueChecks: Record<string, string[]>;
  strengthStandards: StrengthStandard[];
};

// ---------- Records (shared with the DB layer) ----------

export type Feel = 'easy' | 'solid' | 'max';
export type SessionStatus = 'in_progress' | 'done' | 'discarded';
export type RideType = 'commute' | 'long' | 'hard';
export type SetKind = 'warmup' | 'calibration' | 'work';
export type LoadUnit = 'lb' | 'kg';

export type Syncable = { id: string; updatedAt: number; deletedAt?: number };

export type SessionRec = Syncable & {
  workoutTemplateId: string;
  stageId: string;
  startedAt: string; // ISO
  finishedAt?: string;
  status: SessionStatus;
  isShortVersion: boolean;
  isDeload: boolean;
  isReentry: boolean;
  legsLight?: boolean;
  notes?: string;
  exerciseNotes?: Record<string, string>;
  /** Exercise order actually used (after substitutions) — keyed by slot index. */
  slotExercise?: Record<number, string>;
};

export type SetRec = Syncable & {
  sessionId: string;
  exerciseId: string;
  slotIndex: number;
  setIndex: number;
  isWarmup: boolean;
  kind: SetKind;
  targetWeight: number; // kg
  targetReps: number;
  weight: number; // kg (for 'assisted': assistance; for 'bodyweight': added load)
  reps: number; // or seconds
  feel?: Feel;
  completedAt: string;
  substitutedFrom?: string;
};

export type RideRec = Syncable & { date: string; minutes: number; type: RideType };

export type BodyMetricRec = Syncable & {
  date: string;
  weightKg?: number;
  waistNavelCm?: number;
  waistNarrowCm?: number;
};

export type EventType =
  | 'pain'
  | 'stage-unlock'
  | 'stage-start'
  | 'stage-stay'
  | 'deload-accepted'
  | 'deload-dismissed'
  | 'technique-passed'
  | 'tip-seen'
  | 'specialization-start'
  | 'year2-start';

export type EventRec = Syncable & {
  type: EventType;
  date: string; // ISO
  exerciseId?: string;
  data?: Record<string, unknown>;
};

export type PreferenceRec = Syncable & {
  // id = exerciseId
  alwaysSubstituteWith?: string;
  incrementLb?: number;
  startingWeightKg?: number;
};

export type Increments = {
  machine: number;
  cable: number;
  dumbbell: number;
  barbell: number;
  bodyweight: number;
};

export type Settings = {
  id: 'main';
  loadUnit: LoadUnit;
  bodyUnit: 'kg' | 'lb';
  lengthUnit: 'cm' | 'in';
  incrementsLb: Increments;
  incrementsKg: Increments;
  targetPerWeek: number;
  preferredTime: 'morning' | 'midday' | 'evening';
  longRideDays: number[]; // ISO weekday 1=Mon … 7=Sun
  sound: boolean;
  theme: 'system' | 'light' | 'dark';
  onboardingDone: boolean;
  currentStageId: string;
  stageStartedAt?: string;
  priorStage1Sessions: number;
  heightCm?: number;
  year: number;
  specialization?: { id: string; startedAt: string };
  lastBackupAt?: number;
  gistToken?: string; // never exported or synced
  gistId?: string;
  lastSyncAt?: number;
  syncPending?: boolean;
  updatedAt: number;
};
