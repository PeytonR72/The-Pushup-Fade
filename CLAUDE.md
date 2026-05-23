# The Pushup Fade

## What This Is
A competitive push-up battle web app. In Phase 1 (current), it is a single-player experience where
a voice mediator calls "down" and "up" commands and the app uses MediaPipe Pose to verify the user
completes each rep correctly via webcam. The user will be facing the camera at this stage in development (subject to change).Stats are saved locally. No backend logic runs in Phase 1.
Phase 2 will introduce invite-only multiplayer faceoffs. Phase 3 will introduce matchmaking.

## Tech Stack
- **Framework**: Next.js 14, App Router, TypeScript
- **Styling**: Tailwind CSS
- **Pose Detection**: MediaPipe Pose, loaded from CDN at runtime (NOT installed via npm)
- **Audio**: Web Audio API, pre-recorded MP3 clips in /public/audio/
- **Storage**: localStorage only (no Supabase reads/writes in Phase 1)
- **Database** (future): Supabase (env vars present, client initialized, but unused in Phase 1)
- **Hosting**: Vercel

## Project Structure
```
/public
  /audio
    down.mp3        ← voice command clip
    up.mp3          ← voice command clip
/src
  /app
    /solo
      page.tsx      ← the full game page
    page.tsx        ← landing page
    layout.tsx
    globals.css
  /lib
    supabase.ts     ← client init only, not called in Phase 1
    mediapipe.ts    ← MediaPipe loader and angle calculation utilities
    audio.ts        ← Web Audio API preloader and playback utility
    storage.ts      ← localStorage read/write helpers
  /types
    index.ts        ← shared TypeScript types
  /hooks
    usePose.ts      ← MediaPipe webcam + pose detection hook
    useMediator.ts  ← the mediator state machine hook
```

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
All in .env. Never hardcode. Supabase client is initialized but makes no calls in Phase 1.

## Visual Design System
- **Background**: #0a0a0a (near black, not pure black)
- **Primary text**: #f0ede8 (warm off-white, never pure #ffffff)
- **Accent / danger**: #c0392b (raw red — missed reps, warnings, destructive actions)
- **Success flash**: brief #ffffff flash on valid rep count increment
- **Borders**: 1px solid rgba(240, 237, 232, 0.15) — subtle, not glowing
- **No** rounded corners, shadows, gradients, or blur effects anywhere
- **No** cards with background fills — layout is type and borders only
- **Headers**: Bebas Neue (Google Fonts) — condensed, brutal, all-caps
- **Body / UI labels**: Inter or IBM Plex Mono — clean and utilitarian
- **Rep counter + timer**: monospace, large, feels like a scoreboard
- **State indicator** ("DOWN" / "UP" / "HOLD"): massive Bebas Neue, overlaid on or above the webcam feed

## Page Routes (Phase 1)

### `/` — Landing Page
- App name "THE PUSHUP FADE" in large Bebas Neue
- Short tagline: one line, brutal and direct
- "START FADE" button — primary CTA, navigates to /solo
- All-time stats pulled from localStorage: total sessions, best rep count, total reps
- If no localStorage data exists, stats show as dashes, not zeros

### `/solo` — The Game
Full-page experience. The entire game lives here. Five distinct UI states (see state machine below).

## The Game State Machine

The /solo page operates as a state machine with exactly 5 top-level states:

### 1. SETUP
- Request webcam permission
- Initialize MediaPipe Pose from CDN
- Show camera feed with landmark overlay once pose is detected
- Display a `setupStatus` text below the feed that diagnoses the current state so the
  user knows what to fix. States and messages:
  - `camera-loading` → "Requesting camera..."
  - `no-pose` → "Step into frame"
  - `frame-incomplete` → "Angle ~20 degrees so whole body fits in frame"
  - `not-in-plank` → "Get in pushup position"
  - `ready` → "Position locked. Press ready when set."
- The READY button is enabled ONLY when `setupStatus === 'ready'`. All of the following
  must hold for that to be the case:
  - Both elbows, both shoulders, both hips, both knees, both ankles have visibility >= 0.5
  - The user is in a valid plank (see Plank Posture Gate below for the rotation-invariant
    checks: hip on the body axis, ankle on the shoulder-knee line, wrists positioned along
    the body-axis-perpendicular)
- If `setupStatus` drops out of `'ready'` during COUNTDOWN, the page cancels the countdown
  and returns to SETUP so the user must reconfirm position.
- Recommended camera setup: position yourself at roughly a 20-degree angle to the camera
  (not perfectly head-on, not perfectly side-on). At 0 degrees forward-facing your feet
  fall behind the camera's depth axis and can't be detected. At 20 degrees your full body
  fits comfortably in frame, you can still glance at the screen, and rep detection is
  symmetric on both arms.

### 2. COUNTDOWN
- 3... 2... 1... displayed in large type over the feed
- User should get into push-up starting position (arms extended, top of rep)
- No voice commands yet
- Transitions automatically to ACTIVE after countdown

### 3. ACTIVE
The mediator loop runs. Each rep goes through these internal sub-states in order:

```
WAITING_FOR_DOWN
  → play down.mp3 immediately when this sub-state begins
  → on entry, begin tracking topShoulderY: the running minimum of midShoulder.y observed during
    this sub-state. (Normalized image coords: y = 0 is top of frame, y = 1 is bottom. The minimum
    of midShoulder.y is therefore the highest shoulder position seen so far, which auto-calibrates
    to the user's actual top-of-rep position.)
  → compliance window: user has 2000ms to reach bottom position
  → bottom position requires ALL of:
      - left elbow angle < 90°
      - right elbow angle < 90°
      - (current midShoulder.y - topShoulderY) >= 0.08 (shoulders have traveled at least 8% of
        frame height downward from the auto-captured baseline)
  → if compliant in time: transition to HOLDING_BOTTOM
  → if window expires: mark rep as MISSED, restart cycle from WAITING_FOR_DOWN

HOLDING_BOTTOM
  → user must maintain bottom position (both left and right elbow angles stay < 90°)
  → hold duration: random integer between 1000ms and 3500ms, chosen fresh each rep
  → if either elbow angle exceeds 90° before hold expires: mark rep as MISSED,
    restart from WAITING_FOR_DOWN
  → when hold expires: transition to WAITING_FOR_UP

WAITING_FOR_UP
  → play up.mp3 immediately when this sub-state begins
  → compliance window: user has 2000ms to return to top position
  → top position requires BOTH left and right elbow angles > 150°
  → if compliant in time: increment repsCompleted, transition to REST_AT_TOP
  → if window expires: mark rep as MISSED, restart from WAITING_FOR_DOWN

REST_AT_TOP
  → brief pause before next rep: random between 800ms and 2000ms
  → no voice, no commands — this is the breath moment
  → transition back to WAITING_FOR_DOWN when pause expires
```

Rep counter increments ONLY on a full clean cycle (down confirmed + hold survived + up confirmed).
Missed reps are tracked separately and shown on the results screen.
User can pause at any time via a visible PAUSE button.

### 4. PAUSED
- Mediator loop freezes, timer freezes, camera stays on
- Show RESUME and QUIT options
- RESUME restarts the loop from wherever it left off (mid-hold or mid-rest, not mid-rep)
- QUIT goes to RESULTS with whatever reps were accumulated

### 5. RESULTS
- Show: reps completed, reps missed, total session time, grade
- Grade logic:
  - 95%+ clean rate → S
  - 80–94% → A
  - 65–79% → B
  - 50–64% → C
  - Below 50% → F
  - (No D grade — intentional)
- Save session to localStorage (see storage schema below)
- Show: "RUN IT BACK" (play again) and "HOME" buttons

## MediaPipe Implementation

MediaPipe Pose is loaded from CDN, not npm. Load it in a useEffect on the /solo page.
Do NOT attempt to import it from node_modules.

CDN script URL:
```
https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js
```

Also load the drawing utils and camera utils if needed:
```
https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js
https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js
```

### Camera Setup and Landmark Selection
Phase 1 assumes the user is roughly facing the camera but rotated ~20 degrees to one side, so
the whole body fits in frame. (At a pure 0-degree forward-facing angle, the body extends back
along the camera's depth axis and the feet are physically out of frame; full-body checks become
impossible.) Both arms are tracked symmetrically every frame. Single-arm side-on filming is NOT
supported.

Required landmarks (track every frame):
- Shoulders: 11 (left), 12 (right)
- Elbows: 13 (left), 14 (right)
- Wrists: 15 (left), 16 (right)
- Hips: 23 (left), 24 (right)
- Knees: 25 (left), 26 (right)
- Ankles: 27 (left), 28 (right)

For posture checks, compute screen-space midpoints:
- midShoulder = average of LEFT_SHOULDER and RIGHT_SHOULDER
- midHip = average of LEFT_HIP and RIGHT_HIP
- midKnee = average of LEFT_KNEE and RIGHT_KNEE
- midAnkle = average of LEFT_ANKLE and RIGHT_ANKLE

Compute the elbow angle independently for each side using the formula below. Both angles must
satisfy the rep thresholds — the user must move both arms together.

Angle formula (vector-based, not dot product shortcut):
```typescript
function calculateAngle(
  a: { x: number; y: number },
  b: { x: number; y: number }, // vertex (elbow)
  c: { x: number; y: number }
): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let angle = Math.abs((radians * 180.0) / Math.PI)
  if (angle > 180.0) angle = 360 - angle
  return angle
}
```

### Canvas Overlay
Draw on a `<canvas>` element absolutely positioned over the `<video>` element. Draw:
- Both arms: each side's shoulder -> elbow -> wrist as connected line segments with filled
  circles at each landmark.
- Body axis: a faint line from midShoulder to midAnkle (visual aid for the plank check).
- Angle text: each side's elbow angle rendered near its own elbow landmark.

Do NOT draw the full MediaPipe skeleton.

### Low Light / Visibility Warning
If any required landmark (either elbow, either shoulder, either hip, either ankle) has a
visibility score below 0.5 for more than 10 consecutive frames during the ACTIVE state, pause
the session automatically and show: "MOVE TO BETTER LIGHT OR REPOSITION". Resume when visibility
recovers. This warning is suppressed in SETUP, since the user may not yet be in frame.

### Plank Posture Gate
The user must be in plank position with hands roughly under shoulders for rep detection to run.
All checks here are ROTATION-INVARIANT in 2D image space, so they work whether the user's body
in the image is horizontal (pure side-on), diagonal (the recommended ~20-degree angle), or
anywhere in between. We do NOT measure angle from horizontal anywhere in the plank check.

Each frame, compute:

- bodyAxis = unit vector from midShoulder to midAnkle in normalized image coords.
- hipDeviation = perpendicular distance from midHip to the infinite line through midShoulder
  and midAnkle (rotation-invariant, in normalized image units; use the 2D cross-product form
  `|(p - p1) × (p2 - p1)| / |p2 - p1|`). If the body axis is degenerate (midShoulder == midAnkle),
  treat as 0.
- ankleDeviation = perpendicular distance from midAnkle to the line through midShoulder and
  midKnee. In a real plank, ankle continues the shoulder-knee line, so this stays small. In a
  knee pushup the foot is raised, so the ankle pops off the line and this grows. This is the
  knee-pushup cheat check.
- shoulderWidth = |LEFT_SHOULDER.x - RIGHT_SHOULDER.x| in normalized image coords. Used as a
  per-user scale so wrist tolerance auto-adjusts to camera distance.
- leftWristDeviation = |dot(LEFT_WRIST - LEFT_SHOULDER, bodyAxis)| / shoulderWidth
- rightWristDeviation = |dot(RIGHT_WRIST - RIGHT_SHOULDER, bodyAxis)| / shoulderWidth
  (each wrist's offset from its shoulder projected ONTO the body axis, expressed as a multiple
  of shoulder width — i.e. how far forward or back along the body the wrist sits. In a clean
  pushup the wrist drops perpendicular to the body axis, so this projection stays small.)

Plank is valid when ALL of:
- hipDeviation <= 0.08
- ankleDeviation <= 0.06
- leftWristDeviation <= 1.0
- rightWristDeviation <= 1.0

(The wrist tolerance of 1.0× shoulder width is generous on purpose — it catches obviously wide
or far-forward hand placement without flagging legitimate variations.)

If plank is invalid for more than 10 consecutive frames during the ACTIVE state, pause the
session and show: "GET IN PUSHUP POSITION". Resume when plank is valid again. This gate is
evaluated only during ACTIVE (and PAUSED, where it is irrelevant); SETUP also evaluates plank
validity to gate the READY button, but uses no consecutive-frame buffer there (the user can
keep adjusting in SETUP, and the button enables/disables in real time).

## Audio Implementation

Use the Web Audio API. Do NOT use HTML `<audio>` tags (autoplay restrictions, latency).

Preload both clips when the /solo page mounts:
```typescript
// Fetch and decode both clips into AudioBuffer on mount
// Store in a ref so they are ready to fire instantly
// Play by creating a new AudioBufferSourceNode each time (they are single-use)
```

Audio files live at: `/public/audio/down.mp3` and `/public/audio/up.mp3`

## localStorage Schema

Key: `"pushup-fade-stats"`

```typescript
interface StoredStats {
  sessions: Session[]   // max 20, oldest dropped when limit reached
  allTime: {
    totalSessions: number
    bestReps: number
    totalReps: number
  }
}

interface Session {
  id: string            // crypto.randomUUID()
  date: string          // ISO string
  repsCompleted: number
  repsMissed: number
  duration: number      // seconds
  grade: 'S' | 'A' | 'B' | 'C' | 'F'
}
```

After every session: push new session to sessions array, trim to 20, recalculate and overwrite
allTime. Never mutate allTime directly from a single session — always derive from full sessions array.

## What Supabase Does in Phase 1
Nothing. The client is initialized in /src/lib/supabase.ts using env vars. No tables exist yet.
No calls are made. This is intentional. Phase 2 will add tables and calls without refactoring the
client setup.

## Phase Roadmap (for context — do not build ahead)
- Phase 1 (current): Single-player, anonymous, localStorage only
- Phase 2: Invite-only multiplayer — shared room code, Supabase Realtime sync, both players
  receive the same mediator commands simultaneously, rep counts shown side by side
- Phase 3: Matchmaking queue — anonymous users paired automatically, presence system

## Coding Conventions
- TypeScript strict mode — no `any` types
- All game logic lives in hooks (/src/hooks/) — pages are thin, hooks are fat
- State machine transitions must be explicit — no implicit state drift
- No inline styles — Tailwind classes only
- All timers and intervals must be cleaned up in useEffect return functions
- All MediaPipe and Web Audio API calls wrapped in try/catch with console.error logging
- Never use em dashes in comments, strings, or any text content in the app

## For Future Claude: Keep This Document Current
This file is the project's memory across sessions. Update it as part of your work, not as a separate ask.

- Made a non-obvious decision (threshold values, an architecture choice, "we tried X and it broke so we went with Y")? Add a line in the relevant section.
- Changed a rule, formula, or threshold in the code that's documented here? Update the matching section in the same commit. Doc-vs-code drift is a bug.
- Discovered a future-Claude-trap (the kind of thing that would waste a future session if not written down)? Document it. Examples already in this file: the no-em-dashes rule, the MediaPipe-from-CDN rule, the Vercel deploy checklist below.
- Removed or renamed something the doc still references? Strike the stale text.
- Don't ask the user "should I update CLAUDE.md?" — just edit it as part of the change.

## Before You Push: Vercel Pre-Deploy Checklist
Vercel builds from `origin/main` and build failures are a recurring issue. Always run these locally before pushing anything that will end up on main:

1. **No merge conflict markers anywhere.** A previous merge that wasn't cleanly resolved leaves `<<<<<<< HEAD`, `=======`, `>>>>>>> ...` lines in files, including `package-lock.json`. Check with:
   ```
   grep -rE "(<<<<<<<|=======|>>>>>>>) " src/ package-lock.json CLAUDE.md
   ```
   Anything found must be removed before committing. If the GitHub "Resolve conflicts" web editor flags a PR, the markers MUST be deleted in that editor BEFORE clicking "Mark as resolved" / "Commit merge." Clicking commit with markers still in the file commits them literally — that's what broke the build on 2026-05-17.

2. **Type check passes.** `npx tsc --noEmit` — must exit clean. Vercel runs this implicitly via `next build`.

3. **Lint passes.** `npx next lint` — Vercel treats lint warnings as build errors in CI.

4. **Full Next build passes locally.** `npx next build` — this is the exact command Vercel runs. If it works locally, it almost always works on Vercel. Run it at minimum before any merge into main.

5. **Lockfile is in sync with package.json.** If you touched `package.json`, run `npm install` to refresh `package-lock.json` and commit BOTH. Vercel installs from the lockfile verbatim; drift causes "module not found" failures.

6. **Imports are case-correct.** Windows is case-insensitive on the filesystem; Vercel (Linux) is not. `import '@/lib/Audio'` works locally but breaks on Vercel if the file is `audio.ts`. Match casing exactly.

If any of the above fails, fix it before pushing. Don't "push and see what Vercel says" — Vercel time is slow feedback compared to a local build.

### Vercel Project Settings (set once, but verify if 404s appear)
A successful build that still 404s at `/` almost always means the Vercel project's Framework Preset is wrong. On the Vercel dashboard, under Project → Settings → General → Build & Development Settings, confirm:

- **Framework Preset**: `Next.js` (NOT "Other" or "Static" — those serve the repo as static files, ignore Next.js routing, and 404 on every dynamic route)
- **Root Directory**: empty or `./` (the app lives at repo root)
- **Build Command**: default (`next build`) — leave empty unless you have a reason
- **Output Directory**: default (`.next`) — leave empty
- **Install Command**: default (`npm install`) — leave empty

If you change the preset, trigger a fresh deploy with the build cache disabled. This was the root cause of the 404 on 2026-05-17 after a successful build.