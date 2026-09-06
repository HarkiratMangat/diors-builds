---
kind: record
status: live
---

# Session-start prompt — Dioreo

> ## ⚡ FIRST ACTION THIS SESSION — HARD GATE, before ANY other content in your opening message
> **Do not write task content, exploration, tool calls, or a greeting before this.** Your literal first lines of output this session MUST be: **(1)** a ready-to-paste `/rename` string in the format `Model<Ver>-<Effort> · <Title> · <Mon DD>` (e.g. `Opus5-H · Webhook alerts · Jul 20` — MG-EXAMPLE: this worked example is read into every session's context, so it must never count as a real rename string having already been given), and **(2)** a one-line best **model + single effort level** recommendation for this session's work — **picked from the grid in `reference_priority_tier_system`, not from a feeling about importance** (rows = premise risk, columns = deliberation load; effort buys breadth, the model buys judgement) — and on a large opening batch, a short "defer these to their own session" list (each with its own model+effort). This is a standing non-negotiable (`feedback_suggest_model_switch` memory) that **degraded repeatedly across sessions** (including on Opus 4.8-High — see `feedback_docs_at_push_time`'s compliance-drift note) because nothing structurally enforced it. The `UserPromptSubmit` hook re-injects this until it's done — **but as of 2026-08-20 12:58 EDT what stops it is a well-SHAPED derivation, not merely having said something.** A recommendation that names the cell before the axes ("Opus5-XHigh — Premise High × Delib High") does not match, so the nudge correctly keeps firing even though you complied; that happened in the very session that built the gate. **Still receiving it after your first response means the SHAPE is wrong, not necessarily that you skipped it — re-state it as `Premise <X> · Delib <Y> -> <Cell>` and it goes quiet.** ⚠️ **UPDATED 2026-08-11 21:14 EDT — the hook now CARRIES the grid, so there is nothing to open and nothing to remember.** `.claude/hooks/self-check.sh` injects both axis definitions, all twelve cells, the retired-cell floor, the escalation triggers, **both OFF-GRID moves (`Sonnet5-Max`, `Opus5-Low`) and the do-not-calibrate-on-his-history rule** — the last three were missing until 2026-08-20 12:16 EDT while the hook claimed no file read was needed, which made a session working from it alone unable to reach either off-grid cell. That changed because naming the grid in three separate auto-loaded places was not enough: the recommendation was still made from a remembered *shape* of the table, wrongly, twice in one session. **A pointer preserves the concept and drops the discriminating values.** ⚠️ Two of those values are the ones that were got wrong, so read them off the hook rather than from memory: **deliberation load is HOW MANY PLACES**, never how hard the thinking is or whose judgement it is; and **`Sonnet5-Low` is effectively retired**, so the practical floor is `Sonnet5-Medium`. ⚠️ **REBUILT 2026-08-20 12:16 EDT — it no longer fires every turn, and it now DOES verify.** State the pick in the shape **`Premise <Low|Med|High> · Delib <Low|Med|High|Very high> -> <Cell>`**; naming both axes makes the cell a lookup the hook checks against its own table, so a pre-emptive pick ("Opus5-XHigh, this is complex work") is caught instead of merely discouraged. Once a valid derivation is on record the hook goes QUIET — it drops the grid and replaces the first-action gate with an explicit *do not repeat it*, because firing an unconditional "if you have NOT yet…" every prompt is what made sessions re-emit the rename+model line over and over. It comes back exactly once after a `/compact` or a fork, which are the only cases Harkirat wants a fresh pick. Full spec below + in memory.

> ## 🔴 ACTIVE BRANCH — `feat/home-portal-conformance` · THE PORTAL CONFORMANCE PASS
>
> ⚠️ **THIS HEADER NAMED `feat/portal-redesign-session-b` UNTIL 2026-09-04 14:16 EDT, AND THIS SAME FILE RECORDS THAT BRANCH AS DELETED TWELVE LINES BELOW.** Found by the §L ⑥ document agent. A stale branch name in the ONE auto-loaded carrier is the worst place for one: a session checks it out, fails, and spends turns before doubting the file.
>
> 🔴 **ENDING THE SESSION, OR ABOUT TO COMPACT? RUN `npm run handoff`.** It checks the carriers — the tracked pointer chain, `.remember`'s size, whether the ledger / deferred list / changelog actually grew, and whether anything is uncommitted. ⚠️ **A pass means the CARRIERS are in order; it says nothing about whether what you wrote is RIGHT.** The procedure behind it is `docs/reference/session-handoff-guide.md`, but **you should not need to read 400 lines to hand off — run the command.**
>
> 🔴 **FIRST ACTION AS OF 2026-09-06 10:08 EDT — THE PORTAL BUILD-OUT IS MERGED (PR #185, v3.78.0-pre, `v3-pre-release` at `67fa4dff`), AND THE LINE BELOW IS HISTORY.** Do not dispatch from `local/handoff/2026-09-06-portal-build-out.md` (it carries a SUPERSEDED banner) and do not run a realm audit expecting the old floors. The first action is **with Harkirat, at the live site**: verify pins 15/20/33/35 — he signs in to `dev-portal.dioreo.app`, opens Season and looks at a draw row's tier chips (`b.t-legendary` / `t-mythic` / `t-epic` should be coloured), then Access and looks at the permission columns (each scope's underline and dot should carry its realm's hue; `manage` alone is neutral ink on purpose). The session checks in parallel, with the `CF_ACCESS_*` service token from `.env` and never printing it, that the live `app.css` md5 equals `portal/public/app.css`. If he sees them uncoloured, it is CODE — the ledger's row says the stale-build story is the only remaining explanation and it is unverifiable. Then walk him through `docs/db-deferred-list.md`'s items filed on 2026-09-06 and take his call on the four forks decided in his absence (ledger § Superseded 2026-09-06, the last four rows of the realm table). Handoff: `local/handoff/2026-09-06-build-out-shipped-handoff.md`.
>
> 🔴 **FIRST ACTION (2026-08-31, AMENDED 2026-09-01 — HISTORY as of 2026-09-06 10:08 EDT, kept for the record):** read **`docs/superpowers/plans/2026-08-31-post-compact-remediation.md`** — ten remediation tasks then the merge — and query **`docs/reference/portal-decision-ledger.md`** before re-deriving anything. 🔴 **AMENDED 2026-09-01 11:5x EDT.** That remediation plan's Task 1/4/2 are done and **Task 11 is THE MERGE — ✅ PR #177 MERGED 2026-09-01 12:54 EDT, verified with `gh pr view 177`, so this is history not a pending action** — so a session told to "do the remediation plan first" would execute a push-and-merge sequence that `§0.4` forbids it to even ask about. **If you were handed a realm prompt (`BROADCAST-PROMPT.md` and its successors), that prompt is your first action and this line is not.** Read the remediation plan for its Task 8 only — the four shared-surface selectors that moved — which the realm prompt now carries inline. A read-only reader test on 2026-09-01 found this conflict by trying to start Part 3 and being unable to choose; it is recorded rather than silently resolved because the next realm prompt will face it again.
>
> ⚠️ **BOTH ARE TRACKED, AND THAT IS THE POINT.** They used to be reachable only through `.remember`, which this repo's own handoff guide calls *"gitignored, rewritten wholesale each session, and demonstrably lossy."* **A read-only audit on 2026-08-31 found that if `.remember` were lost there was no path back to either document.** The chain now starts here, in a tracked file the SessionStart hook injects.
>
> 🔵 ~~**A REALM AUDIT IS NOT THE FIRST COMMAND ANY MORE.** Running one before the remediation plan skips all ten tasks.~~ 🔴 **RETIRED 2026-09-01 15:52 EDT — IT WAS TRUE FOR ABOUT A DAY AND THEN BECAME THE MOST DANGEROUS LINE IN THIS FILE.** `gh pr view 177` returns **MERGED**, so the remediation plan's Task 11 — the merge this block sent sessions toward — is done, and Task 8 closed the same day. ⚠️ **It also sat BELOW the amendment that contradicts it**, so a reader arriving in file order met the correction first and the absolute red line last, which is the order that decides what a session actually does. **If you were handed a realm prompt, that prompt's ORDER OF OPERATIONS block is your first action and everything in this paragraph is history.**
>
> **Then, for realm work:** `preview_start` → `repo-static` (:8900) + `portal-harness` (:8901) · `node -e "require('./scripts/buildPortal').build()"` · `npm run portal:status` · then `npm run portal:audit -- --realm <r> --triggers`. **Delete this whole block when the pass ends.** It exists because the one file guaranteed to reach every session did not name the work governing the branch — and three sessions running spent turns rediscovering rules already written down. `.remember` is gitignored, rewritten wholesale each session, and demonstrably lossy; it cannot be the only pointer to an authority.
>
> ## 📖 `MEMORY.md` LOADS IN FULL — check the sentinel, do not re-read the file
> 🔴 **THE MEMORY INDEX IS OVER THE PLATFORM'S LIMIT AGAIN, ON PURPOSE — 2026-09-02 21:03 EDT.** It is ~30.5KB against a loader that stops at 25,000B or 200 lines, whichever comes first, so **`CLAUDE.md` force-imports the whole file** to get it into your context anyway. ⚠️ **CHECK THE SENTINEL:** `MEMORY.md`'s penultimate line reads **`**MEMORY-INDEX-END**`** as visible text. See it and the index is complete; cannot see it and the import failed — `Read` the file and SAY SO. 🔴 **It was an HTML COMMENT until 2026-09-03 20:13 EDT, which made the test unpassable** — comments never survive into context, so it reported a failure on every session including the ones where the import worked. Do not put it back in a comment. 🔴 **`memory-index-check` WILL REPORT 'over budget' AND THAT IS EXPECTED — do not trim the index to silence it.** 79 entries were shortened earlier today and the shortening was REJECTED and reverted: a truncated index line reads as a complete one, and a session that reasons from the visible half never learns there was more. That is why those lines were long in the first place. The real fix is being designed — everything measured, every dead end, and the reconstruction record are in `docs/superpowers/plans/2026-09-02-context-loading-open-problems.md`.

> ## ⛔ NEVER DELETE A `.claude/worktrees/*` WITHOUT VERIFYING IT FIRST — **ONE is live as of 2026-09-01 17:31 EDT: `draw-calculator-breakdown-146641`**, and the count in this heading has now been wrong twice, which is the argument for the command below rather than for a number here
> 🔵 **TWO WERE RETIRED 2026-09-01 17:31 EDT, ON EVIDENCE, AND NEITHER IS LOST.** `outstanding-v3-items-135f3b` was **absorbed into #176** — every feature and records change on it matches `v3-pre-release` exactly, and #176 merged after its last commit. ⚠️ **`git cherry` reported all 8 of its commits as unmerged and that was wrong**: the work was squashed and patch-id cannot see through a squash. **Compare CONTENT, never the commit list.** `silent-mode-compliance` was the `feat/portal-redesign-session-b` lineage — 315 commits carrying seven unique files that existed on **no remote at all**. They are re-homed on `chore/silent-mode-guards-parked` (pushed, tests re-verified 30/30 · 14/14 · 9/9) and remain PARKED, registered in no settings file. 🔴 **AND BOTH BRANCHES WERE THEN DELETED TOO — 2026-09-01 17:33 EDT, Harkirat's call, because keeping an UNPUSHED branch "for history" is a fiction: neither was on origin, so neither was a backup, neither was visible to him on GitHub, and both would have died with this machine while feeling safe. Push-or-delete is the honest pair; doing neither is the worst of the three.** What made it safe, checked before and not after: all seven unique blobs were confirmed **byte-identical on `origin/chore/silent-mode-guards-parked`**, and the only other content either branch held was superseded — `outstanding-v3-items` carried the five pre-Preact split stylesheets (`board`/`manifest`/`preview`/`shell`/`track.css`) that #176 consolidated into `app.css`. Recovery is now the pushed branch plus the local reflog (`ddec4de` and `279e035`, recorded before deletion), not the branches themselves. 🔴 **The rule is unchanged, and this is why it is spelled out: verify before removing, and it is Harkirat's call — both of these were his, each after the evidence was in front of him.**
>
> **The remaining one is an ACTIVE PEER SESSION.** Harkirat, 2026-08-30 16:28 EDT: *"that's an active peer session. Uh, do not. I repeat. Do not delete that. That work is still in progress and will be merged later on."* 🔴 **`docs-audit` emits a `nested-worktree` WARNING for it on every run, and that warning's own text says "Remove it with `git worktree remove`."** The warning is EXPECTED and must never be actioned. This line is here because the protection previously lived only in `docs/db-deferred-list.md` — which a session tidying warnings would not open first. 🔴 **AND `outstanding-v3-items-135f3b` WAS NAMED IN NO TRACKED FILE AT ALL until 2026-08-30 23:2x EDT** — it appeared while this session ran, was named only in `.remember`, and a second read-only audit found that a session reading THIS file had no protection for it whatever. **Run `git worktree list` rather than trusting either name: the count is what matters, and it changes while you work.**
>
> **🔴 BEFORE TOUCHING A REALM, read `docs/superpowers/plans/2026-08-27-portal-conformance.md` — §0.1a⟷§0.6a (closure vs capture) · §0.1b (precedence) · §0.5a (how a Part is checked) · §0.5b (the five phases) · §0.5c (the handoff audit) · §0.6a (the overlay method) · §0.7a (the audit loop) · §0.10 (traps).** Not a paraphrase — the sections. One call returns them: `ctx_search(queries:["precedence which artifact is the design","how §0.1 and §0.6 compose closure capture","how a part is actually checked","traps already paid for"])`
>
> **Five things sessions have repeatedly got wrong, every one already written in there:**
> 1. **The diff is a FLOOR, not the definition of done.** A realm at 0.1% matches the mockup; that is not the same as good. His first three objections on 2026-08-28 were not conformance defects.
> 2. **The portal always moves; the mockup's DESIGN is never edited — but a PACKAGE DEFECT is corrected, in the commit that finds it.** ⚠️ **This line read "the MOCKUP IS NEVER EDITED" unqualified until 2026-09-04 20:02 EDT, while four commits in two days correctly edited it** — and being auto-loaded, that reading had the widest reach of anything in the carriers. A design WEAKNESS (something the design chose, and chose badly) is reproduced, filed in `docs/db-deferred-list.md`, and fixed after all six realms match. A package DEFECT (the design's own artifact failing to render the design's own intent — it contradicts its own prose, emits what it does not define, or renders a value it did not mean) is corrected. **The three tests and the three obligations a correction carries are in the plan's §0.1a; read them before editing the package.** When you cannot tell which it is, it is a weakness.
> 3. **Adjudication-by-judgement is RETIRED (§0.6), and a session reading §0.1 alone will try to restore it.** §0.6 closes; §0.1 captures.
> 4. **Date every source.** Two mockup packages exist; `2026-08-23-portal-interactive` supersedes `2026-08-20-portal`. A real citation from the retired one has produced five wrong conclusions.
> 5. 🔴 **RETIRED 2026-09-04 14:16 EDT — THIS ITEM FORBADE THE MANDATED INSTRUMENT.** It read *"`--portal harness` is a violation, not a convention… Nothing has been measured against the real server."* Both halves are now false and the second was the more dangerous: root `CLAUDE.md` says **"Diff against the HARNESS, never the live server: they load byte-identical fixtures, so the comparison is of DESIGN"**, and the real server has its own separate condition, §L ⑤ — **six realms walk `portal:realwalk` clean and Review passes its own `portal:reviewwalk` 37/37** (⚠️ **two instruments, named — `portal:realwalk --realm review` exits 1 BY DESIGN because Review has no views**; an earlier version of this sentence said "all seven realms walk clean" and conflated them, which is the name-the-instrument-beside-the-number rule broken by the session that was enforcing it, 2026-09-04 15:58 EDT), against a freshly restarted server. The original point survives in one clause: **a harness diff is a comparison of DESIGN and says nothing about production correctness**, which is why ⑤ exists beside it rather than instead of it. Found by the §L ⑥ document agent.
>
>
> 🔇 **THE MODE IS SILENT MODE, and it lives in `.claude/rules/silent-mode.md`** — no `paths:` frontmatter, so it loads unconditionally every session. It carries the working style AND the vocabulary (call · turn · run · prose-only turn · batch · mega-batch · checkpoint), each definition paired with the mistake it prevents. ⚠️ **No hook enforces it** — the guards are parked on `chore/silent-mode-guards-parked` until the 83-step workflow-compliance plan owns them, so that file is the whole mechanism. ⚠️ **CORRECTED 2026-09-04 14:16 EDT: this pointed at a `MEMORY.md` section moved out on 2026-09-02, and named `claude/silent-mode-compliance`, a branch this same file records as deleted.** Two dead pointers in one sentence, in the auto-loaded file. Found by the §L ⑥ document agent.
>
> **Cadence he has corrected repeatedly:** mega-batch — one turn carries the fix batch AND its measurement AND its verification · zero narration between tool calls, one structured summary at the end · `sequentialthinking` pre-emptively, to set method · decisions go in an `AskUserQuestion` popup, never prose · fix the CLASS, never the named instance · never write "done".

**This file is auto-loaded into every session by the `SessionStart` hook** in `.claude/settings.json` — it does not need pasting. `user_working_agreement.md` points here as the single source; it is NOT mirrored there, so edit this file directly.

**Moved to `docs/SESSION-START.md` (2026-07-18)** — this file, `CHANGELOG.md`, `CHANGELOG-SUMMARY.md`, `DEVLOG.md`, and the central notes scratchpad now live tracked in git under `docs/`, no longer gitignored/local-only (Harkirat's request, for real `git diff` history instead of manual snapshots). The hook path in `.claude/settings.json` was updated to match — if you ever see the "NOT FOUND" warning below, check that path first.

> **Hook health (2026-07-15):** the hook pointed at `/Applications/Diors-Builds/SESSION-START.md` for an unknown period after the repo moved to `/Applications/Claude Code/Diors-Builds`. `2>/dev/null` swallowed the error, so it silently injected an EMPTY string and none of the below loaded for any session. Now resolved via `$CLAUDE_PROJECT_DIR` and it prints a loud ⚠️ warning if the file is ever missing again instead of going quiet. If you ever see that warning in context, say so immediately.

The block below is pointers + only the recurring-miss items — the rest lives in the docs it tells Claude to read.

Shortcut: even *"New session on Dioreo — follow my standing start prompt (working agreement first; push/document/versioning/chapters/single-instance/model-rec non-negotiables apply)"* works; paste the full block after any session where something slipped.

---

```
New session on Dioreo. Before anything else:

1. Read ~/.claude/projects/-Applications-Claude-Code-Diors-Builds/memory/user_working_agreement.md
   in full (it links every other memory). CLAUDE.md (root) holds the invariants + a 🗺️
   navigation map; deep subsystem detail lives in path-scoped `.claude/rules/*.md` (loads
   ONLY when you touch matching code) and `docs/` — modularized 2026-07-22, follow the root
   nav map to find a topic. ⚠️ **Before FILING a new document, read the folder taxonomy** in
   that nav map (or `docs/README.md`): `reference/` = lookup docs you correct in place ·
   `ideas/` = forward-looking, you edit them · `superpowers/specs/` = dated snapshots you
   supersede, never edit · `archive/` = dead. Narrative goes in `DEVLOG.md`, not `reference/`;
   an open bug goes in `db-deferred-list.md`, never in `reference/`. Skim the changelog-system
   memory before touching any changelog or version number.
   Also read `docs/ideas/diors-notes.md` — my central scratchpad for thoughts/plans.
   It's raw intake, NOT source of truth (CLAUDE.md + the rules are); keep it tidy, and mark
   items [x] implemented / [-] abandoned per its own header. See the central-notes memory.
   ⚠️ Canonical Diors memory = the -Applications-Claude-Code-Diors-Builds path (the repo's
   CURRENT slug — read/write ONLY there). MIGRATED there 2026-07-28 01:41 EDT from the old
   -Applications-Diors-Builds slug, which is now a frozen backup with a _MIGRATED.md tombstone
   in it — never write to the old path. The old "fixed store is move-proof, don't migrate" rule
   is RETIRED: its bridge was a pointer note, i.e. instruction-following, which fails silently.
   The parked memory-architecture redesign's claim on this path was RELEASED by Harkirat for
   Diors specifically — the general defer-to-owning-project rule still stands.
   See project_memory_slug_migration + feedback_defer_to_owning_project.

2. NON-NEGOTIABLES — I've had to re-flag these before, so self-check them without
   waiting to be reminded:
   • Never push, merge, or deploy without asking me first — every time; approval never carries over.
     Branch commits are the one FREE exception (checkpoints, no version, never reach `main` alone
     under squash-merge) — don't ask for those.
   • **GLOSSARY (rewritten 2026-07-24 12:24 EDT for the Branch → Commit → Test → Push → PR → Merge → Deploy
     workflow; **Test** step added 2026-07-26 13:45 EDT — supersedes the 2026-07-18 "4 separable steps on `main`" wording; full design:
     `docs/superpowers/specs/2026-07-24-git-branch-pr-workflow-design.md`, canonical memory
     `project_git_workflow.md`):**
     - **Branch** = `git checkout -b feat/x` off `main` for a feature. Free, no approval.
     - **Commit** = `git commit` on the branch — a free checkpoint ("save progress"). No approval, no
       version. We never commit directly to `main` anymore (a rare direct-to-`main` hotfix commit is
       the one exception, still gated like a push).
     - **Test** = running the branch on the **local dev bot** (`node --watch --env-file=.env.dev index.js`)
       and exercising it live in Discord. Free, no approval — added 2026-07-26 13:45 EDT when `Dioreo (Dev)`
       was built. **This is now the default before asking to push/merge anything user-visible**, instead
       of shipping untested or asking Harkirat to eyeball prod. `--watch` auto-restarts on every save and
       branch switch. Setup + caveats: `docs/reference/deployment-and-ops.md`.
     - **Push** = `git push -u origin feat/x` (the BRANCH, not `main`). Uploads the branch to GitHub;
       the live bot is untouched. Asked.
     - **PR** = `gh pr create` — "done, or done pending review/testing." `--draft` ONLY when a real
       test/review gap exists, ready otherwise. Not an approval gate (solo repo, can't self-approve) —
       it's the review/staging surface + the version anchor. Free (an already-approved push just gets
       organized into a PR).
     - **Merge** = `gh pr merge --squash` + `package.json` version bump + `git tag -a vX.Y.Z <squash-sha>`.
       **This is where the version is minted** — asked, and the merge-yes IS the version-number-yes
       (state the proposed number in the same breath). MAJOR bumps (→ v3) always need a separate
       explicit ask. Each merged PR collapses to ONE commit on `main` = one version = one tag.
     - **Deploy** = making a merged commit go live on the VM: `./scripts/deploy.sh` (or the raw
       `gcloud compute ssh diors-builds-bot --zone=us-east1-b --command="cd ~/diors-builds && ./scripts/deploy.sh"`)
       → verify `scripts/vmstatus.sh` (gateway line green, restarts sane, DEPLOY block showing
       up-to-date, errors ~0 — but read the ERRORS block's `NOT LIVE` banner if present, since a zero
       there can mean "no source" rather than "no errors"; `🔌 Shard 0
       ready`/handleBotReady are the real "connected" proof, not just "process up") → confirm exactly
       ONE instance is running **on the PROD token** (the VM is it — stop any local run that uses prod's
       `.env`). ⚠️ Corrected 2026-07-26 13:45 EDT: this rule is **per-token**, not per-machine. The local
       dev bot (`Dioreo (Dev)`, its own application + token, run via `node --watch --env-file=.env.dev index.js`)
       does NOT conflict and does NOT need stopping — running it alongside prod is the intended setup.
       **Separate
       and optional per merge** — a merged version can sit undeployed indefinitely (docs-only being the
       obvious case); `main`'s version and the VM's running version (its boot alert reads `package.json`)
       can legitimately diverge. Asked.
     - **Document** = updating the written record: CLAUDE.md (invariants/nav) **or the matching
       `.claude/rules/*.md`** (subsystem detail) + `docs/ROADMAP.md` (if the roadmap changed) + relevant
       memory files + `docs/CHANGELOG.md` + `docs/CHANGELOG-SUMMARY.md` (+ a `docs/DEVLOG.md` narrative
       entry for a notable arc) + this central notes file (mark resolved items). Docs now ride IN the
       PR's diff (drafted on the branch as the change happens, finalized — real number + squash hash +
       tag — at merge), reviewed alongside the code rather than a separate "at push time" ritual.
       Whichever of these are actually relevant to what changed — not a fixed checklist to run through
       blindly.
     - **Say plainly which steps actually happened** ("merged v2.x, deploy held") — never let "merged"
       imply "live," the same discipline the old wording asked for around "pushed."
     - "Document" specifically is NOT only triggered by a merge — a planning/roadmap session with NO
       code and NO branch still needs it if the roadmap or a standing rule changed: sync `docs/ROADMAP.md`
       AND both changelog roadmap sections (sourced from it, must not drift) AND a DEVLOG entry. The
       changelog is the one step that keeps getting skipped — don't skip it.
     See [[reference_vm_bot_commands]], [[project_deployment_migration_render_to_gcp]],
     [[project_git_workflow]], [[feedback_docs_at_push_time]]. Bot
     alerts a Discord channel on each (re)start + on errors.
   • Versioning is 3-part vMAJOR.MODERATE.MINOR, **minted at MERGE, not push** (changed 2026-07-24 12:24 EDT): a
     significant merged PR bumps MODERATE (resets MINOR to 0), a small one bumps MINOR; NEVER bump
     MAJOR (→ v3) without asking me. ONE version number per merged PR, not per commit or per push — a
     PR of N checkpoint commits still gets one number via the squash. An open branch/PR IS the new
     "Unreleased" (proposed number sits in the changelog's Unreleased section, graduates to a real
     numbered entry + tag at squash-merge); unreleased branch commits carry no version, referenced
     informally as "based on `<last merged version>`, at commit `<sha>`."
     **Git-tag the squash commit on every merge** — `git tag -a v2.18.1 <squash-sha> -m "..."`, then
     push the tag. **This works only because the changelog entry + `package.json` bump are finalized on
     the branch as the final pre-merge checkpoint** (adopted 2026-07-27 21:27 EDT), so the squash commit
     already reads the tagged version. The entry cites `(#PR)` with **no hash**; the hash is backfilled
     one release later, on the next release's branch — additively, never by `--amend` or force-push. The
     newest entry lacking a hash is correct, not drift. *(v2.33.0–v2.35.15 predate this: 16 of the 25
     were tagged on a separate `chore(release)` commit, now retired — don't re-tag those. Six others
     (v2.33.3, v2.33.4, v2.35.0–v2.35.3) have a genuinely stale `package.json` at the tag; tracked, not
     fixed. Details: `docs/reference/deployment-and-ops.md` § Version tagging.)* `git describe --tags` on any later commit shows exactly how many commits deep past
     the last merged version you are, for free. **When backfilling a historical tag, cross-check
     CHANGELOG.md directly — don't trust commit messages alone**: a first pass once missed `v2.18.1`
     entirely because none of its 3 bundled commits (`f7b4575`/`c4b1c19`/`1600b8e`) mention "v2.18.1" in
     their own message; only CHANGELOG.md's actual entry names which commits it covers. **The FULL tag
     backfill (pre-workflow-overhaul history) is DONE (2026-07-21): every version `v1.0.0`→`v2.30.2` is
     tagged, 58 tags, zero gaps** (the earlier "no clean 1:1 mapping" concern was a false premise —
     almost every CHANGELOG entry cites its own commit hash). See the "Version tagging" reference in
     `docs/reference/deployment-and-ops.md`.
   • Mark chat chapters FINELY — one per distinct TOPIC (a question answered, a problem
     debugged, a small task done), NOT per broad phase; even one-edit tasks get one, and
     so do answers with no tool calls. Often ~1 per turn that raises something new.
     THE COUNT IS NEVER A TARGET OR A LIMIT — it just follows however many distinct topics
     the session actually has: 12, 30, 50+, no ceiling. Only ever ask "is this a distinct
     subject?", never "have I marked too many?" — when unsure, MARK IT: over-marking costs
     me one click to unpin, under-marking costs me re-reading a whole session to find and
     add what's missing. Err high; the errors aren't symmetric. This overrides the built-in "use sparingly
     / 3-8 per session" default — that kind of range is exactly what hardened into a cap
     before (I re-pinned 12 by hand in a session Claude marked 2). Mark as you START a
     subject. The hook only nudges; marking is on you, and you can't read them back.
   • Proactively recommend ONE model + ONE effort level (never a range). **HOW to pick: the
     premise-risk × deliberation-load grid in `reference_priority_tier_system` — every cell names
     exactly one combo. Effort buys BREADTH; the model buys JUDGEMENT/self-correction. If torn, take
     the LOWER cell and say why in one clause.** ⚠️ Over-spec is the standing bias here: under-speccing
     fails visibly in front of you, over-speccing fails invisibly and Harkirat pays — so the tell is
     writing "small/specified/mechanical" and then reaching upward in the next sentence. On a big session-
     opening batch: recommend the single best setup for the session as a whole, then list any
     tasks to DEFER to their own session, each with its own model+effort (that's my
     work-weight estimate). Hand me a ready-to-paste rename string, formatted
     `/rename [HOLD/MonDD] Opus5-M · Title · Mon DD` (updated 2026-07-17): optional
     `[HOLD/MonDD]` leading flag ONLY when the project's on hold (compact hold-date, e.g.
     `[HOLD/Jul17]`), then Model<Version>-<Effort> (no space before the version, effort
     abbreviated L/M/H/X/Max), then " · " title, then " · Mon DD" = the SESSION START date
     (spaced, e.g. `· Jul 16`). Why: the desktop model picker is GLOBAL/live, not per-session,
     so after I use another model elsewhere it shows the wrong one when I come back — the
     session title is the only per-session record of what this session should run. Full spec
     in the working agreement's model-switch memory.
   • When work should move to a NEW session (deferred tasks, a contingency effort/model bump —
     new session, NEVER mid-session — end-of-session continuation, or long/near-compaction
     context), proactively hand me a TIGHT, pasteable handoff prompt (+ the /rename string) so it
     starts aligned with no re-derivation or wasted tokens. See feedback_session_handoff_prompts.
   • If the bot behaves erratically or inconsistently, suspect MULTIPLE RUNNING INSTANCES
     **ON THE SAME TOKEN** first (`ps aux | grep index.js`) before any code/cache theory. The
     separate-token dev bot is not a collision (Render/Railway are both retired).

3. Work style: be token-conscious (batch calls, don't re-read what's already in context);
   check sibling code before guessing from prose/screenshots; verify a fix actually works
   (real repro or a trace point, not just "looks right"); test the naive alternative before
   a big rebuild.

4. Infra facts: ⚠️ **NOT "user-installed only" any more — corrected 2026-08-31.** `CLAUDE.md`'s hard-invariant section retired that half at v3: every public-facing command now registers `setIntegrationTypes([0, 1])`, so the app is guild-installable. **What still holds, and is the load-bearing half: the bot has ZERO standing guild permissions.** Read CLAUDE.md rather than this line. The bot — only ONE instance may run **per bot token** (corrected
   2026-07-26 13:45 EDT; there is now a **local dev bot** on its own token — see
   `project_local_dev_bot` + `docs/reference/deployment-and-ops.md` — which runs alongside prod by
   design). HOST = GCP VM `diors-builds-bot` (us-east1-b, project gen-lang-client-0549308254) under
   systemd (unit `diors-bot`, auto-restart on crash + reboot). Deploy = git push + `git pull &&
   systemctl restart` on the VM. Render RETIRED/suspended (delete ~2026-07-24). Secrets
   (BOT_TOKEN / MONGODB_URI / CLOUDINARY_URL / LOG_WEBHOOK_URL) live in `.env` (local + on the VM).
   `scripts/vmstatus.sh` = health, `scripts/vmpeaks.sh` = CPU peaks. See [[reference_vm_bot_commands]].

If anything here conflicts with what you find in the docs, flag it — don't silently pick one.
```
