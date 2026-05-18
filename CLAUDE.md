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
- Show "READY" button only after both arms are detected: both elbow landmarks have visibility
  >= 0.5 and both elbow angles are computable
- Do not allow the user to proceed until pose is confirmed

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

### Forward-Facing Setup and Landmark Selection
Phase 1 assumes a forward-facing camera (phone or laptop placed in front of the user, low or at
floor level, framing the whole body in plank). Both arms are tracked symmetrically every frame.
Single-arm side-on filming is NOT supported.

Required landmarks (track every frame):
- Shoulders: 11 (left), 12 (right)
- Elbows: 13 (left), 14 (right)
- Wrists: 15 (left), 16 (right)
- Hips: 23 (left), 24 (right)
- Ankles: 27 (left), 28 (right)

For posture checks, compute screen-space midpoints:
- midShoulder = average of LEFT_SHOULDER and RIGHT_SHOULDER
- midHip = average of LEFT_HIP and RIGHT_HIP
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
The user must be in plank position for rep detection to run. Each frame, compute:

- bodyAxisAngle = atan2(|midAnkle.y - midShoulder.y|, |midAnkle.x - midShoulder.x|) * 180 / PI
  (angle of the body axis from horizontal, in degrees, range 0-90)
- hipDeviation = perpendicular(ish) distance from midHip to the line midShoulder->midAnkle,
  measured as |midHip.y - lineYAtX(midHip.x)| in normalized image coords. If the line is
  degenerate (midAnkle.x ≈ midShoulder.x), treat hipDeviation as 0.

Plank is valid when bodyAxisAngle <= 25° AND hipDeviation <= 0.10.

If plank is invalid for more than 10 consecutive frames during the ACTIVE state, pause the
session and show: "GET IN PUSHUP POSITION". Resume when plank is valid again. This gate is
evaluated only during ACTIVE (and PAUSED, where it is irrelevant); SETUP and COUNTDOWN do not
enforce it.

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