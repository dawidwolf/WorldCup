This file exists so the testing phase can go smoothly. 


---



**Checklist**
[ ] signup
[ ] login
[ ] create pool
[ ] join pool
[ ] save prediction
[ ] edit prediction
[ ] delete prediction
[ ] deadline lock
[ ] leaderboard update
[ ] live status
[ ] finished status
[ ] pool switching
[ ] mobile keyboard
[ ] PWA install
[ ] refresh persistence
[ ] logout




---




**ChatGPTs list of what can go wrong:**

1. AUTHENTICATION & SESSION FAILURES
Registration Issues
Duplicate username race condition
Username case sensitivity (David vs david)
Empty username bypass
Extremely long usernames breaking UI
SQL injection-like characters in usernames
Non-English characters causing issues
4-digit PIN validation bypass
PIN stored insecurely
User created but session not persisted
User created twice due to double-click
Login Issues
Wrong PIN accepted
Correct PIN rejected
Session expires unexpectedly
LocalStorage corruption
User logged into wrong account
Multiple tabs desyncing sessions
Login page infinite redirect loop
Browser refresh logs user out
Mobile Safari session persistence issues
Session Security
User manually editing LocalStorage
User impersonation by editing IDs
Session token not validated server-side
Old sessions remaining active forever
2. POOL SYSTEM FAILURES
Pool Creation
Duplicate pool names
Pool names with weird characters
Empty pool name
Extremely long pool names
Double-click creates duplicate pools
Invite code collision
Joining Pools
User joins same pool twice
User joins nonexistent pool
Pool join race condition
Pool join succeeds but UI doesn't refresh
User added in DB but not visible in leaderboard
Invite link opens wrong pool
QR code malformed
Pool name auto-fill broken
Pool Switching
Rankings still showing previous pool
Predictions modal showing wrong pool users
Cached pool_id mismatch
Realtime subscriptions not cleaned up
Switching pools quickly causes stale state
Pool switch while modal open breaks UI
Leaving Pools
Admin leaves last-admin pool
Orphaned pool with no admin
User removed but cached locally
Leaderboard still shows removed user
3. MATCH PREDICTION FAILURES
Prediction Input
Negative scores entered
Decimal scores entered
Huge numbers entered (999)
Empty input crashes UI
Clearing one box behaves incorrectly
Clearing both boxes fails to delete prediction
Prediction visually saved but DB failed
DB saved but UI failed
Mobile keyboard enters unexpected values
Input focus bugs on mobile
Rapid typing causing stale saves
Deadline Enforcement
User predicts after kickoff
Client clock manipulation bypass
Timezone mismatch
DB trigger not firing
Edge case exactly at kickoff second
Prediction editable after lock
Prediction locked too early
Live match still editable through API
Browser offline mode bypass attempts
Prediction Persistence
Prediction disappears after refresh
Duplicate prediction rows
Prediction tied to wrong match
Prediction tied to wrong user
Prediction tied to wrong pool
Simultaneous edits overwrite data incorrectly
4. MATCH STATUS LOGIC FAILURES
Coming Up State
Match marked Coming Up after kickoff
Wrong threshold for “today”
Local timezone shifts causing incorrect status
Closes Soon
Appears too early
Never appears
Appears on already saved matches
Appears on finished matches
Saved State
Saved badge shown without DB save
Saved badge disappears incorrectly
User cannot edit before kickoff
Live State
Match never becomes Live
Match stays Live forever
Live state begins too early
Live state begins too late
Match status inconsistent across devices
Finished State
Match finished but UI still Live
Final score missing
Match finished twice
Status mismatch with API data
Finished match still editable
5. API-FOOTBALL & DATA SYNC FAILURES

Related to API-Football

API Availability
API outage
API timeout
Rate limits exceeded
Invalid API key
Vercel env vars missing
Match Data
Wrong scores returned
Delayed score updates
Match marked finished too early
Match marked finished too late
Team names changed unexpectedly
Null values returned
API sends duplicate updates
Player Stats
Goals duplicated
Wrong scorer assigned
Golden Boot standings incorrect
Own goals counted incorrectly
Multiple players tied on goals
Sync Logic
Sync runs twice
Sync partially fails
Sync interrupted mid-update
DB left inconsistent
Old API data overwrites corrected data
Manual admin edits overwritten by API
6. SCORING ENGINE FAILURES
Exact Score Logic
Exact score not awarding 3 points
Wrong winner still awards 1 point
Draw logic incorrect
Penalty shootouts scored incorrectly
Duplicate Scoring
Trigger fires twice
Points awarded multiple times
Match rescored accidentally
Refresh duplicates points
User Totals
points_total mismatch
hits_total mismatch
exact_hits mismatch
Negative points bug
Miss counts incorrect
Bonus Picks
Winner bonus not awarded
Top scorer bonus not awarded
Bonus awarded twice
Late penalty not applied
Late penalty applied multiple times
Leaderboard
Wrong sort order
Tie-breaker broken
Rank numbers skipped incorrectly
Shared ranks displayed incorrectly
Current user highlight broken
7. REALTIME FAILURES

Using Supabase realtime

Subscription Issues
Duplicate subscriptions
Memory leaks
Stale listeners after navigation
Rankings not updating live
Profile stats not updating
Match scores not updating
Realtime disconnect not recovered
Race Conditions
Simultaneous writes conflict
Realtime event arrives before fetch completes
UI overwritten by stale event
User sees old data after update
8. MOBILE & PWA FAILURES
Mobile UI
Keyboard covers inputs
Modal too tall
Scroll jumps unexpectedly
Buttons unclickable
Safe area issues on iPhone
Android keyboard resize bugs
PWA
App installs incorrectly
Manifest broken
Service worker caching old JS
Users stuck on outdated version
Offline mode behaves incorrectly
Refresh reload loop
App icon missing
Splash screen broken
Browser Compatibility
Safari date parsing issues
Firefox differences
Chrome mobile rendering differences
iOS viewport scaling bugs
9. DATABASE FAILURES
Constraints
Missing FK constraints
Missing unique constraints
Orphan rows
Invalid references
Null values in required columns
Performance
Missing indexes
Slow leaderboard query
N+1 query issues
Full table scans
Data Integrity
Matches duplicated
Predictions duplicated
User points inconsistent
Broken standings calculations
10. SECURITY FAILURES

MOST IMPORTANT CATEGORY

RLS Failures
User can read all predictions
User can edit others predictions
User can edit scores
User can modify points_total
User bypasses pool restrictions
API Abuse
Direct REST calls bypass frontend
Prediction updates after deadline through API
Admin routes exposed publicly
Hidden admin page accessible
Input Abuse
XSS in usernames
Script injection
Massive payload spam
Rate limit missing
11. UI/UX FAILURES
Visual Bugs
Layout shifts
Cards overlap
Wrong colors
Missing flags
Abbreviations undefined
Broken animations
Navigation
Wrong tab active
Infinite loading spinner
Broken back navigation
Modal cannot close
Error Handling
Blank screen on fetch failure
Unhandled promise rejection
Silent DB failures
User not informed of save failure
12. TOURNAMENT EDGE CASES

VERY IMPORTANT

Match Edge Cases
Match postponed
Match canceled
Match abandoned
Match replayed
Match delayed for hours
Extra time confusion
Penalty shootout confusion
Team Edge Cases
Team name changes
Team disqualified
Group standings ties
Player Edge Cases
Multiple Golden Boot winners
Own goals
Player transferred incorrectly
Player duplicated in DB
13. ADMIN TOOL FAILURES
Admin Controls
Admin accidentally rescoring match
Admin edits not logged
Wrong match edited
Delete pool breaks references
Kicking user corrupts leaderboard
Admin Security
Admin page publicly accessible
Admin credentials exposed
Admin session persistence issues
14. DEPLOYMENT FAILURES

Using Vercel

Environment Variables
Missing Supabase URL
Missing anon key
Missing API key
Wrong production DB connected
Production Differences
Works locally but not deployed
HTTPS issues
CORS issues
Build succeeds but runtime fails
Node version mismatch
Deployment Process
Old deployment cached
Wrong branch deployed
Rollback impossible
Hotfix deployment breaks DB
15. TESTING CHECKLIST
Simulate Entire Tournament

Create fake matches:

future
live
finished
delayed

Test:

all statuses
prediction flow
scoring flow
leaderboard updates
realtime
mobile
pool switching
16. CRITICAL “DAY ONE” MONITORING

After real kickoff monitor:

DB logs
Supabase realtime health
API sync failures
Failed predictions
Duplicate points
Slow queries
Mobile bug reports
PWA update issues
17. MOST IMPORTANT THINGS TO VERIFY BEFORE KICKOFF

Priority order:

RLS security
Deadline enforcement
Scoring idempotency
Match status timing
Pool isolation
Mobile usability
PWA update behavior
Realtime stability
API failure recovery
Error handling



---


**ChatGPTs recomendation for AI testing**

Setup
1. Deploy your app

Deploy to:
Vercel

Even privately/password protected is fine.

2. Add error monitoring

Add:
Sentry

This is MASSIVE.

It records:

crashes
console errors
failed requests
stack traces
user sessions
replays

After kickoff this becomes your lifesaver.

3. Use Browser Use or Momentic

Tell it:

Test this football prediction app.

Things to test:
- signup/login
- create pool
- join pool
- switch pools
- save prediction
- edit prediction
- delete prediction
- refresh page
- mobile viewport
- deadline lock
- rankings update

Report:
- crashes
- console errors
- stuck loading
- incorrect states
- broken UI
- failed saves

This is exactly the type of task these agents are made for.

VERY IMPORTANT

AI browser agents are AMAZING at finding:

broken buttons
crashes
navigation bugs
UI issues
bad forms
missing states
console errors

BUT…

they are NOT great yet at detecting:

wrong scoring math
subtle DB logic issues
race conditions
realtime duplication
security flaws
timezone edge cases

So for your app specifically:
the most important remaining thing is still:

simulated tournament testing

because your app has lots of timing logic.

One More Extremely Valuable Thing

Open Chrome DevTools while testing.

Check:

Console tab
Network tab

A LOT of hidden bugs appear there before the UI visibly breaks.

AI agents often miss subtle warnings.

My Actual Recommendation For You

If I had your project:

Use:
Browser Use for AI autonomous testing
Sentry for real-world error monitoring
Vercel preview deployments for safe testing

ccs