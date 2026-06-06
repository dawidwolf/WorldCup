
# PROJECT MASTER PLAN & SPECIFICATION: SOCCER PREDICTION APP

This document serves as the absolute single source of truth for the application. It maps out both the non-technical game rules and the precise technical blueprints. I will constantly update and populate each section with specific ideas, rules, logic, and constants so that AI assistants (like GitHub Copilot) can implement them perfectly without breaking the existing UI. The entire project is being built by vibe coding, thats the reason for this file.

The rules and logistics of the 2026 FIFA World Cup are described in the FIFA_rules.md file.

---

## 1. PROJECT OVERVIEW & CORE GOALS
This is a soccer predictor web app for the 2026 FIFA World Cup. The codebase is Next.js + TypeScript, uses Supabase for storage and auth, and targets mobile-first UI with Tailwind CSS. The project aims to be a lightweight PWA deployable to Vercel and is built for friendly pools rather than commercial scale.
Users register or log in, join a pool, and land on the Matches tab where they submit predictions. Before tournament start users set their tournament `winner` and `top scorer` picks in the Bonus tab. The app preserves sessions, shows leaderboard and stats, and uses Supabase realtime where it improves the live UI.

### 1.1 Project Statement & Purpose
- **What is the primary goal of this application?** 
  A completely free, automated prediction web based game for my friends for the 2026 World Cup. 
- **Core Value Proposition:**
  Zero manual work for the admin, zero paid database or API costs. 

### 1.2 Target Audience & Scale
- **Who is playing?** school friends, co-workers, families etc. 
- **Estimated number of concurrent pools/rooms:** it will not exceed 10, but most likely there will be 3 pools. 
- **Estimated total number of players:** 10-100

---

## 2. APP FLOW & COMPONENT-BY-COMPONENT UI
**Basics:**
At start, user sees a sign up / log in page, then a pools page (join or create). After selecting a pool the user enters the dashboard. The dashboard presents a fixed header and a bottom navigation with four tabs. The default landing tab is Matches; other tabs are Bonus (the tab label is Bonus, while the internal route id still uses `players` for compatibility), Rankings, and Profile.
- *Header:* The header is a minimalist, fixed bar at the top with a subtle backdrop blur. It displays ONLY the active pool's name in centered, uppercase text with wide tracking. It does not show rank, points, or the username to keep the viewport clean.
- *Menu:* on the bottom there is a band with 4 buttons: "Matches", "Bonus", "Rankings" and "Profile". User can click the icons in the menu to navigate between tabs.

Modal overlays and searchable dropdowns use browser-history-backed dismissal, so the Back button closes the open layer instead of leaving the page.

### 2.1 Landing / Authentication Site (The Gatekeeper)
- **Authentication**

  When a user first visits the site they are asked to register or log in.

  - Register: pick a globally-unique `username` (e.g. "J.MOrgan" or "Jamie"). Usernames are globally unique across the system. Choose a 4-digit numeric Passcode for quick authentication. The uniqueness check runs against the global `users` table.
  - Log in: enter `username` and Passcode.

- **Pools**

  After registering or logging in (or on every fresh app load if a pool isn't already active), the user is presented with the Pools screen. This ensures they choose their context before seeing the dashboard:

  - Your Pools: If the user is already a member of pools, they see a list of them with an "Enter →" button to select that pool.
  - Join a pool: enter the pool name (e.g. SoccerLads). If valid, the user is added to that pool and appears on its leaderboard.
  - Create a pool: provide a pool name and tap "Create". The creator becomes pool admin. Anyone with the pool name can join. Admins can remove users from their pool.

- **Security & RLS (Row-Level Security)**
  The application uses Supabase RLS policies to allow the `anon` role (for Username+Passcode auth) to:
  - `INSERT` new users (Sign up)
  - `SELECT` and `UPDATE` their own data
  - Join/Create pools via the `pools` and `user_pools` tables.

- **Visual Description**
  The login/register screen has a toggle between "Log in" and "Sign up", with two inputs: `username` and 4-digit `Passcode` (standard styled input). Minimal design; reuse global styles from the main UI. The login cards are compact and have a consistent height. Usernames are uppercased as you type, login is case-insensitive, and the 4-digit Passcode auto-submits when complete. The pools page uses a tabbed layout to "Join Pool" (via pool name) or "Create Pool". Below the action card, the user's currently joined "Pools" are listed for quick entry.

### 2.2 Matches Tab (image_70bc4e.png Reference)
- **Layout & Cards:**
  The Matches tab is the main view for users. All matches are shown as cards, sorted by kickoff time. The top card is the earliest upcoming match; the bottom card is the final. Knockout matches are shown from the start with placeholder names (e.g., "QF1") until teams are known.

  Each match card shows:
  - group / round label and kickoff date/time (converted to local time in the client)
  - team flags and three-letter abbreviations (UI shows abbreviations only)
  - input or display area for predicted / final scores
  - status badge in the top-right

  When the Matches tab loads it scrolls to show today's or the nearest upcoming match by default. The top filter bar is fixed and the scroll calculation accounts for the filter height to avoid covering the top card.

  There are four filter buttons at the top of the Matches tab. The active filter is filled with the primary accent color; inactive filters are outlined. These filters only change which cards are visible, not their sort order.

- **Match Card States:**
  On the top right of each match card there is a rounded box with the statuses name inside, which changes with time and/or user action as described below. The states can be:
  - *1.: "Coming up": a yellow/amber box saying "coming up"* -> upcoming matches more than 24 hours away from kickoff are in this state. Users can still predict, and once they enter a valid score the status changes to "Saved".
  - *2.: "Closes soon": a red warning* -> if a match is within 24 hours of kickoff and the user has not predicted it yet, the card shows "Closes soon" to warn them that the deadline is close.
   - *3.: "Saved": a green "saved" with a tick check* -> if the match has not started yet and the user has already put in a valid prediction, the status is "Saved". In this status, users can still change their predictions before kickoff. **Deletion Logic:** If a user clears both score inputs (home and away), the prediction is deleted from the database. If only one input is cleared, the value is treated as `0` for the database record to satisfy the `NOT NULL` constraint, while the UI remains empty for the user.
  - *4.: "Live": the match started but has not finished yet* -> once the API marks the match live (`LIVE`, `1H`, `2H`, `ET`, or `PEN`) the card becomes read-only. The prediction is visible, the inputs are greyed out, and the score can no longer be changed.
  - *5.: "Finished": Match Completed* -> after the match is finished (`is_finished` or `FT`), the card is read-only in grey and the final score is shown on the card. **Missing Data Fallback:** If a match is finished but the user did not submit a prediction, the card displays "No prediction submitted" instead of an error or empty points.
  - *Live/Finished footer line:* Live and finished cards always render an inline footer line under the score area. The footer reads `You predicted: X:Y. Tap to see predictions.` when a prediction exists, or `No prediction submitted. Tap to see predictions.` when it does not. The tap hint must stay on the same line as the prediction text, not below it. For finished matches, the points badge remains on the right side of the footer.

- **Match Predictions Modal:**
  Tapping a match card opens a modal overlay showing all predictions for that specific match within the currently active pool.
  - **Fetch Logic:** Data is fetched from `pool_predictions_view`, filtered by `match_id` and `pool_id`.
  - **Display:** Shows the predictor's name and their predicted score.
  - **Current User Label:** In the list, the currently logged-in user is marked inline as `(You)` next to their name.
  - **Live Empty State:** If the match is currently live and there are no predictions yet, the modal displays `No predictions` instead of the generic empty CTA.
  - **Finished Match Highlights:** If the match is finished, a visual badge reveals the points earned for that exact guess:
    - **Green Badge (+3 PTS):** Exact score hit.
    - **Blue Badge (+1 PT):** Outcome hit (winner/draw).
    - **Gray Badge (0 PTS):** No points earned.

  - **Empty State:** The modal no longer injects demo data. If the fetched list is empty it displays a centered empty state: "No predictions".
  - **Overlay Behavior:** The modal uses history-backed dismissal, so browser Back closes it cleanly.

- **Match Filters:** 
  Behavior for filters(filters don't change how match cards look, and they also don't change their order): 
  - 'All Matches': this is the default one which is active when users load the website. this displays all matches as already described. 
  - 'Today': here only the matches of the current day are displayed, and also the matches of the next day, with the same cards. so this is a filter that filters by time. (order her is: a text saying"Today" the top card is the first match of the day, then second and so on, then the last game of the day, then a separator line with a text saying "Tomorrow" and then the first game of tomorrow and so on, th last one is the last game of tomorrow.)
  - 'Groups': show all 12 groups as square cards. In mobile view, show two cards per row (six rows total). Each card displays the group letter, GD and PTS, and the four teams with their points and goal difference. Horizontal thin lines separate rows. Tapping a group card opens the group's match list and shows a back arrow to return to the groups overview.
  - 'Knockouts': shows all non-group-stage matches in kickoff order. It is a simple filtered list, not a separate knockout layout.

### 2.3 Bonus Tab (image_70bc6d.png Reference)
  In this tab there are three cards with the same width as match cards. The first is "Predict Winner" where users choose a team. The second is "Predict Top Scorer" where users choose a player. The third is a live Golden Boot leaderboard (top scorers). The app includes a `use-bonus` hook to fetch teams, players, saved picks, the tournament lock time, and the live scorer list, then persist picks to the `users` table through RPCs.
  The first two cards show status badges similar to match cards (Closes soon / Saved / Locked). The current client locks both bonus picks at the first kickoff; the database migrations still contain the late-window penalty path for a future second-chance flow, but the UI does not currently expose a Save(-1pts) mode. The Golden Boot list renders the full player leaderboard, sorted by goals and then player id.
  1. "Closes soon" - before the world cup starts, there should be a red warning if the user has not predicted them yet.
  2. "Saved" but can be edited - before the world cup starts, but after the user entered a valid prediction, the status is saved, and it is indicated with a green signal with a tick and saying "saved", same as on match cards.
  3. "Saved" and can not be edited anymore - after the world cup started (first matches kickoff time), if the user has already entered a valid prediction, the status is saved, and it is indicated with a grey signal with a tick and saying "saved", same as on match cards but in grey.
  4. Late-entry support exists only in the database migration layer today. The UI does not currently expose a second-chance edit flow after kickoff.
- **Predict Tournament Winner Element:** Dropdown search menu to pick an overall champion team before tournament starts. 
- **Predict Top Scorer Element:** Dropdown search menu to select a player who will score the most during the whole tournament.
  - **Live Golden Boot Race Card:** This card shows "Top Scorers" on the left and "goals" on the right, with a dynamically-sorted list of every player (place, flag, name, goals) fetched from `player_stats`.
  - Implementation note: `getFlag()` usage has been standardized to accept a single argument (prefer `team_flag` when available, else `abbreviation`) to avoid type mismatches across components.

### 2.4 Rankings Tab (image_70bc8c.png Reference)
- **Friend Leaderboard Structure:**  Ranked table rows showing: rank number, user display name, visual flag picker of their selected winner choice (displays a white flag `🏳️` if not selected), count of exact hits, and total points. on top there is a text saying "pool name + Leaderboard" in grey color (e.g. "Soccer Lads Leaderboard"), under it are the name of columns:#, user, pick, hits, pts. 
- If Points and Exact Scores of two users are identical, they share the same rank (e.g., both display as #3 and the next person drops to #5).
- **Viewing other users' profiles** when you click on a leaderboard row, you get a pop-up window, a bit smaller than the whole screen: it has 3 cards and a card-like button for closing it. The cards are exactly like in your profiles tab: Name with points and rank; Their winner and scorer picks; and stats. No management features, your pools, official rules, or logout button are shown here. The current user row is labeled `(You)` inline in the table.
- **Admin Invite Feature:** If the user viewing the leaderboard is the admin of the pool, they see a grey INVITE button at the bottom of the list. Clicking this opens a pop-up window showing a shareable invite link and a QR code. *Scanning the QR or clicking the link redirects to the app with the pool name pre-filled on the pools page and automatically joins the invited pool after login or signup.*
- **Visual Highlights:** Unique colored styling for ranks #1, #2, and #3, custom row background highlighting the active user row, and a gray badge style for zero-point users regardless of rank number. Pop-up has the same UI style and elements as the profile tab.

### 2.5 Profile Tab (image_70bcac.png Reference)
The Profile tab serves as the user's personal dashboard and management center. It consists of the following cards:
1. **Header Card:** A wide card showing the username, total points, and global rank. Clicking this takes the user to the Rankings tab.
2. **Picks Cards:** Two cards side-by-side showing the user's predicted Tournament Winner and Top Scorer. Clicking these takes the user to the Bonus tab.
3. **Statistics Card:** A wide card showing: All Hits, Exact, Misses, and Accuracy % (calculated as `(exact + hits) / (exact + hits + misses)`). The current implementation also computes and renders last-match deltas as compact up/down arrows per metric and subscribes to `users` realtime updates when the parent passes `currentUserId`, keeping the stats live after scoring runs.
4. **Pools Management Card:** A list of all pools the user belongs to.
   - Each row shows the pool name and an "Admin" badge if applicable.
   - A "Switch Pool →" button at the top allows users to return to the pool selection screen.
   - A "Leave" button on each row allows users to exit a pool. (Admin check applies: a lone admin cannot leave without promoting another or deleting the pool).
5. **Global Info Card:** A small highlighted card stating: "Your match predictions are global and apply to every pool you belong to — you only need to predict once." (This card ONLY appears if the user is part of more than one pool).
6. **Official Rules Card:** A detailed card listing the scoring system, deadlines, and point distribution.
  **The Rules card exact text:**
  - 3 points for predicting the exact score
  - 1 point for predicting the correct winner
  - 10 points for predicting the tournament winner
  - 10 points for predicting the top scorer
  - Match predictions lock exactly at kickoff
  - Scores update after matches

7. **Logout Button:** A prominent red button at the bottom to end the session.

### 2.6 Admin Page (Hidden Management Dashboard) - NOT YET IMPLEMENTED
- **Planned Access Route:** The overall admin has a unique username (Admin01) and will eventually see an "Admin" button in their Profile leading to a management page. 
- **Planned Admin Capabilities:** Manually edit match final scores, delete pools, kick out users from any pool.
- **Current Implementation Note:** The UI does not yet provide a full Admin dashboard component. There is no `Admin` button in the profile screen in the current codebase; admin-only flows remain to be added in a future release.

---

## 3. UI STYLE & DESIGN CONSTANTS
- Styling must stay cohesive, therefore use the global.css for coloursand elements. Do not change anything global.css unless i  tell you to, or my promt suggests it(e.g. change all green colours to red)

### 3.1 Color Palette & Constants
- **Primary Background:** oklch(0.13 0.01 260);
- **Accent Primary (Glow elements):**  oklch(0.72 0.19 155);
- **Card Fills / Secondary Backgrounds:** oklch(0.17 0.01 260);
- **Status Badges Text / Backgrounds:** 
  - *Closes Soon:* oklch(0.55 0.22 27);
  - *Saved / Success:* oklch(0.72 0.19 155);
  - *Coming Up:* oklch(0.769 0.188 70.08);

### 3.2 Typography & Font Settings
- use the fonts that are already in global.css , don't come up with new ones.

### 3.3 Shapes 
- **Card shapes:** every card should have the same style and look. Rounded rectangles with a thin border. 
- **Button shapes:** rectangles with very round edges, as they ar now.
  Status display badges have the same shape as buttons. 

---

## 4. POOL LOGIC & USER SESSION MANAGEMENT
Pools are created by users who want to play with a friend group. They give the pool a name (e.g. Soccer Lads) and receive an invite link and QR code to invite others. Other users join a pool by entering the pool name or clicking the invite link. Pool membership is modeled via a `user_pools` join table: a single global `users` can belong to many `pools`.

Important: predictions are tied to the global `users` identity (one prediction per user per match). This means a user who is a member of multiple pools will submit a single prediction for a given match and that prediction will count for every pool they belong to — preventing duplicate or conflicting votes across pools.

### 4.1 LocalStorage Key Structure & Session Management
- **Session Identification:** User logs in once and their session is persisted. The browser remembers them so they stay logged in across sessions.
- **Session Setup & RLS:** After successful authentication (login or signup), the `setCurrentUserSession(userId)` RPC is called. This function executes `set_current_user_id` SECURITY DEFINER RPC which stores the user ID in a Postgres session variable (`app.current_user_id`). This variable is required by RLS policies to determine row access. Without this setup step at auth time, subsequent HTTP requests would fail RLS checks.
- **LocalStorage keys:** The authenticated user is stored in `wc2026_user`, and the active pool is stored per-user under `wc2026_active_pool_id_<userId>` so pool selection survives refreshes.
- **App Guard / Routing Flow Logic:** 
  1. If no session: Force the Login/Sign-up screen.
  2. If session exists but no pool is selected: Force the Pools screen (Join/Create/Select).
  3. Once a pool is selected: Load the main Dashboard (Matches/Bonus/Rankings/Profile).
  4. Users can manually return to the Pools screen via the "Switch Pool" button in their Profile.

### 4.2 Room / Pool Joining Mechanics
- **Step-by-step verification logic:**
  1. User type Pool Name. If they open an invite link or scan an invite QR code, the pool name is automatically pre-filled in the input box and the app tries to auto-join that pool after login/signup.
  2. System checks if name exists in the database.
  3. System verifies that the user is not already in the pool.
  4. If clean, add user to pool and unlock dashboard visualization immediately.

### 4.3 Pool Leaving Mechanics
- **Step-by-step leaving flow:**
  1. User clicks "Leave" on a pool in the Profile tab.
  2. System confirms they are not the only admin (admins must promote another or delete pool).
  3. RPC `leave_pool` is called with SECURITY DEFINER to execute the delete as trusted function, bypassing RLS.
  4. User is removed from the pool immediately via optimistic UI update.
  5. If the user was viewing that pool, the app automatically switches to the next available pool or returns to pools screen.
  6. Toast confirms "Left pool 'XYZ'".

UX note for multi-pool users:
- Predictions are global across pools: if a user is a member of multiple pools they submit one global prediction per match and it counts for every pool they belong to. To avoid confusion, display a small informational card in the `Profile` tab (above the rules card) that states: "Your match predictions are global and apply to every pool you belong to — you only need to predict once." Also add a "Pools" card in the Profile where users can see their pools and a "Leave" button for each pool.

---

## 5. SUPABASE INTEGRATION & CONNECTIVITY
*Guidelines for the project's cloud database connection.*

### 5.1 Project Credentials
All sensitive connection keys are stored in a local `.env.local` file (not uploaded to GitHub).
- **SUPABASE_URL:** `https://qlnganxvaiuwsuohjwtp.supabase.co`
- **SUPABASE_ANON_KEY:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (Public anonymous key)

### 5.2 Connection Client
The application communicates with the database via the [lib/supabase.ts](lib/supabase.ts) utility, which exports a configured `supabase` client instance using the `@supabase/supabase-js` library.

### 5.3 Realtime Configuration
Realtime publishing is configured and used by the client. The app subscribes to `users` updates for leaderboard and profile refreshes, to `user_points_events` for per-user deltas, to `matches` and `standings` for live card/group updates, and to `predictions` inside the predictions modal so friends' picks refresh instantly while the modal stays open. The `player_stats` subscription keeps the Golden Boot leaderboard live. Confirm that your Supabase realtime publication includes `users`, `user_points_events`, `matches`, `standings`, `predictions`, and `player_stats` so the UI stays synchronized.

### 5.4 Automated Data Synchronization (API-Football)
To achieve the goal of "zero manual work," the system syncs with **API-Football** as the authoritative source of truth for tournament progress.
- **Sync Timing:** Updates are triggered automatically after every match completion (and periodically during live windows).
- **Authoritative Fields:** The API is responsible for updating the following:
    - `matches`: `home_score`, `away_score`, and `is_finished`.
    - `player_stats`: `goals` (incremented per player per match).
    - `standings`: Any data that cannot be purely computed (e.g., official tie-break results if they differ from local logic).
- **Computed Logic:** Match status is synced from the API `status` column and then interpreted by the UI for Coming up, Live, Finished, and Postponed states. Client time is still used only for countdown labels and day grouping.
- **Integrity Rule:** Data incoming from the API always takes precedence over local states to ensure all pools remain synchronized with the real-world tournament.

---

## 6. TIMING, SCHEDULING & DEADLINES
- Every match prediction can be changed until kickoff.
  The Bonus picks are currently locked in the client at the first kickoff, while the database still contains support for a later Group Stage Turn 1 cutoff in the migration layer.

### 6.1 Database Time Constraints
- **Timezone Standardization Rule:** Every game time must be stored and evaluated in strict UTC format.
- **Local Time Conversion Engine:** Browser converts database UTC date strings to the player's local device time zone for display purposes. The project includes an app-level time helper `getAppTime()` used in several places for deterministic/time-travel testing; remaining components should be migrated from `new Date()` to `getAppTime()` for full consistency.

### 6.2 Prediction Time-Lock Automation
- **The Deadline Rule:** Every match prediction closes at the start time of that match. Exactly. 
- **Database-Level Guard (Bulletproof Security):** Past deadline, the user can not click into the score box anymore, it freezes, the numbers turn grey and the box is no longer clickable or editable.

Database enforcement and timing details:

- **Data types:** All match times MUST be stored as `timestamptz` (UTC). Scores use integer types and flags use boolean types. Avoid text for times or numeric fields.
- **Match length constant:** Use a constant `MATCH_LENGTH_MINUTES = 105` (UTC) when calculating match end times and live windows.
- **Enforce deadlines at DB level:** UI-side guards are not enough. The codebase implements a PL/pgSQL trigger function `public.enforce_prediction_deadline()` plus a `save_prediction` RPC check that rejects `INSERT`/`UPDATE` on `public.predictions` when database time `now()` is at or past the match `kickoff_utc`.
- **Real-time closure:** When `now()` reaches `kickoff_utc` for a match, the DB trigger and RPC become authoritative — even if a client is out of sync.
  - **Current Implementation Note:** The codebase includes client-side time guards via `getAppTime()` and server-side deadline enforcement. On DB rejection the UI shows an error toast and rolls back optimistic changes.

**First turn of group-stage cutoff (precise rule):**
- Add a `group_turn` (integer) column to `matches` to denote the group-stage turn number when applicable (1 = first turn). The late-save cutoff for tournament-wide picks is the `kickoff_utc` of the latest match where `round = 'Group Stage'` and `group_turn = 1`. In other words: cutoff = MAX(kickoff_utc) WHERE round='Group Stage' AND group_turn=1. The current client does not expose that late-save window yet, but the database migration layer still supports it.

Note: applying DB-level enforcement requires the API server or stored procedures to use a controlled update path (not permitting arbitrary direct writes from clients), or to rely on DB RLS policies that check `now() < kickoff_utc` before allowing writes.

---

## 7. SCORING SYSTEM & LEADERBOARD MATHEMATICS
point evaluations based on predictions vs actual scores. After every match, points are calculated and added to users' profiles; the leaderboard updates immediately. (Leaderboards change only after matches or when a user accepts the -1 penalty for a post-deadline prediction.)

### 7.1 Point System Matrix
- **Exact Score Hit:** +3 Points (Predicted 2-1, Game ended 2-1)
- **Outcome Hit (Winner/Draw):** +1 Point (Predicted 1-0, Game ended 2-1; or Predicted 1-1, Game ended 0-0)
- **Tournament Winner Pick:** +10 Points (Correctly picked the overall champion before kickoff)
- **Top Scorer Pick:** +10 Points (Correctly picked the golden boot winner before kickoff)

- Current implementation note: the production scoring path is `public.process_match_conclusion(p_match_id bigint, p_source text DEFAULT 'API-Sync')` with the `trg_on_match_finalized` trigger on `public.matches`. It writes exact/outcome/miss ledger rows, refreshes `users.points_total`, `exact_hits`, `hits_total`, and `misses_total` from the ledger, and rebuilds group standings from finished group-stage matches.
- The earlier one-argument `process_match_scoring(match_id)` flow is legacy; the database now uses the ledger-first `process_match_conclusion` pipeline as the authoritative scoring engine.

### 7.2 Bonus Pick Lock & Late Penalty Support
- The current client locks both Bonus picks at the first kickoff and does not show a second-chance save flow.
- The database migration layer still contains late-window penalty support up to the latest Group Stage Turn 1 kickoff.
- If a late save flow is ever re-enabled in the UI, the penalty is -1 point and the corresponding late penalty flag is set when the pick is saved.

### 7.3 Leaderboard Ties & Sorting Logic
- **Primary Sort:** Total Points (`points_total` DESC)
- **Secondary Sort (Tie-breaker):** Number of Exact Score Hits (DESC)
- **Tertiary Sort:** Alphabetical Username (ASC)
- **UI Display:** If both Points and Exact Hits are identical, display the same rank number (e.g., two people at #3), skipping the next number (the next person is #5).

### 8.0 Required Supabase Tables (Database Schema)
This section lists the exact production tables as they exist in Supabase. All primary keys follow the `<table>_id` naming convention.

### 8.1 `users` Table (Global User Profiles)
- `user_id` (integer, Primary Key)
- `username` (text, globally unique)
- `pin` (text, 4-digit)
- `predicted_tournament_winner_id` (bigint, FK → `teams.team_id`, nullable)
- `predicted_top_scorer_id` (integer, FK → `player_stats.player_id`, nullable)
- `points_total` (integer, default 0)
- `exact_hits` (integer, default 0)
- `hits_total` (integer, default 0)
- `misses_total` (integer, default 0)
- `late_winner_penalty` (boolean, default FALSE)
- `late_scorer_penalty` (boolean, default FALSE)
- `created_at` (timestamptz, default now())

### 8.2 `pools` Table (Group Isolation)
- `pool_id` (integer, Primary Key)
- `pool_name` (text, unique)
- `invite_code` (text, unique)
- `created_at` (timestamptz, default now())

### 8.3 `user_pools` Table (Many-to-Many Membership)
- `user_pool_id` (integer, Primary Key)
- `user_id` (integer, FK → `users.user_id`)
- `pool_id` (integer, FK → `pools.pool_id`)
- `role` (text, default 'member')
- `is_admin` (boolean, default false)
- `joined_at` (timestamptz, default now())
- *Constraint:* `UNIQUE(user_id, pool_id)`

### 8.4 `teams` Table (World Cup Teams)
- `team_id` (bigint, Primary Key)
- `team_name` (text)
- `abbreviation` (text, unique)
- `team_flag` (text)
- `group` (text)

### 8.5 `matches` Table (Tournament Schedule)
*Note: Fields marked with (API) are automatically updated by the external data sync.*
- `match_id` (bigint, Primary Key)
- `api_fixture_id` (integer, nullable)
- `round` (text)
- `kickoff_utc` (timestamptz)
- `location` (text)
- `group_turn` (integer, nullable)
- `group` (text, nullable)
- `home_team` (text)
- `away_team` (text)
- `home_team_id` (bigint, FK → `teams.team_id`)
- `away_team_id` (bigint, FK → `teams.team_id`)
- `home_score` (integer, nullable, >= 0) (API)
- `away_score` (integer, nullable, >= 0) (API)
- `is_finished` (boolean, default FALSE) (API)
- `home_flag` (text)
- `away_flag` (text)
- `status` (text)

### 8.6 `predictions` Table (User Guesses)
- `prediction_id` (integer, Primary Key)
- `user_id` (integer, FK → `users.user_id`)
- `match_id` (bigint, FK → `matches.match_id`)
- `predicted_home_score` (integer, default 0, >= 0)
- `predicted_away_score` (integer, default 0, >= 0)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())
- `version` (integer, default 1)
- `late_penalty_applied` (boolean, default FALSE)
- *Constraint:* `UNIQUE(user_id, match_id)`

### 8.7 `player_stats` (Live Player Data)
- `player_id` (integer, Primary Key)
- `player_name` (text)
- `team_id` (bigint, FK → `teams.team_id`)
- `goals` (integer, default 0) (API Managed)
- `updated_at` (timestamptz, default now())

### 8.8 `standings` (Team Performance Scores)
- `standing_id` (integer, Primary Key)
- `team_id` (bigint, FK → `teams.team_id`, UNIQUE)
- `group` (text)
- `played` (integer, default 0)
- `wins` (integer, default 0)
- `draws` (integer, default 0)
- `losses` (integer, default 0)
- `points` (integer, default 0)
- `goal_difference` (integer, default 0)
- `updated_at` (timestamptz, default now())

### 8.9 `user_points_events` (Points Audit Ledger)
- `user_points_event_id` (integer, Primary Key)
- `user_id` (integer, FK → `users.user_id`)
- `match_id` (bigint, FK → `matches.match_id`, nullable)
- `event_type` (text)
- `points_delta` (integer)
- `reason` (text)
- `created_at` (timestamptz, default now())

### 8.10 `match_results_history` (Audit Log)
- `match_results_history_id` (integer, Primary Key)
- `match_id` (bigint, FK → `matches.match_id`)
- `home_score` (integer)
- `away_score` (integer)
- `recorded_at` (timestamptz, default now())
- `source` (text)
- `recorded_by` (text, nullable)

### 8.11 `pool_predictions_view` (Security-Filtered View)
- `match_id` (bigint)
- `pool_id` (integer)
- `user_id` (integer)
- `predictor_name` (text)
- `display_home_score` (text)
- `display_away_score` (text)
- `is_finished` (boolean)
- `points_delta` (integer)
- `points_total` (integer)
- `exact_hits` (integer)

---

## 9. RULES FOR VIBE CODING & COPILOT CONSTRAINTS
- Never change code I don't ask you to.
- English is not my first language, i might make grammar mistakes. 
- I am not a professional developer, i don't know the technical part of this project very well, i can see the structure and logic however. 
- If a promt i give copilot would require too much time and effort for it, please say it before taking action, then i can give you smaller instructions step by step. 
- This is a PWA website, it is phone-first, keep that in mind.

### 9.1 Prompt Engineering Workflows
- **Rule 1 (UI Preservation):** Always instruct Copilot to *only modify logic handlers, functions, and state bindings*. Never allow it to completely strip out or overwrite custom Tailwind styling, visual borders, or layout components from v0.
- **Rule 2 (Incremental Coding):** Work on one single file or one single feature tab implementation at a time. Never move to the next file until all TypeScript compile problems display an absolute count of 0.
- **Rule 3 (The Code Context Rule):** Before prompting Copilot to build out a data binding step, paste this master plan documentation context or reference this file to ensure structural alignment.

### 9.2 Recent Codebase Conventions
- `getAppTime()` is the preferred time source for deterministic behavior; migrating all remaining `new Date()` usages is a pending task.
- Authentication uses a custom `users` table with a numeric `user_id` and 4-digit `pin`; the UI now trims and case-normalizes usernames at register/login.
- Pool names are trimmed and matched case-insensitively when joining; ambiguous matches are rejected.
- Prediction deletion: clearing both inputs deletes the row; clearing one input persists `0` in DB while the UI shows `null` for emptiness.

---

## 10. OVERALL TECHNICAL CHECKLIST & PROGRESS
*Tracking the development progress and setup checkpoints.*

- [x] **Checkpoint 1: Database Schema Finalized.** All tables (`users`, `matches`, `predictions`, etc.) are created with the correct naming convention (`<table>_id`) and verified in Supabase.
- [x] **Checkpoint 2: Supabase Connectivity.** Environment variables configured in `.env.local` and `supabase-js` client initialized in `lib/supabase.ts`.
- [x] **Checkpoint 3: Realtime Enabled.** `supabase_realtime` publication created and tracking core tables for live UI updates.
- [x] **Checkpoint 4: Authentication Flow.** Implementation of the Login/Register/Pool joining logic (PWA-friendly) with 4-digit Passcode.
- [x] **Checkpoint 5: Match Prediction Logic.** Components for score input with deadline guards and color-coded status badges. (UI-level guards implemented; also now backed by DB trigger enforcement.)
- [x] **Checkpoint 6: Scoring & Leaderboards.** Automated point calculation logic is now live in the database via `public.process_match_conclusion` and the `trg_on_match_finalized` trigger. It updates the ledger, user aggregates, and group standings after finalized matches.
- [x] **Checkpoint 7: Pool-Filtered Predictions Modal.** Implemented logic to view friends' predictions for a specific match, filtered by the active pool, with visual point badges for finished matches.
- [x] **Checkpoint 8: PWA Setup.** Service workers, manifest, install metadata, and mobile app icons are configured for home screen installation.
- [x] **Schema & Connectivity:** Tables and `lib/supabase.ts` are present and used by the app.
- [x] **Matches UI & Logic:** `match-card` and `matches-tab` render cards, show flags and 3-letter abbreviations, support prediction save/delete flows through RPCs, show status badges, and implement scroll-to-today/next behavior. Deadline guards exist in UI and `onPredictionChange` checks kickoff times via `getAppTime()` in key places. Match and group cards subscribe to realtime `matches` and `standings` updates, and the predictions modal refetches on realtime `predictions` changes for the active match.
- [x] **Bonus Tab:** Implemented as `components/dashboard/bonus-tab.tsx` with `hooks/use-bonus.ts` providing data fetch, `saveWinner`/`saveScorer`, lock logic, and the live Golden Boot leaderboard.
- [x] **Profile Tab:** Picks (Winner/Scorer) display and are clickable; clicking navigates to Bonus via `onNavigateToBonus` wired from `app/page.tsx`.
- [x] **Abbreviations & Flags:** Match/team abbreviations are derived from `teams` table when available and displayed; flags use `lib/flags.getFlag()` or team `team_flag` fields. `getFlag` usage has been standardized to accept a single prioritized input (`team_flag` or `abbreviation`).
- [x] **Input UX Improvements:** Score inputs now select existing values on focus, support deletion (clearing both inputs deletes prediction), include mobile keyboard optimizations (`enterKeyHint`, blur on Enter), and debounce/flush saving logic.
- [x] **Date Separators & Group UI:** Added plain date separators between different days in the Matches list and added rank numbers (1–4) to teams on Group cards.
- [ ] **Full getAppTime() Migration:** `getAppTime()` is used in several components, but not yet universally. Remaining uses of `new Date()` should be migrated.
- [x] **Realtime Subscriptions:** Runtime subscriptions are implemented for Rankings, Profile stats, Matches, Standings, and the predictions modal. The app subscribes to `users`, `user_points_events`, `matches`, `standings`, `predictions`, and `player_stats` updates for live UI refreshes.
- [x] **DB-level deadline enforcement:** Implemented via `public.enforce_prediction_deadline()` trigger on `public.predictions`. This prevents late writes regardless of client behavior.
- [x] **Friend Predictions Visibility:** Implemented `MatchPredictionsModal` with pool-specific filtering and automated point-based badges (Green/Blue/Gray) for finished matches.
- [x] **History-backed overlays:** Match modal, Bonus dropdowns, Rankings invite/profile modals, and the Profile invite modal all use browser-history-backed dismissal so Back closes the open layer.
- [x] **Robust Deletion Logic:** Scores can now be cleared independently; clearing BOTH inputs triggers a database DELETE, while clearing one defaults safely to 0 to satisfy schema constraints while keeping the UI clean.
- [x] **Missing Data Fallbacks:** Added "No prediction submitted" indicators for finished matches with missing data, ensuring the app remains bulletproof against late joins or missed entries.
- [x] **Live/Finished Footer Line:** Match cards now show an inline footer on live and finished matches with the exact tap hint next to the prediction text, keeping the hint visible even when no prediction exists.
- [x] **Auth Sanitization & Robustness:** Login/register now trims and case-normalizes usernames; ambiguous matches are rejected with clear errors.
- [x] **Demo Removal:** The `MatchPredictionsModal` no longer injects demo rows; empty results show a centered CTA.
- [x] **Invite Link Auto-Fill & Sharing:** Invite link parsing (`?pool=`) now pre-fills the Pools screen and auto-joins the invited pool after login/signup. Admin "INVITE" button in Rankings tab generates shareable link and QR code via qrserver API.
- [x] **Pool Leaving with Admin Check:** `leave_pool` SECURITY DEFINER RPC prevents RLS issues on deletion. Admin check blocks leaving if user is the only admin and other members exist. Optimistic UI update immediately removes pool from list and switches to next available pool.
- [x] **Session Setup at Auth Entry Points:** `setCurrentUserSession(userId)` RPC is called at successful login/signup (in auth-screen.tsx) and after checkAuth() restores session from localStorage (in app/page.tsx). Sets Postgres session variable (`app.current_user_id`) for RLS policies to work correctly.
- [x] **Scoring Engine Deployment:** The database scoring engine is now deployed as a trigger-driven ledger-first pipeline, and the standings rebuild path is aligned with finished group-stage matches.
- [ ] **Admin Dashboard:** Not implemented. Special admin account (Admin01) with hidden dashboard for editing match scores, deleting pools, and kicking users remains to be added.

## 11. RECENT IMPLEMENTATION CHANGES (AUTO-UPDATE)

Last updated: 2026-06-05

This section records code changes made after the baseline plan above so the documentation matches the repository state.

- Added a centralized data caching provider: `context/tournament-data-context.tsx` (TournamentDataProvider).
  - Single source-of-truth for matches, predictions, userProfile, standings, teams, players, pools, rankings, activePoolId.
  - Hydrates on mount via parallelized fetches (`Promise.all`) and exposes `refreshData`, `updatePrediction`, `updateBonusPick`, and `setActivePool` helpers.
  - Consolidated Supabase realtime subscriptions into the provider to avoid per-component `supabase.from()` listeners.

- Wired multiple components to consume the provider instead of calling Supabase directly where possible:
  - `components/dashboard/matches-tab.tsx` now reads matches/standings/predictions from the provider (local UI layout preserved).
  - `hooks/use-bonus.ts` and `components/dashboard/bonus-tab.tsx` updated to use provider-backed data and fixed nullability issues.

- Restored exact committed UI for the following files to preserve visual fidelity (restores came from `git show HEAD`):
  - `components/dashboard/rankings-tab.tsx` (exact HEAD restored)
  - `components/dashboard/profile-tab.tsx` (exact HEAD restored)
  - `components/auth/pools-screen.tsx` (exact HEAD restored)
  These files were reconciled with the provider wiring in `app/page.tsx` so they compile while keeping identical markup and styles.

- TypeScript/DX fixes applied without altering UIs:
  - Tightened types and nullability across several files to reach zero TypeScript errors (strict mode).
  - Example fixes: `components/dashboard/bonus-tab.tsx` (nullable flags/ids guarded), `components/dashboard/bottom-nav.tsx` (typed `navItems` to `DashboardTab`).
  - Used cautious casts for external RPC results where necessary to avoid changing visual flows.

- Minor UI spacing tweak in `components/auth/pools-screen.tsx`:
  - Parent `space-y-4` → `space-y-2` and `TabsContent` top margin `mt-6` → `mt-2` to reduce the vertical gap between the "Your Pools" list and the Join/Create cards. This is a small non-functional visual spacing change requested by the owner.

- Realtime and optimistic update behavior:
  - The provider performs optimistic UI updates for predictions and bonus picks, then finalizes state based on RPC/Realtime confirmations.
  - Realtime channels now emit consolidated updates consumed by the provider and propagated to subscribers.

- Tests & diagnostics:
  - Ran TypeScript diagnostics after changes; current state: No TypeScript errors.
  - No automated unit/integration tests were added in this change set.

- Files added/updated (non-exhaustive list):
  - Added: `context/tournament-data-context.tsx`
  - Updated: `app/page.tsx`, `components/dashboard/matches-tab.tsx`, `components/dashboard/bonus-tab.tsx`, `components/dashboard/bottom-nav.tsx`, `hooks/use-bonus.ts`, `components/auth/pools-screen.tsx`, plus other small adapter edits to reconcile types.

Notes and next actions
- Several restored UI files still contain local Supabase queries by design to preserve exact UI behavior; these can be incrementally adapted to read from the provider without changing markup if desired. The provider already exposes the necessary methods and data shapes.
- Remaining larger refactor tasks (not yet done):
  - Full migration of all files to read exclusively from `TournamentDataProvider` (some pages intentionally left with original per-component queries to preserve exact visual/behavioural parity).
  - Complete migration to `getAppTime()` (see §6.1) across all remaining components.
  - Add automated tests for provider behavior and realtime event handling.

If you want, I can now:
- convert the restored `Rankings`/`Profile`/`Pools` pages to consume provider data under the hood while keeping identical markup (non-visual adapter changes only), or
- start a focused migration sprint to remove all remaining per-component `supabase.from()` calls and record the progress here.


### 10.1 Technical environment
- **Framework:** Next.js (React)
- **Database/Backend:** Supabase (Postgres)
- **Styling:** Tailwind CSS + OKLCH Colors
- **State Management:** React Hooks + Supabase Realtime
- **Deployment:** Vercel (planned)

---
*End of Master Plan*
