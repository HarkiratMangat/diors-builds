---
kind: plan
status: frozen
scope: The portal BUILD-OUT — every pin, the design queue, the impeccable findings, and the fifteen refine/enhance/fix lenses, applied on top of the conformed base. Supersedes the stand-down rule; the resting-frame floors in the ledger are historical from this plan on.
---

# PLAN — the portal build-out, 2026-09-06 00:54 EDT

> ✅ **BUILT AND MERGED 2026-09-06 10:08 EDT — PR #185, v3.78.0-pre, `v3-pre-release` at `67fa4dff`.** Every unit in §1 ran (A by the orchestrator, B–E as subagents), every lens in §2 landed where §2 says, the five reviews in §3 step 6 were folded, and the consolidation ran to sixteen thoughts. What changed against this plan while building: the tray hides on Home as well as Season; `.dw-f .why` is ink at rest and warn when it blocks; the draw-window kind is gone rather than hidden; the four forks in the handoff's §8.5 were decided rather than popped (Harkirat asleep, 01:28 EDT). Records: `docs/CHANGELOG.md` v3.78.0-pre · `docs/reference/portal-decision-ledger.md` § Superseded 2026-09-06 · `DESIGN.md` § Known divergences. This file is frozen from here.

*Harkirat, 2026-09-06 00:43 EDT: "finish the portal… I don't care about the plan's prior conventions/rules, the conformance is more or less done, it just needs correcting… consider the pending redesign items, the pins, the impeccable findings, fix them, any bugs, gaps, improvements… awwwards worthy." And 00:52: "write up a solid plan for yourself… utilize tightly scoped subagents… in parallel when it makes sense."*

## 0 · Decisions taken tonight, so nothing below re-litigates them

| # | Decided | By |
|---|---|---|
| D1 | Creation forms are **modal drawers** on every realm (pins 10/17/36). Reverses the 2026-08-31 class-(b) "Portal keeps the inline panels" row | Harkirat, 2026-09-05 popup |
| D2 | **Draw window is not a creation kind.** The draw form gets an optional end date; when set, one composer entry stages a `draw.add` AND a `calendar.add` (category Draw) for the same title | Harkirat, 2026-09-06 00:50 EDT |
| D3 | **Identity chip shows username + avatar.** `PortalSession` gains `username`, `globalName`, `avatarHash`; PRIVACY.md §2.1c's portal-session row is amended (it enumerates the fields, so adding two makes the row false without the edit — the amendment is one table cell, not a section) | Harkirat, same popup — his question answered in §5 |
| D4 | **Distinct hue per realm.** Realm accents stop aliasing state colours. Review's accent is INK — it is the one realm with no topic, because it is every topic. **Home gets no hue either** (it has no accent token today and is the arrival surface, not a territory); it stays neutral | Harkirat, same popup; Home/Review neutrality is mine |
| D5 | **Armory: collapse the rack by category; Compare gets a weapon search and lists every build of that weapon** | "fully unleashed" |
| D6 | **`layout` and `typeset` released** — the type scale and a spacing scale go in now, seven realms at once | Harkirat, 00:22 popup |
| D7 | The impeccable design hook is wired and filed | 00:22 popup |

## 1 · Work units and who owns which file

**Ownership is exclusive.** Two writers on one file is a race, so every file below has exactly one owner. CSS is mine; a subagent that needs a rule writes it to `local/css-out/<unit>.css` and I splice it.

| Unit | Owner | Files | Delivers |
|---|---|---|---|
| **A · Design system** | me | `tokens.css`, `app.css`, `manifest.js`, and the records listed under "Shared files nobody edits until the end" (same set, written at step 5) | Type scale (D6) · spacing scale + breathing room (pin 14) · realm hues (D4) · motion tokens + page-load orchestration · drawer form vocabulary · manifest delete control (pin 22) · record-row spine centring (pin 9) · staged strip and rec-cta restyle (pins 6/8) · every `local/css-out/*.css` spliced |
| **B · Season** | subagent | `composer.js`, `composer.logic.js`, `season.js`, `season.logic.js`, `track.js`, `portal/api/dates.js` (+1 route), `scripts/seasonOps.test.js`, `scripts/composer*.test.js` | Composer in a `Drawer` (D1) · draw: items shorthand + thumbnail URL + optional end date → second op (D2, pin 11) · patch note: description + title override + image URLs (pin 13) · event: Double CP · `drawwindow` kind removed · "+ Publish" → "+ New patch note" (pin 8 copy) and the masthead's patch-note ADD chip is dropped — the record panel's CTA is the one entry point, because it sits beside the list it adds to (pin 13's "what is the point of two buttons") · "Open a day…" moves into the Track toolbar as "Today" (pin 7) · StagedPanel becomes a one-line strip under the view bar (pin 6) |
| **C · Armory** | subagent | `armory.js`, `armory.logic.js`, `scripts/armory*.test.js` | `AddBuildForm` + `BuildEditor` in a wide `Drawer` with the Discord preview as its right column (D1, pin 17) · rack grouped by category, collapsed by default with count + top build (D5, pin 21) · Compare: weapon search, all builds of that weapon side by side (D5, pin 18) |
| **D · Access + identity** | subagent | `access.js`, `portal/api/access.js`, `portal/auth.js`, `models/PortalSession.js`, `shell.js`, `docs/legal/PRIVACY.md`, `scripts/portalSession*.test.js` | `GrantForm` in a `Drawer` opened by `+ Grant access` (pin 36) · `GET /api/discord/user?id=` via the bot token, with a preview card in the drawer (pin 32) · username/avatar stored at login, `/auth/csrf` carries them, the chip renders them (D3, pin 5) · `data-realm` on `.app` so CSS can key on the realm |
| **E · Analytics + Home** | subagent | `analytics.js`, `home.js`, `scripts/analytics*.test.js`, `scripts/home*.test.js` | Health view leads with the four KPI tiles and "Where the milliseconds go" as the mockup's does (pin 37) · Home's fourth masthead figure (days left) · Home empty states with direction |

**Shared files nobody edits until the end:** `scripts/portalStates.mjs` (each unit REPORTS its changed states; I update it once) · `portal/fixtures/*.json` geometry (re-recorded last, immediately before the commit) · `docs/reference/portal-decision-ledger.md` (I add one "superseded 2026-09-06" section) · `docs/CHANGELOG.md`, `package.json` (me, pre-merge).

## 2 · The fifteen lenses, and where each one lands

`polish` alignment and micro-detail, every unit · `bolder` the realm hue glow behind each masthead, A · `quieter` fewer `side-tab` borders where the design used them as decoration, A · `distill` the staged callout to a strip, B; the always-open grant row deleted, D · `harden` every drawer disables its primary until the reason is empty, and says the reason · `onboard` empty states name the next action, E and B · `animate` masthead figures rise on load, drawers scale in, staged strip pulses once, A · `colorize` D4 · `typeset` D6 · `layout` spacing scale, A · `delight` the toast after a stage says "Review →" and works · `overdrive` deliberately NOT — an operator console does not want shaders · `clarify` Publish → New patch note, Open a day → Today, "live now" → "announcements live" on Home · `adapt` 375 stays out of scope by his 2026-08-27 decision; 1024 must not scroll sideways · `optimize` no new network requests on load except the avatar

## 3 · Order

1. Plan committed (this file) → four subagents dispatched in ONE message → A runs concurrently.
2. Each subagent: build passes (`node -e "require('./scripts/buildPortal').build()"`), its own tests green, `npm run portal:template-comments` clean, report = files changed · states changed · CSS handed over · anything it could not do.
3. I splice CSS, update `portalStates.mjs`, run `npm test`, fix what the walk finds.
4. Rebuild, restart `app.dioreo.dev-portal`, verify the LIVE site with the service token (pins 15/20/33/35 were reported on a stale build).
5. Records: ledger superseded section · CHANGELOG `v3.78.0-pre` · `package.json` · DESIGN.md's Known divergences and the four-alias paragraph resolved.
6. The end-of-work critique he scheduled: five review subagents (impeccable critique/audit, design:accessibility-review, design:design-critique, design:ux-copy), then the 15+ thought consolidation. **Not before step 5.**

## 4 · Boundaries

⛔ No push, no PR, no merge, no tag — approval restated at the moment of the action. ⛔ A subagent never commits, never touches a file outside its row, never edits `app.css`/`tokens.css`/`portalStates.mjs`/`portal/fixtures/*.json`, and never runs `npm test` (it is slow and the states walk flakes ~50%; a unit runs its OWN `scripts/<x>.test.js`). ⛔ Never write `☑`.

## 5 · His question on D3, answered

*"Why would this need a PRIVACY.md amendment? The portal is a sub-domain."* — Because §2.1c already describes the portal, at his own request on the v3 line: its **Portal session** row lists exactly what the record holds ("a hashed session id, your Discord user ID, when you signed in, when you were last active, and a short device/browser string"). Storing a username and avatar hash makes that sentence false. The amendment is that one cell plus the 1.13 change-history line; nothing about scope, cookies or recipients changes.

## Audit log

*The falsification pass `plan-drafting.md` requires — where is this plan WRONG?*

| # | Where it would have been wrong | Fix |
|---|---|---|
| 1 | **It would have re-fixed pins 15/20/33/35 in code.** The live `/api/access/matrix` route ALREADY emits `realm` per scope (`portal/api/access.js:60-61`) and `accentOf()` colours from it; the plan's 2026-09-05 line "returns no colour keys" read the harness stub's comment, not the route. The likelier cause is that `dev-portal.dioreo.app` was serving a build older than #183 | Step 4 rebuilds and restarts the agent BEFORE anyone touches colour code, then re-verifies live |
| 2 | **It would have let four subagents edit `app.css`.** Concurrent appends to one file lose whichever write lands second, silently | CSS ownership is exclusive; subagents hand rules over as files |
| 3 | **It would have called the Analytics `.dt2` gap a defect** — the detector counted hidden DOM; the mockup's inactive views are `display:none`, the portal unmounts them | Pin 37 is scoped to the Health view's LEADING content, which measurably differs (mockup leads with tiles + milliseconds; portal with alerts) |
| 4 | **A draw's "end date" has nowhere to go** — `newDraws[].date` is the only date field. Storing it on the draw would need a schema change nobody asked for | D2 stages a calendar draw-window op beside the draw op; the Track already draws that lane from calendar rows |
| 5 | **It treated PRIVACY.md as a veto.** It is his document and §2.1c is one table cell | §5 states the cost; the edit is in unit D |
