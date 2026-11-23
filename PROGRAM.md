# The Rep program: methodology and every gate

Rep takes a complete beginner to a solid intermediate level in about a year. At 3 sessions a week that's roughly **45–55 weeks, ~145–160 sessions**. You advance by **doing the work and hitting targets**, not because weeks pass. Train less and it takes longer; nothing is lost.

The whole program is data in [`src/data/program.json`](src/data/program.json). Edit it there.

## Core ideas (in plain words)

| Idea | What it means |
|---|---|
| **Double progression** | Each exercise has a rep range (e.g. 8–12). Add reps until every set hits the top of the range at "Solid" or "Easy", then add one weight step and start again at the bottom. |
| **Linear progression** (Stage 3 main lifts) | 3 × 5. Get all your reps → add weight next time (+5 lb upper body, +10 lb legs; +5 lb if every set felt Max). Miss once → repeat. Miss twice in a row at the same weight → drop 10% and build back. |
| **"How was set N?"** | Asked right under the set you just finished: Easy (4+ reps left) / Solid (2–3) / Max (0–1). Internally this is RIR ≈ 4 / 2 / 0. Skipping counts as Solid. Weight only goes up when the top of the range was hit without a Max set. |
| **Find your weight** | First time you do any loaded exercise: start light, do ~10 reps, rate it. Easy → about +25%, Max → about −15% (−20% if reps were missed), Solid → that's your working weight. Max 4 tries. **Every test set counts as a real set** (reps, volume, records); test sets just don't decide next time's weight. If the planned sets run out before the weight is found, next session starts from the last test. |
| **New rep range** | When an exercise moves to a different rep range (e.g. a new stage), the starting weight is derived from your recent estimated max (Epley, `w × (1 + reps/30)`, capped at 12 reps) at 95%, rounded down. |
| **Warm-ups** | Main lifts get 1–3 warm-up sets (barbell: empty bar × 10, ~50% × 5, ~75% × 3; machines/dumbbells: ~50% × 8). Shown, never counted, one-tap skip. |
| **Equipment steps** | Machine stack 10 lb, cable 5 lb, dumbbells 5 lb per hand, barbell 5 lb total (2.5 lb plates). kg: 5 / 2.5 / 2 / 2.5. All editable in Settings. Rounding happens in your display unit, so lb↔kg never drifts. |
| **Body-weight targets** | Strength gates are multiples of your **latest 7-day average body weight**, shown as real numbers rounded up to a loadable weight ("Leg press 250 lb × 10"). |
| **Substitutions** | Swaps stay in the same movement pattern. Gates accept listed equivalents (e.g. trap-bar deadlift counts for deadlift; Smith squat counts at 0.9×; hack squat counts toward leg press at 1.6×). |

## Scheduling

- Target N sessions per Mon–Sun week (default 3). Full-body stages keep a rest day between sessions; upper/lower can go back to back.
- **Never 3 days in a row.** Back-to-back days happen only when the week can't fit the target otherwise; in full-body stages the second one becomes the 20-minute version.
- **Rides:** no heavy legs the day before a usual long-ride day or on a day with a logged long/hard ride. Rep recommends rest instead, or (if the week needs the session) keeps lower-body work at the same weight for 2 sets ("legs light"). In the upper/lower stage it swaps in an upper day.
- **Rotation by order**, never by weekday: A → B → A…
- **Re-entry:** 7+ days off → next session ~85% load, 2 sets. 21+ days → two easy sessions (80%, then 90%), then normal progression.
- **20-minute version:** first 4 exercises, 2 sets each. It counts as a session.

## Deloads (triggered by data, not the calendar)

Suggested (you can accept or dismiss) when any of these is true:
1. ≥ 2 main lifts stalled: no load or rep increase across 2 consecutive exposures.
2. ≥ 50% of the week's working sets rated Max (at least 6 sets).
3. "Something hurts" logged twice in 7 days.
4. Fallback: ~8 weeks of continuous training since the last deload or break (5 weeks in Stage 5 = 4 hard weeks + 1 light).

A deload lasts 7 days: same exercises, ~60% load, 2 sets. Deload and re-entry sessions never drive progression decisions. Dismissing silences suggestions for 7 days.

## Gates

Every stage combines **consistency**, **performance** and **skill**. When everything is met, Rep suggests moving up (you can stay longer). If ≥ 70% of gates are met and the sessions gate was met 6+ weeks ago, Rep offers **"Move up anyway"**, since new exercises often unstick a stalled target. You can always repeat an earlier stage.

"Consistency" below = **≥ 2 sessions/week in 5 of the last 6 weeks** (current week included once it qualifies).

### Stage 1: Foundation (machines, learn to train), about weeks 1–8
Two alternating full-body workouts. First 6 sessions use 2 sets per exercise.
- **A:** Leg press 3×8–12 · Chest press machine 3×8–12 · Lat pulldown 3×8–12 · Seated leg curl 2×10–15 · Shoulder press machine 3×8–12 · Plank 2×20–45 s
- **B:** Goblet squat 3×8–12 · Seated cable row 3×8–12 · Incline DB press 3×8–12 · DB Romanian deadlift 3×8–12 · DB curl 2×10–15 · Cable triceps pushdown 2×10–15 · Dead bug 2×6–10/side

Gates: 16 sessions (sessions done before the app count) · consistency · leg press 1.5×BW × 10 · lat pulldown 0.6×BW × 10 · chest press 0.6×BW × 10 · goblet squat 0.35×BW × 10 (one dumbbell) · technique checks: goblet squat, DB RDL.

*Coach's notes:* I kept your A/B plan. Shoulder press went to 3 sets (it's a compound), and curl/pushdown are separate slots so each can progress on its own.

### Stage 2: Free-weight fundamentals, about weeks 8–18
Three rotating full-body workouts, each with a squat or hinge, a push, a pull, a vertical push or pull, an accessory and core.
- **A:** Back squat 3×6–10 · DB bench 3×6–10 · Chest-supported DB row 3×8–12 · DB shoulder press 3×8–12 · Face pull 2×12–15 · Pallof press 2×10–12
- **B:** Barbell RDL 3×6–10 · Incline DB press 3×6–10 · Assisted pull-up 3×6–10 · Seated cable row 3×8–12 · Split squat 2×8–12/leg · Farmer carry 3×30–45 s
- **C:** Back squat 3×6–10 · DB bench 3×6–10 · Lat pulldown 3×8–12 · One-arm DB row 3×8–12 · Back extension 2×10–15 · Side plank 2×20–40 s

Gates: 24 sessions · consistency · back squat 0.8×BW × 8 (Smith counts at 0.9×) · DB bench 0.25×BW per hand × 8 · barbell RDL 0.9×BW × 8 · assisted pull-up with ≤ 40% BW help × 6 **or** 1 strict pull-up · technique checks: back squat, barbell RDL, DB bench.

*Coach's notes:* Squat appears in two of three workouts (it's the lift you most need to practise); the Smith machine is listed as the first substitute for anyone nervous under a bar.

### Stage 3: Strength base (barbell basics), about weeks 18–30
Two alternating full-body workouts. Main lifts 3×5 with linear progression; accessories double progression.
- **A:** Back squat 3×5 · Bench press 3×5 · Barbell row 3×6–8 · Barbell curl 2×8–12 · Rear delt fly 2×12–15 · Ab wheel 2×6–10
- **B:** Deadlift 2×5 · Overhead press 3×5 · Assisted/strict pull-up 3×5–8 · Triceps pushdown 2×10–12 · Standing calf raise 2×10–15 · Hanging knee raise 2×8–12
- **Optional "Upper pump"** 4th day, unlocked after 4 straight weeks of 3+ sessions.

Gates: 30 sessions · consistency · squat 1.0×BW × 5 · bench 0.75×BW × 5 · deadlift 1.25×BW × 5 (trap bar counts) · OHP 0.5×BW × 5 · 3 strict pull-ups (chin-ups count) · technique checks: deadlift, bench press.

*Coach's notes:* I split squat and deadlift across A and B instead of squatting every session. With 3–4 bike rides a week, squatting 3× a week as well would leave your legs constantly tired. I also added two technique checks, because these are the two lifts where form matters most for safety.

### Stage 4: Build muscle (upper / lower), about weeks 30–42
Upper A → Lower A → Upper B → Lower B. Four days is ideal; at three a week the rotation just continues. One heavy main lift per day (4×4–6, double progression), then hypertrophy work.
- **Upper A:** Bench 4×4–6 · Pull-up 3×6–10 · Incline DB press 3×8–12 · Chest-supported row 3×8–12 · Lateral raise 3×12–20 · Hammer curl 2×10–12 · Overhead triceps ext. 2×10–12
- **Lower A:** Back squat 4×4–6 · Barbell RDL 3×8–10 · Bulgarian split squat 3×8–12 · Leg curl 3×10–15 · Calf raise 3×10–15 · Hanging knee raise 3×8–15
- **Upper B:** OHP 4×4–6 · Barbell row 3×6–10 · Incline bench 3×6–10 · Lat pulldown 3×10–12 · Face pull 3×12–20 · Barbell curl 2×8–12 · Dip 2×6–12
- **Lower B:** Deadlift 4×4–6 · Leg press 3×10–15 · Hip thrust 3×8–12 · Leg extension 2×12–15 · Seated calf 3×12–15 · Cable crunch 3×10–15

Pull-ups and dips become weighted automatically once every set reaches the top of the range ("earned"). Weekly hard sets land around 10–16 per major muscle at 4 sessions/week.

Gates: 36 sessions · consistency · squat 1.25×BW × 5 · bench 0.9×BW × 5 · deadlift 1.5×BW × 5 · 6 strict pull-ups.

### Stage 5: Intermediate (periodized), about weeks 42–52+
Three rotating full-body days with undulating intensity: **Heavy** (3–5 reps), **Moderate** (4–8), **Light** (8–12+). Blocks of ~4 hard weeks end with a lighter week (deload every 5 weeks). Optional 4-week **specialization block**: arms & shoulders, upper chest, or legs (adds 2 exercises to each session).

**Year-one milestones** (estimated 1RM, so you never need to test a true max): squat 1.5×BW · bench 1.0×BW · deadlift 1.75×BW · OHP 0.65×BW · 10 strict pull-ups. Hitting them shows a year summary and offers **Year 2**: squat 1.75× · bench 1.15× · deadlift 2.0× · OHP 0.75× · 12 pull-ups.

*Coach's notes:* Three full-body days (rather than another 4-day split) suit a schedule that swings between 1–2 and 3–4 sessions a week.

## Technique self-checks
For goblet squat, DB RDL, back squat, barbell RDL, DB bench, deadlift and bench press: a 3–5 item checklist (in `program.json → techniqueChecks`). Read the cues, do a light set (filming from the side helps), tick what you nailed.

## Strength standards (Progress screen)
Best estimated max ÷ body weight. Conservative levels: Beginner / Novice / Intermediate. For example squat 0.75 / 1.0 / 1.5, bench 0.5 / 0.75 / 1.0, deadlift 1.0 / 1.25 / 1.75, OHP 0.35 / 0.5 / 0.7. Full table in `program.json → strengthStandards`.

## Honesty about belly fat
Ab exercises don't burn belly fat. Fat loss comes from diet plus total activity; muscle makes it easier and changes how you look as fat comes off. Core work here is for strength, posture and a healthy back.

## Safety
General training app, not medical advice. Stop any exercise that causes sharp pain; check with a doctor if pain persists. Use safety pins/arms on all barbell lifts.
