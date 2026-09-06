#!/usr/bin/env node
/**
 * docs-audit.mjs — the documentation invariants, as a program instead of prose.
 *
 * WHY THIS EXISTS (2026-07-28 19:30 EDT, Harkirat's ask)
 * ------------------------------------------------------
 * The records kept going stale in a specific, repeating shape, and every previous fix was another Claude Code hook. Hooks have three limits that guarantee the next gap:
 *   1. They only fire inside a Claude session, on this Mac. A PR opened by anyone (or anything) else is unchecked. So is a session where the hook silently errored.
 *   2. Each rule was ~1.4KB of backslash-escaped bash inlined into settings.json — unreadable, untestable, and impossible to run by hand to ask "is the tree clean right now?".
 *   3. They fire at ONE moment. The DEVLOG failure (machine-checked records 22/22, attention- dependent ones 8/22) and the notes-file gap are the same bug: a check that runs at the moment of DISCOVERY (session start) and never at the moment of CLOSURE.
 *
 * So the derivable invariants live here, and the hooks + CI both call this. One implementation.
 *
 * THE THREE FAILURE SHAPES THIS AUDIT COVERS
 *   Shape B — conservation: an item leaves an active list ONLY by appearing in an archive. A shrink
 *             with no matching grow is either an unswept item or a DELETED one. (`notes-sweep`,
 *             `deferred-sweep`, `archive-conservation`)
 *   Shape C — filesystem truth: the doc map and every cross-reference are checkable against `ls`.
 *             (`readme-map`, `xref`)
 *   Plus the release chain that hooks already watch at merge, re-checked here so it also holds for
 *   PRs opened outside a Claude session. (`summary-coverage`, `hash-chain`, `devlog-toc`,
 *   `devlog-version-cite`, `tag-integrity`)
 *
 * WHAT THIS CANNOT DO — read this before trusting a green run
 * ------------------------------------------------------------
 * This is a WHITELIST of failure modes that have already happened. It cannot detect a category nobody has hit yet, cannot judge whether a doc is any GOOD, and cannot verify a judgement call. A pass means "no known failure mode tripped" — never "the records are correct". Every run prints that.
 *
 * Specifically outside its reach:
 *   - Whether a doc's CONTENT is accurate. `version-sync` proves the number matches; nothing proves the entry describes what actually shipped.
 *   - Whether a session RECORDED what it learned. The memory store's shape is checked (`memory-index`, `memory-xref`, `memory-slug`); "did you write down the rule you just established" is a fact about a session, and lives in `.claude/hooks/records-close-check.sh` at `gh pr create`.
 *   - Anything on a path that bypasses both gates: a PR opened in the GitHub web UI runs CI (so the tree checks hold) but fires NO local hook, so the notes/memory closure check never happens.
 *
 * The failure mode to fear is a partial check that FEELS total — that is exactly how DEVLOG coverage sat at 8/22 while the changelog hook passed every single time.
 *
 * SEVERITY CONTRACT
 *   ERROR — an invariant that is never legitimately violated. Fails CI. Blocks the merge.
 *   WARN  — a judgment call worth surfacing. Reported, never blocking, so a hotfix is never held up
 *           by prose. If you find yourself wanting to demote an ERROR to shut it up, the honest move
 *           is to fix the record or add an explicit, commented exemption below.
 *
 * USAGE
 *   node scripts/docs-audit.mjs                 # all tree checks
 *   node scripts/docs-audit.mjs --only xref     # one check (hooks use this)
 *   node scripts/docs-audit.mjs --diff main     # + the conservation check against a base ref
 *   node scripts/docs-audit.mjs --json          # machine-readable
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Static, NOT a dynamic import inside the check. The runner calls `c.run()` SYNCHRONOUSLY (`out = c.run() || []`), so an async check body returns an unawaited Promise and the check verifies NOTHING while reporting a clean pass — the vacuous-pass failure this file warns about, caught here on its first run by reading the ledger instead of the verdict.
import { reflow } from "./reflow-prose.mjs";

// DOCS_AUDIT_ROOT exists so scripts/docs-audit.test.mjs can point the whole audit at a fixture tree and PROVE each check fires. That matters more than usual here: this repo has already shipped a guard that was silently dead (every Bash rule in usage-guard.mjs stopped matching at line 2 because "\n" wasn't treated as a command separator) and it passed review because it was only ever tested on input that couldn't fail. A check nobody has watched fail is not a check.
const REPO = process.env.DOCS_AUDIT_ROOT
  ? resolve(process.env.DOCS_AUDIT_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), "..");

const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
};
const read = (rel) => {
  const p = join(REPO, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
};
const tracked = () => git("ls-files").split("\n").filter(Boolean);

// A shallow clone (the default for actions/checkout@v4) has no tags and almost no history. Measured 2026-07-28 20:20 EDT against `git clone --depth 1` of this repo: 42 spurious hash-chain "does not resolve" errors, and exactly 1 tag visible instead of 100+. Both directions are dangerous — one fails CI on correct docs, the other passes silently on broken ones. So the git-dependent checks DOWNGRADE to a warning that names the limitation rather than reporting a conclusion they can't support. CI sets fetch-depth: 0 so this path is not taken there.
const isShallow = () => git("rev-parse", "--is-shallow-repository").trim() === "true";

// The MAIN working tree, per git — not the one we happen to be running in. Used to derive the harness memory slug (which must come from the repo's real home, not a temp worktree) and to tell the user when gitignored files are legitimately absent because this is a linked worktree.
const mainWorktree = () =>
  (git("worktree", "list", "--porcelain").split("\n").find((l) => l.startsWith("worktree ")) || "")
    .slice("worktree ".length)
    .trim();
const isLinkedWorktree = () => {
  const main = mainWorktree();
  if (!main) return false;
  let here = REPO;
  try {
    here = realpathSync(REPO);
  } catch {}
  let there = main;
  try {
    there = realpathSync(main);
  } catch {}
  return here !== there;
};

/* ------------------------------------------------------------------ *
 * Exemptions. Every one carries a reason and, where it applies, the
 * record that tracks it — an unexplained allowlist entry is how a real
 * defect gets permanently silenced.
 * ------------------------------------------------------------------ */

// Six tags were minted before the TAG-INVARIANT gate existed, on commits whose package.json still read the PREVIOUS version. Rewriting a pushed tag is worse than the inconsistency, so they are tracked in docs/db-deferred-list.md rather than fixed. New mismatches must still fail.
const KNOWN_BAD_TAGS = new Set(["v2.33.3", "v2.33.4", "v2.35.0", "v2.35.1", "v2.35.2", "v2.35.3"]);

// The DEVLOG-entry-by-default rule was adopted at v2.40.0 (2026-07-28 14:15 EDT). Releases before it are legitimately uncovered — 62 of 103 versions predate it, and flagging them would be noise that trains you to ignore the whole audit.
const DEVLOG_RULE_FROM = [2, 40, 0];

// CHANGELOG-SUMMARY range headings ("## v2.17.0–v2.17.3") are RETIRED. Every release from v2.19.0 onward has its own heading — verified 2026-07-28 22:10 EDT: the 7 surviving ranges are all v2.18.3-and-older. Ranges are therefore accepted as LEGACY ONLY. A range covering a modern version is itself a finding, because silently accepting it would re-legitimise a convention Harkirat retired. (The first pass got this wrong in the other direction: it accepted ranges everywhere.)
const SUMMARY_RANGE_LEGACY_BEFORE = [2, 19, 0];

// The notes-file confirmation mark is SWITCHABLE from MarkEdit's "Confirmation Mark" menu — the file's own Legend and its L121 note both spell out the live shortlist. Matching only "ℋ" (the first pass) meant an item confirmed with ✴︎, ✦ or ◆ would never be seen as confirmed and would sit unswept forever, silently. Any new symbol added to that menu must be added here in the same change.
const CONFIRM_MARKS = ["✴︎", "✦", "◆", "ℋ"];

// v3 pre-release format (docs/superpowers/specs/2026-07-27-v3-development-structure-design.md §110-118): changelog entries are titled "Pre-Release v3.MAJOR.MINOR", package.json carries a matching "-pre" suffix, CHANGELOG-SUMMARY is NOT written during pre-release, and NO tags are minted until v3.0.0. CI runs this audit on v3-pre-release PRs, so every check must either understand that shape or be blind to it -- a false CI failure on the v3 branch would be a gap created by the gap-closing work.

// package.json was NOT bumped per release before v2.33.0 — the version lived only in the changelog, and every earlier commit reads "1.0.0". Verified 2026-07-28 19:45 EDT: v2.32.0 -> 1.0.0, v2.33.0 -> 2.33.0. Checking the 59 pre-convention tags reports a real historical fact as 59 failures, which is exactly the noise that teaches you to stop reading the audit.
const TAG_RULE_FROM = [2, 33, 0];

// Historical-by-design sources: these describe the past, including files since renamed, archived, or belonging to other machines entirely. Scanning them for LIVE cross-references produces guaranteed false positives — a doc saying "renamed from `deferred-items.md`" is correct prose, not staleness.
//   - CHANGELOG / SUMMARY / DEVLOG: append-only records of what was true at the time.
//   - diors-notes.md: Harkirat's INTAKE scratchpad, not a maintained record. Its resolved comments reference MarkEdit extension files and other paths that never lived in this repo.
//   - archive/: dead by definition. superpowers/: dated design snapshots of one moment.
const XREF_SKIP_SOURCES = [
  "docs/CHANGELOG.md",
  "docs/CHANGELOG-SUMMARY.md",
  "docs/DEVLOG.md",
  "docs/ideas/diors-notes.md",
];
const XREF_SKIP_PREFIXES = ["docs/archive/", "docs/superpowers/"];

// Gitignored paths that have been TRIAGED and confirmed genuinely optional-by-design. These resolve silently; every OTHER gitignored-and-absent path still WARNs, which is the point — the warning exists because skipping wholesale once masked a real bug (CLAUDE.md and the notes file both pointed at `local/Harkirats-Space.md` after it moved to `docs/`, and the `local/` ignore rule hid it). This list is the narrow retirement of an ANSWERED ambiguity, not a widening of the exemption. ⚠️ An entry belongs here ONLY when the referencing docs are correct and the file is optional at RUNTIME — never to quiet a path someone has not actually chased down. Reason + date required.
const XREF_IGNORED_OPTIONAL = {
  // Triaged 2026-08-10 21:24 EDT (and previously in v2.42.0, where it was "deliberately left alone" — it re-warned on every run since, costing the same triage twice). It is a real optional dev overlay: `utils/emojiMap.js:120` sets DEV_OVERRIDE_FILE to it, reads it only when NODE_ENV=development, and fails soft on both parse and read errors (lines 176/184). Absent simply means no local override exists, which is the normal state on every machine including Harkirat's. The two docs that name it are describing the feature correctly.
  "utils/emojiMap.dev.json": "optional dev-only emoji overlay read defensively by utils/emojiMap.js",
};

// The memory store, for the memory-xref check. Outside the repo by design, so this check is SKIPPED (not failed) wherever the directory is absent — notably in CI. That asymmetry is deliberate: it is a real check locally, where the store exists, and silent rather than wrong where it doesn't.
const MEMORY_DIR = join(
  process.env.HOME || "",
  ".claude/projects/-Applications-Claude-Code-Diors-Builds/memory"
);

// The FROZEN pre-migration store. CLAUDE.md still references it by name (`_MIGRATED.md` tombstone), so its filenames must resolve — but nothing may ever be written there. See project_memory_slug_migration.
const OLD_MEMORY_DIR = join(process.env.HOME || "", ".claude/projects/-Applications-Diors-Builds/memory");

/**
 * Files OUTSIDE this repo that this repo's documentation depends on by name.
 *
 * This is the blind spot nobody had looked at: `meta-deferred-list.md` is referenced from CLAUDE.md, docs/README.md, docs/db-deferred-list.md AND the memory store, and it lives at an absolute path that `xref` deliberately skips. If it is ever renamed or moved, every one of those pointers breaks and NOTHING would report it. Same for the global Claude Code config this project's whole workflow assumes. Verified present 2026-07-29 00:20 EDT.
 *
 * Checked locally only — in CI these paths genuinely do not exist, so `external-anchors` SKIPS rather than failing, and says so in the ledger.
 */
const EXTERNAL_ANCHORS = [
  { path: "/Applications/Claude Code/meta-deferred-list.md", why: "the cross-project tracker; referenced from CLAUDE.md, docs/README.md, docs/db-deferred-list.md and memory" },
  { path: join(process.env.HOME || "", ".claude/hooks/usage-guard.mjs"), why: "the turn-budget / tool-routing guard the working agreement depends on" },
  { path: join(process.env.HOME || "", ".claude/CLAUDE.md"), why: "global instructions (tool-preference chains, the four efficiency practices)" },
  { path: join(process.env.HOME || "", ".claude/RTK.md"), why: "the rtk command reference that global CLAUDE.md points at" },
  { path: MEMORY_DIR, why: "the canonical memory store for this repo" },
];

/* ------------------------------------------------------------------ */

/**
 * A check that can't find its structural anchor MUST say so, never return "clean".
 *
 * Demonstrated on the real tree 2026-07-28 22:40 EDT: renaming `**Part A — The Journey` and `## Questions/Notes for Claude` made `devlog-toc` and `notes-sweep` both print **"passed"** while doing nothing at all. Two of the checks written to stop silently-dead guards were themselves silently disabled by a heading rename — the same class as `usage-guard.mjs` dying at line 2.
 *
 * The original comment ("markers moved: stay silent rather than cry wolf") had it exactly backwards. Crying wolf is recoverable; a green tick over a check that isn't running is not.
 */
const anchorMissing = (file, anchor, consequence) => [{
  msg: `${file} no longer contains ${anchor}, so this check DID NOT RUN. ${consequence} ` +
    `Either restore the anchor or update scripts/docs-audit.mjs in the same change — a renamed ` +
    `heading must never silently disable a gate.`,
}];

const cmpVer = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const parseVer = (v) => v.replace(/^v/, "").split(".").map(Number);

const checks = [];
// vacuousOk: an empty corpus is LEGITIMATE for this check, so examining 0 items is not suspicious. It is still reported in the ledger — visible, just not a warning. Default is to warn, because for most checks "matched nothing" means the matcher broke, not that the corpus vanished.
const check = (id, severity, title, run, opts = {}) =>
  checks.push({ id, severity, title, run, vacuousOk: !!opts.vacuousOk });

/* ----------------------- prompt-antiskim ---------------------------- */
// Born 2026-09-01 21:00 EDT, from a defect that is structural rather than careless. A realm prompt is handed to the next session with a short OPENER pasted into chat. Writing that opener, the natural, helpful thing to do is summarise the document's findings -- and a summary is a SUBSTITUTE: the reader gets three bullets, feels oriented, and never opens the file. Harkirat, on exactly that: "A fresh session will read this and conclude on it and won't bother looking at the actually detailed stuff."
//
// ⚠️ THE PRINCIPLE WAS ALREADY WRITTEN DOWN AND STILL FAILED. `docs/reference/session-handoff-guide.md` has carried "JUDGEMENT DOES NOT COMPRESS -- CARRY A POINTER, NEVER A PARAPHRASE" since 2026-08-30, and the opener was summarised anyway, because the person writing it is the person who knows the content and summarising feels like service. That is the same shape as the timestamp placeholder: a rule everyone agrees with, violated at the moment of writing, so the remedy has to be a check rather than a better sentence.
//
// Deliberately narrow: it asserts only that the DOCUMENT tells its reader an opener is not a summary of it. It cannot see the opener, which lives in a chat message -- so it guards the half that is on disk, and that half is what makes a skimming reader catch itself.
check(
  "prompt-antiskim",
  "ERROR",
  "every realm prompt tells its reader that a short opener is not a summary of it",
  () => {
    const out = [];
    let examined = 0;
    const dir = "docs/superpowers/plans";
    const GUARD = /not a summary of (this|that) file|IF YOU WERE HANDED A SHORT OPENER/i;
    for (const f of (existsSync(join(REPO, dir)) ? readdirSync(join(REPO, dir)) : []).filter((n) => /-PROMPT\.md$/.test(n))) {
      const txt = read(`${dir}/${f}`);
      if (txt === null) continue;
      examined++;
      // Only the opening of the file counts. A guard buried at line 400 is read by somebody who already did not skim.
      if (!GUARD.test(txt.split("\n").slice(0, 40).join("\n"))) {
        out.push({ msg: `${dir}/${f} has no anti-skim guard in its first 40 lines. A session handed a short opener will act on the opener. State, near the top, that the opener is NOT a summary of this file and name at least one thing only the file carries.` });
      }
    }
    return { findings: out, examined };
  },
  // A repo with no realm prompts has nothing to examine, and that is legitimate rather than a silent pass — this suite's own test fixture is exactly that case, which is how the vacuity was caught.
  { vacuousOk: true },
);

/* ----------------------- changelog-pr-cite -------------------------- */
// Born 2026-08-20 from a defect that shipped through a fully green audit: the v3.55.0 entry was written with a literal `(#PR)` placeholder, because the PR number does not exist yet at the moment the pre-merge changelog entry is composed on the branch. Every check passed — the version was covered, the hash chain was intact, the structure was sound — because none of them look at whether the citation is a real number or a note-to-self. It reached `main` and needed a follow-up release to correct, which is exactly what this suite exists to prevent.
//
// Deliberately narrow: it flags PLACEHOLDER shapes only, never a missing citation. A missing `(#N)` has legitimate historical instances in this file; `(#PR)` and `(#XXX)` can never be correct.
check(
  "changelog-pr-cite",
  "ERROR",
  "no changelog entry cites an unfilled PR placeholder",
  () => {
    const out = [];
    let examined = 0;
    const PLACEHOLDER = /\(#(PR|X+|N+|TBD|\?+)\b/i;
    for (const f of ["docs/CHANGELOG.md", "docs/CHANGELOG-SUMMARY.md", "docs/DEVLOG.md"]) {
      const txt = read(f);
      if (txt === null) continue;
      for (const [i, line] of txt.split("\n").entries()) {
        if (!/^#{2,3} /.test(line)) continue;
        examined++;
        const m = line.match(PLACEHOLDER);
        if (m) {
          // A finding is an OBJECT with a `msg` key, not a bare string — the renderer prints `r.msg`, so a string finding renders as `undefined` while still failing the run.
          out.push({ msg: `${f}:${i + 1} cites \`(#${m[1]})\` — an unfilled placeholder, not a PR ` +
            `number. Replace it with the real number before merging; after the merge the only ` +
            `remedy is another release.` });
        }
      }
    }
    // 🔴 The key is `findings`, not `problems`. Every other check in this file returns `findings`, and the runner reads only that — so a check returning `problems` reports zero findings, passes green, and is VACUOUS. This check shipped that way for one run and was caught only by running it against deliberately broken input, which is the reason that step is not optional here.
    return { findings: out, examined };
  }
);

/* ------------------------ record-structure -------------------------- */
// Born 2026-08-01 from a real corruption this suite did NOT catch: an edit to docs/CHANGELOG.md spliced the file's ENTIRE 183-line header back into the middle of the newest entry, truncating a sentence mid-word. Every other check passed — links resolved, versions were covered, the hash chain was intact, because none of them look at the file's SHAPE. A duplicated H1 is the cheapest possible signal that a record has been spliced into itself, and it costs one pass over each file.
check(
  "record-structure",
  "ERROR",
  "no record file repeats a top-level heading (a splice duplicates one)",
  () => {
    const out = [];
    let examined = 0;
    for (const f of ["docs/CHANGELOG.md", "docs/CHANGELOG-SUMMARY.md", "docs/DEVLOG.md",
                     "docs/ROADMAP.md", "docs/README.md", "docs/db-deferred-list.md"]) {
      const txt = read(f);
      if (txt === null) continue;
      examined++;
      const lines = txt.split("\n");
      // Fenced code can legitimately contain a '#' line; track fences and skip them.
      let fence = false;
      const heads = [];
      for (const ln of lines) {
        if (/^\s*(```|~~~)/.test(ln)) { fence = !fence; continue; }
        if (!fence && /^#{1,3} /.test(ln)) heads.push(ln.trim());
      }
      // NOT "exactly one H1": DEVLOG legitimately uses H1 for its major parts (TOC, Part A, Part B) and the self-test caught that assumption on the first run. The invariant that actually detects a splice is REPETITION — a duplicated title, not a second one.
      const seen = new Map();
      for (const h of heads) seen.set(h, (seen.get(h) || 0) + 1);
      for (const [h, n] of seen) {
        if (n > 1 && /^#{1,2} /.test(h)) {
          out.push({ msg: `${f} repeats the heading "${h.slice(0, 70)}" ${n} times. ` +
            `Duplicate top-level headings mean either a copy-paste splice or two entries ` +
            `claiming the same identity.` });
        }
      }
    }
    return { findings: out, examined };
  }
);

/* --------------------------- npm-script-exists ------------------------- */
// Added 2026-09-01 11:5x EDT, from a read-only reader test. A fresh session was handed the documents that start a realm pass and asked to work out its first ten actions. It could not run the fifth close condition, because `portal:realwalk` is named on the status board, named in the plan, named in two prompts — and **is not a script**. The file `scripts/portalRealWalk.mjs` exists; the npm entry point never did, and no document carried the raw invocation either. A condition nobody can invoke reads exactly like one nobody got round to.
//
// 🔴 THIS IS THE CLASS, NOT THE CASE. Of sixteen defects that reader test found, the largest group was documents asserting something about a TOOL — what a flag does, how many lists it prints, which script exists — that had drifted from the tool. Prose describing behaviour rots silently because nothing executes it. This check closes the one member of that class that is decidable from the text alone: a command either resolves in package.json or it does not.
//
// ⚠️ WHAT IT CANNOT SEE, said plainly so the green is not over-read: whether the script does what the doc claims. The same reader test found `--all` described as "every view in ONE batched call" when it lifts row caps on ONE view, and that sentence names a script that exists perfectly. Behaviour drift needs a human or a falsifier; only existence is mechanical.
//
// ⚠️ LIVE DOCS ONLY. A frozen spec naming a script that has since been renamed is a historical record and correct as written -- failing it would teach the next reader that the audit lies, the same reasoning as PLAN_AUDIT_FROM above.
check(
  "npm-script-exists",
  "ERROR",
  "every npm script named in a LIVE tracked doc actually exists in package.json",
  () => {
    const out = [];
    let examined = 0;
    // 🔴 ABSENT AND UNPARSEABLE ARE DIFFERENT STATES, and conflating them made this check fire on VALID input the first time its own falsifier ran. A fixture tree under DOCS_AUDIT_ROOT has no package.json at all — there is nothing to verify against and nothing wrong — so that SKIPS. A package.json that exists and cannot be read, or that declares no scripts, is a real refusal on the real tree. A check that cries wolf gets filtered, and then it guards nothing.
    const pkgRaw = read("package.json");
    if (pkgRaw === null) return { findings: [], examined: 0, skipped: "no package.json in this tree, so no npm script can be resolved" };
    let scripts;
    try { scripts = new Set(Object.keys(JSON.parse(pkgRaw).scripts || {})); }
    catch { return { findings: [{ file: "package.json", msg: "exists but could not be parsed, so no npm script could be verified -- this is a REFUSAL, not a pass" }], examined: 0 }; }
    // ⚠️ NO SPECIAL CASE FOR AN EMPTY SCRIPTS MAP, and the first version's was wrong. It refused, which fired on the fixture tree — valid input — and a finding that is wrong every run is one nobody reads. With no scripts, every `npm run` a doc names genuinely does not resolve and is reported on its own merits: screaming-obvious on a real repo, silently zero on a fixture with no doc mentions. The general path already gives the right answer, and a guard that only exists to say so is a guard that can be wrong.
    for (const f of tracked()) {
      if (!f.endsWith(".md")) continue;
      const txt = read(f);
      if (txt === null) continue;
      // status: live only. A superseded or frozen doc is a snapshot of what was true then.
      if (!/^status:\s*live\s*$/m.test(txt.slice(0, 400))) continue;
      const seen = new Set();
      for (const m of txt.matchAll(/npm run ([a-z0-9][a-z0-9:_-]*)/g)) {
        const name = m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        examined++;
        if (!scripts.has(name)) {
          out.push({ file: f, msg: `names \`npm run ${name}\`, which is not a script in package.json. Either add the script or write the raw invocation -- a command a reader cannot run is worse than no command, because it reads as one somebody verified.` });
        }
      }
    }
    // ⚠️ A CORPUS NAMING NO SCRIPT IS A SKIP, NOT A PASS. The fixture tree has no live doc mentioning `npm run`, so this examines 0 there — and the framework rightly calls a 0-item pass vacuous. Saying "skipped" is the honest word for "there was nothing here to verify", and it keeps the vacuous-pass detector meaningful for the checks where a 0 really would mean a broken matcher. On the real tree this examines ~100 mentions.
    if (!examined) return { findings: [], examined: 0, skipped: "no live tracked doc names an npm script in this tree" };
    return { findings: out, examined };
  }
);

/* --------------------------- plan-audit-log ------------------------- */
// Added 2026-08-20 12:00 EDT. A plan is approved once and then executed by someone (or some session) with none of the context that produced it, so the moment to find its defects is BEFORE approval -- and "review the plan" does not find them. Asked to REVIEW its own hotpatch plan, a session found polish; asked to FALSIFY it, the same session found ten defects, two of which would have shipped a silent wrong result (a baseline commit that made the whole feature a no-op, and a command that never reached Discord under a success message). Neither was visible from the plan text -- both came from going and checking a claim the plan had accepted.
//
// So: a plan must carry the record of that pass. Not because the section is valuable in itself, but because a plan with no audit log is a plan nobody tried to break, and that is invisible afterwards. Empty-is-honest is allowed -- "no defects found" is a legitimate outcome and must be WRITABLE, or the check just teaches people to invent findings.
//
// ⚠️ DATED FLOOR, not retroactive. The three plans predating this convention are not defective for lacking a section that did not exist; failing them would only teach the next reader that the audit lies. Same shape as the changelog audit's TAG_RULE_FROM exemption.
const PLAN_AUDIT_FROM = "2026-08-20";
check(
  "plan-audit-log",
  "ERROR",
  "every plan written since the falsification-pass convention records that pass",
  () => {
    const out = [];
    let examined = 0;
    for (const f of tracked()) {
      const m = f.match(/^docs\/superpowers\/plans\/(\d{4}-\d{2}-\d{2})-/);
      if (!m || m[1] < PLAN_AUDIT_FROM) continue;
      const txt = read(f);
      if (txt === null) continue;
      examined++;
      if (!/^##+ Audit log\b/m.test(txt)) {
        out.push({ msg: `${f} has no "## Audit log" section. Before a plan is approved it gets a ` +
          `falsification pass -- run it with the question "where is this WRONG?", never "is this ` +
          `good?" -- and the plan records what that pass found. "No defects found" is a legitimate ` +
          `entry; an absent section is not, because it cannot be told apart from never having looked. ` +
          `See .claude/rules/plan-drafting.md.` });
      }
    }
    return { findings: out, examined };
  },
  // A tree with no post-convention plans in it is a legitimate empty corpus, not a broken matcher.
  { vacuousOk: true }
);

/* ---------------------------- readme-map ---------------------------- */
check(
  "readme-map",
  "ERROR",
  "docs/README.md maps every tracked file under docs/",
  () => {
    const readme = read("docs/README.md");
    if (readme === null) return [{ msg: "docs/README.md is missing — the doc map is the front door." }];
    // Coverage unit = the top-level entry under docs/. A directory is covered by naming the directory (README documents reference/ and archive/ as roles, not file-by-file), a loose file by its name.
    const units = new Map(); // unit -> example path
    for (const f of tracked()) {
      if (!f.startsWith("docs/") || f === "docs/README.md") continue;
      const rest = f.slice("docs/".length);
      const slash = rest.indexOf("/");
      const unit = slash === -1 ? rest : rest.slice(0, slash) + "/";
      if (!units.has(unit)) units.set(unit, f);
    }
    const out = [];
    for (const [unit, example] of units) {
      const needle = unit.endsWith("/") ? unit.slice(0, -1) : unit;
      if (!readme.includes(needle)) {
        out.push({
          msg: `docs/${unit} is tracked but never named in docs/README.md (e.g. ${example}). ` +
            `A doc the map doesn't mention is a doc nobody is told to maintain.`,
        });
      }
    }
    return { findings: out, examined: units.size };
    // NOTE: the reverse direction (a name the README mentions must exist) is deliberately NOT checked here. The README names most docs by bare filename, and legitimately mentions old names in prose ("renamed from `deferred-items.md`") — a basename matcher cannot tell that apart from staleness, and a check that cries wolf every run is worse than no check. Path-shaped references ARE covered, precisely, by `xref` below.
    return out;
  }
);

/* ------------------------------- xref ------------------------------- */
const liveDocSources = () =>
  tracked().filter(
    (f) =>
      (f === "CLAUDE.md" || f.startsWith(".claude/rules/") || f.startsWith("docs/")) &&
      f.endsWith(".md") &&
      !XREF_SKIP_SOURCES.includes(f) &&
      !XREF_SKIP_PREFIXES.some((p) => f.startsWith(p))
  );

// One batched `git check-ignore` instead of one per candidate. Gitignored paths (utils/emojiMap.dev.json, anything under local/) are REAL files that simply aren't tracked — referencing them is correct, and treating "not in git" as "does not exist" would flag working documentation.
const ignoredSet = (paths) => {
  if (!paths.length) return new Set();
  try {
    const out = execFileSync("git", ["check-ignore", "--stdin"], {
      cwd: REPO,
      input: paths.join("\n"),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return new Set(out.split("\n").filter(Boolean));
  } catch {
    return new Set(); // exit 1 simply means "nothing matched"
  }
};

check(
  "xref",
  "ERROR",
  "every repo path named in a LIVE doc actually exists",
  () => {
    // TWO token shapes, deliberately handled differently.
    //
    // PATH-shaped (contains "/") — a rename leaves these behind, so they are ERRORs.
    //
    // BARE filename — the first pass dropped these ENTIRELY to kill 30+ false positives, and that trade was never stated out loud. It was a self-inflicted blind spot: docs/README.md refers to most records by bare name, so renaming `deployment-and-ops.md` would have broken the map silently. Recovered here by resolving against a WIDE universe instead of just tracked files — tracked basenames + files git is merely ignoring + both memory stores + the external anchors — and by skipping mentions that are explicitly HISTORICAL ("renamed from `x`", "`x` → `y`").
    //
    // ⚠️ Scoped to `.md` ONLY, and WARN not ERROR. Both limits were learned the hard way at 2026-07-29 00:30 EDT: I measured the false-positive rate with a probe that scanned only `.md`, wrote "0 false positives" in this comment, then shipped a check that also scanned .js/.json — which immediately flagged discord.js internals (`BaseInteraction.js`, `CachedManager.js`, `User.js`) and `local/` scratch. Measuring one thing and shipping another is the same error class as the rest of this file exists to catch, committed while writing the fix for it.
    //
    // WARN, because a bare name genuinely cannot be resolved with certainty: gitignored files are WORKING-TREE-LOCAL, so `docs/ideas/Harkirats-Space.md` resolves in the main tree and does not in a fresh worktree or clone. That ambiguity is real and must be reported, not decided.
    let scanned = 0;
    const ignoredFiles = git("ls-files", "--others", "--ignored", "--exclude-standard")
      .split("\n")
      .filter((p) => p && !p.startsWith("node_modules/"));
    const universe = new Set([
      ...tracked().map((p) => p.split("/").pop()),
      ...ignoredFiles.map((p) => p.split("/").pop()),
      ...(existsSync(MEMORY_DIR) ? readdirSync(MEMORY_DIR) : []),
      ...(existsSync(OLD_MEMORY_DIR) ? readdirSync(OLD_MEMORY_DIR) : []),
      ...EXTERNAL_ANCHORS.map((a) => a.path.split("/").pop()),
    ]);
    // Historical phrasing. A doc explaining that something USED to be called X is correct prose, and must never be reported as a stale pointer.
    const HISTORICAL = /renamed from|renamed to|formerly|used to be|was called|old name|superseded|→|->/i;

    const hits = [];
    const bareHits = [];
    for (const src of liveDocSources()) {
      const text = read(src);
      if (text === null) continue;
      const seen = new Set();
      for (const m of text.matchAll(/`([A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:md|js|mjs|json|sh|ya?ml))`/g)) {
        const rel = m[1].trim();
        if (seen.has(rel)) continue;
        seen.add(rel);
        scanned++;
        if (rel.includes("node_modules") || rel.includes("*")) continue;
        const bare = rel.replace(/^\.\//, "").replace(/^\.\.\//, "");

        if (rel.includes("/")) {
          if (existsSync(join(REPO, bare)) || existsSync(join(REPO, dirname(src), rel))) continue;
          hits.push({ src, rel, bare });
          continue;
        }
        // .md only — project records. A bare .js/.json name in prose is almost always a third-party file or local scratch, never something a rename in THIS repo can break.
        if (!rel.endsWith(".md")) continue;
        if (universe.has(rel)) continue;
        const lineStart = text.lastIndexOf("\n", m.index) + 1;
        let lineEnd = text.indexOf("\n", m.index);
        if (lineEnd === -1) lineEnd = text.length;
        if (HISTORICAL.test(text.slice(lineStart, lineEnd))) continue;
        bareHits.push({ src, rel });
      }
    }
    const ignored = ignoredSet(hits.map((h) => h.bare));
    const findings = hits
      // A triaged optional path drops out entirely -- no WARN, no ERROR. It must still be BOTH gitignored AND on the allowlist: if one of these ever becomes tracked-and-missing, that is a genuine broken reference and falls through to the ERROR branch below, as it should.
      .filter((h) => !(ignored.has(h.bare) && XREF_IGNORED_OPTIONAL[h.bare]))
      .map((h) =>
      ignored.has(h.bare)
        ? {
            // Gitignored-and-absent is genuinely ambiguous: it may be a dev-only file that simply isn't present, or a plain wrong path. Skipping it entirely -- the first pass -- MASKED a real bug: CLAUDE.md and the notes file both pointed at `local/Harkirats-Space.md` while the file had moved to `docs/`, and the `local/` ignore rule hid it. Warn instead of skipping, so ambiguity is visible rather than invisible. ⚠️ The XREF_IGNORED_OPTIONAL guard above retires INDIVIDUAL entries that have been triaged and answered -- it does not restore the blanket skip that caused that bug.
            severity: "WARN",
            msg: `${h.src} references \`${h.rel}\`, which is gitignored AND not present. That is either ` +
              `a dev-only file that just isn't here, or a stale path — the ignore rule makes the two ` +
              `indistinguishable, so confirm which.`,
          }
        : {
            msg: `${h.src} references \`${h.rel}\`, which does not exist. A rename that left a cross-reference ` +
              `behind is the "no half-measures on reorgs" failure — fix the pointer, don't delete the mention.`,
          }
    );
    for (const b of bareHits) {
      findings.push({
        severity: "WARN",
        msg: `${b.src} references the record \`${b.rel}\`, and no file by that name resolves — not tracked, ` +
          `not gitignored-but-present IN THIS WORKING TREE, not in either memory store, not a known ` +
          `external anchor, and the sentence carries no "renamed from" phrasing. Either a rename left ` +
          `this pointer behind, or it is a gitignored file that exists only in the main working tree ` +
          `(worktrees and fresh clones do not carry those). Confirm which.`,
      });
    }
    return { findings, examined: scanned };
  }
);

/* ---------------------------- memory-xref --------------------------- */
check(
  "memory-xref",
  "WARN",
  "memory files named in the docs still exist in the memory store",
  () => {
    // This is the check I previously called impossible. Memory does live outside the repo — but the REFERENCES to it live inside, and those are checkable whenever the store is present. It cannot verify that a session RECORDED what it learned (that is a fact about a session, not a tree — see the MEMORY-WRITE hook); it does catch a memory file that was renamed or deleted while the docs kept pointing at it.
    if (process.env.DOCS_AUDIT_ROOT) {
      return { findings: [], skipped: "auditing a foreign tree (DOCS_AUDIT_ROOT); the memory store is machine-global, not part of it" };
    }
    if (!existsSync(MEMORY_DIR)) {
      return { findings: [], skipped: "memory store not present (CI or a fresh clone) — references to it were NOT verified" };
    }
    const out = [];
    let seenTotal = 0;
    for (const src of liveDocSources()) {
      const text = read(src);
      if (text === null) continue;
      const seen = new Set();
      // Memory files are snake_case (or MEMORY.md), always referenced by bare filename.
      for (const m of text.matchAll(/`((?:[a-z0-9]+_[a-z0-9_]*|MEMORY)\.md)`/g)) {
        const name = m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        seenTotal++;
        if (existsSync(join(MEMORY_DIR, name))) continue;
        if (existsSync(join(REPO, name))) continue; // an in-repo file that happens to look snake_case
        out.push({ msg: `${src} references memory \`${name}\`, which is not in the memory store.` });
      }
    }
    return { findings: out, examined: seenTotal };
  },
  { vacuousOk: true } // docs need not cite any memory file
);

/* -------------------------- summary-coverage ------------------------ */
check(
  "summary-coverage",
  "ERROR",
  "every CHANGELOG version appears in CHANGELOG-SUMMARY",
  () => {
    const ch = read("docs/CHANGELOG.md");
    const su = read("docs/CHANGELOG-SUMMARY.md");
    if (ch === null || su === null) return [{ msg: "CHANGELOG.md or CHANGELOG-SUMMARY.md is missing." }];
    const versions = [...ch.matchAll(/^## (v\d+\.\d+\.\d+)/gm)].map((m) => m[1]);

    // A version is covered by its OWN heading, or -- for legacy releases only -- by a range heading. Ranges are retired (see SUMMARY_RANGE_LEGACY_BEFORE); expand them against the changelog's own ordering so no version ordering has to be re-invented here. En-dash, em-dash and hyphen all appear in use. Note `su.includes(v)` is deliberately a substring test, so a version named in a range endpoint or in prose also counts as present. An INDIVIDUAL heading is "## vX.Y.Z" NOT followed by a range dash. Distinguishing this from a plain substring test matters more than it looks: in "## v2.32.0–v2.33.0" BOTH versions occur as substrings, so a substring test scored both as having their own heading and the range became completely invisible. The self-test caught exactly that, on a two-version range.
    const own = new Set([...su.matchAll(/^## (v\d+\.\d+\.\d+)(?!\s*[–—-]\s*v)/gm)].map((m) => m[1]));
    const viaRange = new Map(); // version -> the range heading covering it
    for (const m of su.matchAll(/^## (v\d+\.\d+\.\d+)\s*[–—-]\s*(v\d+\.\d+\.\d+)/gm)) {
      const a = versions.indexOf(m[1]);
      const b = versions.indexOf(m[2]);
      if (a === -1 || b === -1) continue;
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) viaRange.set(versions[i], m[0]);
    }
    // Anywhere else in the file — a prose line, a folded note. Weaker than a heading but still a mention.
    const mentioned = new Set(versions.filter((v) => su.includes(v)));

    const out = [];
    for (const v of versions) {
      if (!own.has(v) && !viaRange.has(v) && !mentioned.has(v)) {
        out.push({
          msg: `${v} has a CHANGELOG entry but no mention at all in CHANGELOG-SUMMARY.md. Every version ` +
            `number is represented — ops/docs-only ones as a one-line note, never skipped.`,
        });
      }
    }
    // A MODERN version leaning on a range heading is its own finding: the convention was retired.
    for (const [v, heading] of viaRange) {
      if (cmpVer(parseVer(v), SUMMARY_RANGE_LEGACY_BEFORE) < 0) continue; // genuinely legacy
      if (own.has(v)) continue;
      out.push({
        msg: `${v} is covered only by the RANGE heading "${heading.trim()}". Range headings are ` +
          `retired — every release from v2.19.0 onward gets its OWN "## ${v} — <date>" heading. ` +
          `Give it one rather than widening the range.`,
      });
    }
    return { findings: out, examined: versions.length };
  }
);

/* --------------------------- devlog-orphan -------------------------- */
check(
  "devlog-orphan",
  "ERROR",
  "every version named in a DEVLOG heading has a real heading in CHANGELOG",
  () => {
    // THE PRE-RELEASE HOLE, found 2026-08-15 when v3.24.0's CHANGELOG heading turned out to be missing entirely -- its whole body had been reading as part of v3.25.0's entry since it shipped, and every check stayed green.
    //
    // summary-orphan is the same idea but cannot see this: it uses CHANGELOG-SUMMARY as its reference list, and CHANGELOG-SUMMARY is deliberately NOT written during pre-release (see this file's own pre-release note). So for the whole v3 line there was no reference list at all, and a missing heading was invisible. Its heading regex also matches only "## vX.Y.Z" and never "## Pre-Release vX.Y.Z", so it would have missed these headings even if it ran.
    //
    // DEVLOG is the right reference precisely because it IS maintained through pre-release: every release gets a narrative entry stamped with its version, so it is an independent record of which versions exist.
    const ch = read("docs/CHANGELOG.md");
    const dv = read("docs/DEVLOG.md");
    if (ch === null || dv === null) return [{ msg: "CHANGELOG.md or DEVLOG.md is missing." }];

    // Both heading forms. The `-pre` suffix is stripped: pre-release CHANGELOG headings carry the bare version ("## Pre-Release v3.24.0") while DEVLOG stamps it "(v3.24.0-pre)".
    const headings = new Set(
      [...ch.matchAll(/^## (?:Pre-Release )?(v\d+\.\d+\.\d+)/gm)].map((m) => m[1])
    );
    // Only DEVLOG *headings*, not prose -- the table of contents lists the same versions, and a substring test over the file would be satisfied by the TOC line alone while the body entry and the changelog heading were both gone.
    const claimed = [...dv.matchAll(/^## .*?\(v(\d+\.\d+\.\d+)(?:-pre)?\)\s*$/gm)].map((m) => "v" + m[1]);

    const out = [];
    for (const v of new Set(claimed)) {
      if (headings.has(v)) continue;
      out.push({
        msg: `${v} has a DEVLOG entry but NO heading in CHANGELOG.md. Either the heading was ` +
          `deleted -- in which case its body is now welded onto the entry above it, which is how ` +
          `v3.24.0 was lost -- or the changelog entry was never written. Restore the heading; do ` +
          `not delete the DEVLOG entry to silence this.`,
      });
    }
    return { findings: out, examined: new Set(claimed).size };
  }
);

/* --------------------------- summary-orphan ------------------------- */
check(
  "summary-orphan",
  "ERROR",
  "every CHANGELOG-SUMMARY version has a real heading in CHANGELOG",
  () => {
    // The MIRROR of summary-coverage, and it exists because that check runs one way only. v2.44.0 was released, tagged, and given its summary entry -- and its CHANGELOG heading was later deleted by an unrelated merge, welding 55 surviving body lines onto the end of the v2.45.0 entry. Every other check stayed green: the words were all still present, no link moved, the hash chain skipped it because it had no heading to have a PR on, and summary-coverage only ever asks "does each CHANGELOG version reach the SUMMARY".
    //
    // Deliberately tested at HEADING strictness rather than by substring. The failure mode is a surviving body under a missing heading, so "the version string appears somewhere in the file" is exactly the test that would have been satisfied by the damage in a slightly different form -- a body that still named its own version in prose would have passed.
    const ch = read("docs/CHANGELOG.md");
    const su = read("docs/CHANGELOG-SUMMARY.md");
    if (ch === null || su === null) return [{ msg: "CHANGELOG.md or CHANGELOG-SUMMARY.md is missing." }];

    const headings = new Set([...ch.matchAll(/^## (v\d+\.\d+\.\d+)/gm)].map((m) => m[1]));
    // Only the SUMMARY's own individual headings. A legacy range heading covers versions it never names in full, so expanding one here would invent expectations rather than read them.
    const claimed = [...su.matchAll(/^## (v\d+\.\d+\.\d+)(?!\s*[–—-]\s*v)/gm)].map((m) => m[1]);

    const out = [];
    for (const v of claimed) {
      if (headings.has(v)) continue;
      out.push({
        msg: `${v} has its own CHANGELOG-SUMMARY heading but NO "## ${v}" heading in CHANGELOG.md. ` +
          `A released version is missing its detailed entry — check whether the entry is absent ` +
          `outright or whether its heading was dropped and the body absorbed into the entry above it.`,
      });
    }
    return { findings: out, examined: claimed.length };
  }
);

/* ----------------------------- hash-chain --------------------------- */
check(
  "hash-chain",
  "ERROR",
  "every changelog entry citing a PR also cites a resolvable commit hash",
  () => {
    const ch = read("docs/CHANGELOG.md");
    if (ch === null) return [];
    const entries = [...ch.matchAll(/^## (v\d+\.\d+\.\d+)[^\n]*?\(#(\d+)([^)]*)\)/gm)].map((m) => ({
      version: m[1],
      pr: m[2],
      tail: m[3],
    }));
    const shallow = isShallow();
    const out = [];
    entries.forEach((e, i) => {
      const hash = (e.tail.match(/`([0-9a-f]{7,40})`/) || [])[1];
      if (!hash) {
        // The NEWEST entry legitimately has no hash: the squash commit doesn't exist until the merge, so it is backfilled additively by the next release. That is the documented design.
        if (i === 0) return;
        out.push({
          msg: `${e.version} cites (#${e.pr}) but carries no commit hash. Only the newest entry may lack one — ` +
            `backfill it additively on the next release branch: (#${e.pr}) -> (#${e.pr} · \`hash\`). Never by --amend.`,
        });
        return;
      }
      if (shallow) return; // the hash is present; whether it resolves is unknowable here
      // `git cat-file -e` prints NOTHING on success, so testing its output is meaningless here — rev-parse is the one that actually reports. (The original two-clause expression worked only by accident; the self-test is what made it worth reading twice.)
      if (git("rev-parse", "--verify", "--quiet", `${hash}^{commit}`).trim() === "") {
        out.push({ msg: `${e.version} cites commit \`${hash}\`, which does not resolve in this repository.` });
      }
    });
    return { findings: out, examined: entries.length };
  }
);

/* ----------------------------- devlog-toc --------------------------- */
check(
  "devlog-toc",
  "ERROR",
  "DEVLOG Part A table of contents mirrors its body headings",
  () => {
    const text = read("docs/DEVLOG.md");
    if (text === null) return [];
    const lines = text.split("\n");
    const heads = lines.filter((l) => /^## 20\d{2}-/.test(l)).map((l) => l.replace(/^## /, "").trim());
    const s = lines.findIndex((l) => l.startsWith("**Part A — The Journey"));
    const e = lines.findIndex((l) => l.startsWith("**Part B — Lessons Ledger"));
    if (s < 0 || e < 0) {
      return anchorMissing(
        "docs/DEVLOG.md",
        'the "**Part A — The Journey" / "**Part B — Lessons Ledger" markers that bound the table of contents',
        "The TOC is no longer compared against the body at all."
      );
    }
    // Dated lines only. The TOC also carries intentional non-dated pointers with no body heading (e.g. "Earlier milestones") which must NOT be reported as extra, and must survive any rebuild.
    const toc = lines.slice(s + 1, e).filter((l) => /^- 20\d{2}-/.test(l)).map((l) => l.slice(2).trim());
    const out = [];
    // Naming the tool in the failure message is the point: this check and the Part-B one below both fire AFTER the bytes land, so each costs an edit-and-recheck cycle. `devlog-add.mjs` makes both structurally impossible, and it runs the Edit/Write gates itself so nothing is bypassed.
    for (const h of heads) if (!toc.includes(h)) out.push({ msg: `in the DEVLOG body but not the TOC: "${h}"\n      FIX ONCE, NOT AGAIN: add entries with \`node scripts/devlog-add.mjs --title "<TITLE>" --body-file <path>\` — it inserts the TOC line and places the entry at the end of Part A, so this check cannot trip.` });
    for (const t of toc) if (!heads.includes(t)) out.push({ msg: `in the DEVLOG TOC but not the body (stale wording or a renamed heading): "${t}"` });
    if (!out.length && heads.join("|") !== toc.join("|")) {
      out.push({ msg: "DEVLOG TOC holds the same entries as the body, but not in the same order." });
    }
    return { findings: out, examined: heads.length };
  }
);

/* ---------------------------- devlog-parts --------------------------- */
check(
  "devlog-parts",
  "ERROR",
  "no dated DEVLOG entry sits inside Part B (the thematic ledger claims to hold none)",
  () => {
    const text = read("docs/DEVLOG.md");
    if (text === null) return [];
    const lines = text.split("\n");
    const partB = lines.findIndex((l) => l.startsWith("# Part B"));
    if (partB < 0) {
      return anchorMissing(
        "docs/DEVLOG.md",
        'a "# Part B" heading marking the start of the thematic ledger',
        "A dated entry appended after Part B (the append-to-EOF habit that caused this check to exist) " +
          "would no longer be caught."
      );
    }
    const after = lines.slice(partB + 1);
    const out = after
      .map((l, i) => ({ l, n: partB + 1 + i + 1 }))
      .filter(({ l }) => /^## 20\d{2}-/.test(l))
      .map(({ l, n }) => ({
        msg: `docs/DEVLOG.md:${n} is a dated entry ("${l.replace(/^## /, "")}") sitting after the ` +
          `"# Part B" marker. Part B is thematic only — a dated entry belongs in Part A, in chronological ` +
          `order, not appended after the ledger.\n      FIX ONCE, NOT AGAIN: add entries with ` +
          `\`node scripts/devlog-add.mjs --title "<TITLE>" --body-file <path>\` — it inserts at the end of ` +
          `Part A and adds the TOC line, and it runs the Edit/Write gates itself so nothing is bypassed.`,
      }));
    return { findings: out, examined: after.length };
  }
);

/* ------------------------ devlog-version-cite ----------------------- */
check(
  "devlog-version-cite",
  "WARN",
  "releases since v2.40.0 are findable in the DEVLOG by version number",
  () => {
    const ch = read("docs/CHANGELOG.md");
    const dv = read("docs/DEVLOG.md");
    if (ch === null || dv === null) return [];
    const inScope = [...ch.matchAll(/^## (v\d+\.\d+\.\d+)/gm)]
      .map((m) => m[1])
      .filter((v) => cmpVer(parseVer(v), DEVLOG_RULE_FROM) >= 0);
    return {
      examined: inScope.length,
      findings: inScope
      .filter((v) => !dv.includes(v))
      .map((v) => ({
        msg: `${v} is not mentioned by number anywhere in DEVLOG.md. Its entry may well exist under a ` +
          `date heading — but the DEVLOG is then un-greppable by release, which is the same searchability ` +
          `problem that retired the TOC's vague "(later)" qualifiers. Cite the version in the entry.`,
      })),
    };
  },
  { vacuousOk: true } // legitimate when no release since the cutoff exists yet
);

/* ---------------------------- notes-sweep --------------------------- */
check(
  "notes-sweep",
  "ERROR",
  "no closed + confirmed intake is still sitting in the notes scratchpad",
  () => {
    const text = read("docs/ideas/diors-notes.md");
    if (text === null) return [];
    const lines = text.split("\n");
    // Working sections only: from the first "## Questions" heading to the explicit end marker. The 🔑 Legend above it documents the markers using the same syntax and must not be scanned.
    //
    // ⚠️ THE END ANCHOR MUST BE SEARCHED FOR *AFTER* THE START, and the marker is why. This used to end at `## 📍`, found by a bare findIndex over the whole file. On 2026-08-06 10:21 EDT that section moved ABOVE `## Questions` (Harkirat asked for it near the Legend, and the only reason it had been pinned to the bottom was this very scan range). `e` then came out LESS than `s`, `slice(s, e)` returned an empty array, and this check reported a VACUOUS PASS — examining nothing while reading as green. The vacuous-pass detector is the only reason it was noticed at all; the identical bug in notes-open-items.sh's awk took the live count 3 -> 0. Two implementations of one scan range, both broken by the same move, exactly as this check's own error message predicts ("the SessionStart hook scans between the SAME two anchors").
    const s = lines.findIndex((l) => /^## Questions/.test(l));
    const eMarker = lines.findIndex((l, i) => i > s && /^<!-- \/open-items -->/.test(l));
    const ePin = lines.findIndex((l, i) => i > s && /^## 📍/.test(l));
    const e = eMarker >= 0 ? eMarker : ePin;
    if (s < 0) {
      return anchorMissing(
        "docs/ideas/diors-notes.md",
        'a "## Questions..." heading marking the start of the working sections',
        "No intake is being checked for unswept confirmed items. ⚠️ The SessionStart NOTES-FILE hook " +
          "in .claude/settings.json scans between the SAME two anchors and is now silently broken too."
      );
    }
    const body = lines.slice(s, e < 0 ? lines.length : e);
    const itemCount = body.filter((l) => /^- /.test(l)).length;
    const found = body
      .map((l, i) => ({ l, n: s + i + 1 }))
      .filter(({ l }) => /^- \[x\]/.test(l) && CONFIRM_MARKS.some((c) => l.includes(c)))
      .map(({ l, n }) => {
        const mark = CONFIRM_MARKS.find((c) => l.includes(c));
        return {
          msg: `notes L${n} is closed AND confirmed (${mark}) but has not been swept to ` +
            `docs/archive/graveyard.md: "${l.slice(0, 90).replace(/\s+/g, " ")}…". ` +
            `A confirmation mark is Harkirat's explicit go-ahead to file it out.`,
        };
      });
    return { findings: found, examined: itemCount };
  }
);

/* --------------------------- deferred-sweep ------------------------- */
check(
  "deferred-sweep",
  "ERROR",
  "no shipped/resolved item is still listed as deferred work",
  () => {
    const text = read("docs/db-deferred-list.md");
    if (text === null) return [];
    const out = [];
    let section = "";
    let items = 0;
    text.split("\n").forEach((l, i) => {
      if (/^## /.test(l)) section = l;
      if (!/^- /.test(l)) return;
      items++;
      // 🚫 Decided-no legitimately records things that were resolved by deciding NOT to do them.
      if (/Decided-no/.test(section)) return;
      // The real archive vocabulary, counted 2026-07-28 22:10 EDT in docs/archive/resolved-list.md: DONE ×5, SHIPPED ×3, RESOLVED ×2, FIXED ×1, DROPPED ×1. The first pass matched neither DONE nor DROPPED — i.e. it missed the single most common marker in the corpus.
      //
      // Two guards against the obvious false positives, both taken from real text in these files:
      //   - "NOT DONE" / "not yet done" describe REMAINING scope (db-deferred-list.md L214 says exactly "❌ NOT DONE — the real remaining scope"). Negations must not read as completion.
      //   - the bare word alone is too loose, so a date or a version must follow it closely. Every genuine marker in the archive does that: "→ **DONE 2026-07-27 20:20 EDT.**", "— SHIPPED 2026-07-28 15:52 EDT as v2.41.0.", "**FIXED 2026-07-17 (v2.20.0)**".
      if (/\b(NOT|NEVER)\s+(DONE|SHIPPED|RESOLVED|FIXED|COMPLETED)\b/i.test(l)) return;
      if (/\b(SHIPPED|RESOLVED|FIXED|COMPLETED|DONE|DROPPED)\b[^.\n]{0,40}?(20\d{2}-\d{2}-\d{2}|\bv\d+\.\d+)/.test(l)) {
        out.push({
          msg: `db-deferred-list L${i + 1} (${section.trim()}) is marked done but is still in the active list: ` +
            `"${l.slice(0, 90).replace(/\s+/g, " ")}…". Closed items move to docs/archive/resolved-list.md.`,
        });
      }
    });
    return { findings: out, examined: items };
  }
);

/* --------------------------- tag-integrity -------------------------- */
check(
  "tag-integrity",
  "ERROR",
  "each release tag points at a commit whose package.json matches it",
  () => {
    const tags = git("tag", "--list", "v*").split("\n").filter(Boolean);
    if (isShallow()) {
      return { findings: [], skipped: `shallow clone — only ${tags.length} tag(s) visible; tag integrity NOT verified. CI uses fetch-depth: 0` };
    }
    const out = [];
    for (const tag of tags) {
      if (KNOWN_BAD_TAGS.has(tag)) continue;
      if (!/^v\d+\.\d+\.\d+$/.test(tag) || cmpVer(parseVer(tag), TAG_RULE_FROM) < 0) continue;
      const pkg = git("show", `${tag}:package.json`);
      if (!pkg) continue;
      let version;
      try {
        version = JSON.parse(pkg).version;
      } catch {
        continue;
      }
      if (`v${version}` !== tag) {
        out.push({
          msg: `tag ${tag} points at a commit whose package.json reads ${version}. ` +
            `\`git show ${tag}:package.json\` is then a liar. Most likely the merge never landed and the ` +
            `tag went on the PREVIOUS release commit.`,
        });
      }
    }
    return { findings: out, examined: tags.length };
  }
);

/* --------------------------- records-present ------------------------ */
check(
  "records-present",
  "ERROR",
  "every core record file still exists at its documented path",
  () => {
    // Individual checks return quietly when their file is absent, which is right — otherwise deleting one record produces six confusing findings. This check is the ONE loud report, so a missing record can never be mistaken for a clean tree. Paths are hardcoded on purpose: they are exactly what the SessionStart hooks and docs/README.md depend on.
    const required = [
      "docs/README.md",
      "docs/CHANGELOG.md",
      "docs/CHANGELOG-SUMMARY.md",
      "docs/DEVLOG.md",
      "docs/ROADMAP.md",
      "docs/SESSION-START.md",
      "docs/db-deferred-list.md",
      "docs/ideas/diors-notes.md",
      "docs/archive/graveyard.md",
      "docs/archive/resolved-list.md",
      "CLAUDE.md",
    ];
    return {
      examined: required.length,
      findings: required
      .filter((f) => !existsSync(join(REPO, f)))
      .map((f) => ({
        msg: `${f} is missing. Two SessionStart hooks read docs/SESSION-START.md and the notes file BY ` +
          `PATH, so a move here is a code change — update .claude/settings.json in the same commit.`,
      })),
    };
  }
);

/* --------------------------- secrets-hygiene ------------------------ */
check(
  "secrets-hygiene",
  "ERROR",
  "the .env invariant and the tracked-config invariant both hold",
  () => {
    const out = [];
    // CLAUDE.md's hardest invariant: .env holds live secrets (BOT_TOKEN, MONGODB_URI, CLOUDINARY_URL, GITHUB_TOKEN, ATLAS_CLIENT_SECRET) and must NEVER be un-gitignored, regardless of repo visibility. It was prose-only until now, which meant nothing would notice it being undone.
    const ignored = ignoredSet([".env", ".env.dev"]);
    if (!ignored.has(".env")) {
      out.push({ msg: `.env is NOT gitignored. It carries live secrets and must never be committed — a private repo still gets cloned, and "private now" doesn't undo past exposure. Restore the rule; do not commit the file.` });
    }
    for (const f of [".env", ".env.dev"]) {
      if (git("ls-files", "--", f).trim()) {
        out.push({ msg: `${f} is TRACKED IN GIT. Secrets must not enter history under any circumstance. Rotate every credential in it, then remove it from the index.` });
      }
    }
    // The mirror invariant: the enforcement layer must stay recoverable from a fresh clone.
    for (const f of [".claude/settings.json", ".claude/settings.local.json"]) {
      if (!git("ls-files", "--", f).trim()) {
        out.push({ msg: `${f} is NOT tracked. It was deliberately un-ignored 2026-07-28 13:10 EDT so the hooks survive a fresh clone; untracked, the enforcement layer becomes unrecoverable again. NOTE the global ~/.config/git/ignore matches settings.local.json in every repo, so this needs the explicit "!" negation in .gitignore.` });
      }
    }
    // 4 invariants: .env ignored, .env/.env.dev untracked, both settings files tracked.
    return { findings: out, examined: 4 };
  }
);

/* ------------------------------ ci-wiring --------------------------- */
check(
  "ci-wiring",
  "ERROR",
  "CI still runs this audit, on every branch that needs it",
  () => {
    const ci = read(".github/workflows/ci.yml");
    if (ci === null) return [{ msg: ".github/workflows/ci.yml is missing — the audit has no CI gate, so it only ever runs inside a Claude session." }];
    const out = [];
    // Self-defence: without this, deleting the CI step silently reduces the audit to a local nicety and nothing reports it. The check that guards a gate must guard its own wiring. (?!:) is load-bearing: `\b` matches between "audit" and ":", so /npm run docs:audit\b/ is also satisfied by `npm run docs:audit:test`. Deleting the real audit step left the check silent, and the self-test caught it. Two commands sharing a prefix need an explicit negative lookahead.
    if (!/npm run docs:audit(?!:)/.test(ci)) out.push({ msg: "ci.yml no longer runs `npm run docs:audit` — the documentation gate is not enforced on PRs." });
    if (!/npm run docs:audit:test/.test(ci)) out.push({ msg: "ci.yml no longer runs `npm run docs:audit:test` — an audit whose checks have quietly died would pass everything, indistinguishable from a clean tree." });
    if (!/fetch-depth:\s*0/.test(ci)) out.push({ msg: "ci.yml checkout lost `fetch-depth: 0`. Measured: a depth-1 clone yields 42 false hash-chain errors and sees 1 tag instead of 100+." });
    // The v3 spec calls this failure out explicitly: with `main` alone, no v3 work runs CI at all, and a repo with no runs looks exactly like a repo whose runs all pass.
    const triggers = [...ci.matchAll(/branches:\s*\[([^\]]*)\]/g)].map((m) => m[1]);
    if (triggers.length && !triggers.every((t) => t.includes("v3-pre-release"))) {
      out.push({ msg: "a CI trigger branch list omits `v3-pre-release`. Every v3 feature PR targets that branch, so it would run no CI at all — and the failure is silent." });
    }
    // 4 assertions over ci.yml: audit step, self-test step, fetch-depth, branch triggers.
    return { findings: out, examined: 4 };
  }
);

/* --------------------------- doc-frontmatter ------------------------ */
// Added 2026-08-08 11:39 EDT with the front-matter rollout.
//
// WHY A KIND FIELD IS NOT REDUNDANT WITH THE FOLDER. At rest it is: `kind` must equal what the path already says, so it carries no information while a file sits still. Its whole value is at MOVE time. CLAUDE.md's own doc-taxonomy section opens by noting that "three reorganizations in two days all came from files sitting in folders whose purpose they didn't match" — and a half-finished move is precisely [[feedback_no_half_measures_on_reorgs]]. A declared kind turns that silent misclassification into a failing check: move the file and forget the field, and CI says so.
//
// It also does a second, quieter job — a file opened cold states its own TENSE CONTRACT. `frozen` on a spec is the word that stops a session "helpfully" updating a dated snapshot, which the repo currently prevents with a paragraph of prose in CLAUDE.md that nothing enforces.
//
// DELIBERATELY ABSENT: `description`. docs/README.md already carries one line per doc and `readme-map` enforces that it exists. A second copy would be duplicated state that nothing keeps in sync — exactly the failure recorded in [[feedback_no_duplicated_state_in_prose]].
const FM_KINDS = {
  rule: ["live"],
  guide: ["live"],
  record: ["live"],
  reference: ["live"],
  idea: ["live"],
  legal: ["live"],
  spec: ["frozen", "superseded"],
  // 🔴 `plan` GAINED `live` ON 2026-08-27 21:0x EDT, and the reason is the whole point of the field. Every plan here had been a frozen snapshot, which is right for a plan that is written once and then executed. It is WRONG for a plan that tracks its own execution: Harkirat asked for one that "never accidentally goes out of sync — mark off things that were done, or update the plan if anything changes midway". A frozen plan cannot do that, and forcing the status to `frozen` would have made the document lie about its own tense contract — the exact failure the field exists to prevent, pointing the other way. `spec` deliberately does NOT gain it: a dated design snapshot is superseded by a new one, never edited.
  plan: ["frozen", "superseded", "live"],
  archive: ["dead"],
};
// The location→kind rule. Kept as ordered prefixes so the first match wins, mirroring the taxonomy table in CLAUDE.md. A new docs/ subdirectory MUST be added here, and that is intentional: an unclassifiable doc is a doc whose purpose nobody has decided.
const FM_RULE = [
  [".claude/rules/", "rule"],
  ["docs/archive/", "archive"],
  ["docs/superpowers/specs/", "spec"],
  // A mockup package's COMPANION is a LIVING reference — "read this to wire it correctly", kept true against the code — not a frozen dated snapshot like specs/. That distinction is the whole point of classifying it: a stale spec is correct, a stale COMPANION is a defect.
  ["docs/superpowers/mockups/", "reference"],
  ["docs/superpowers/plans/", "plan"],
  ["docs/reference/", "reference"],
  ["docs/ideas/", "idea"],
  ["docs/legal/", "legal"],
  // A README that documents how to INSTALL the files sitting next to it is a lookup doc, and it has to live beside them: scripts/launchd/README.md is read while copying those plists, and pointing it at docs/reference/ would put the instructions one directory away from the thing they operate on. Same shape as PRODUCT.md below - placement driven by what reads it, kind driven by what it is. Added 2026-09-05 14:46 EDT.
  ["scripts/", "reference"],
];
const fmExpected = (f) => {
  for (const [prefix, kind] of FM_RULE) if (f.startsWith(prefix)) return kind;
  if (["CONTRIBUTING.md", "CONTRIBUTORS.md", "SECURITY.md"].includes(f)) return "legal";
  // PRODUCT.md is the impeccable skill's product record. It is a lookup doc (reference), but it MUST sit at the repo root: the skill's context.mjs resolves PROJECT_ROOT/PRODUCT.md and cannot be pointed at docs/reference/. Root placement is the tool's constraint, not a misfiling.
  if (f === "PRODUCT.md" || f === "DESIGN.md") return "reference";
  if (f === "CLAUDE.md") return "guide";
  if (/^docs\/[^/]+\.md$/.test(f)) return "record";
  return null;
};

check(
  "doc-frontmatter",
  "ERROR",
  "every tracked Markdown doc declares a kind/status that matches where it lives",
  () => {
    const out = [];
    let examined = 0;
    const declaredPublished = new Map();
    for (const f of tracked()) {
      if (!f.endsWith(".md")) continue;
      // Plugin-owned, on someone else's schema — not ours to annotate.
      if (f.includes("hookify")) continue;
      // Impeccable's surface briefs carry the SKILL's own front matter (version/slug/primary_target) and its writer REGENERATES that block from fixed keys on every write, so a kind:/status: added here would be dropped by the next `surface-brief.mjs write`. Tool-owned, on the tool's schema, same as hookify above. Added 2026-09-06 00:56 EDT.
      if (f.startsWith(".impeccable/")) continue;
      const expected = fmExpected(f);
      if (expected === null) {
        out.push({
          msg: `${f} sits somewhere the doc taxonomy does not describe, so its kind cannot be ` +
            `checked. Add its location to FM_RULE in scripts/docs-audit.mjs and to CLAUDE.md's ` +
            `doc-taxonomy table — an unclassifiable doc is one whose purpose was never decided.`,
        });
        continue;
      }
      const text = read(f);
      if (text === null) continue;
      examined++;
      if (!text.startsWith("---\n")) {
        out.push({ msg: `${f} has no YAML front matter; it must declare kind: ${expected}.` });
        continue;
      }
      const end = text.indexOf("\n---", 3);
      const fm = end === -1 ? "" : text.slice(4, end + 1);
      const kind = (fm.match(/^kind:\s*(\S+)/m) || [])[1];
      const status = (fm.match(/^status:\s*(\S+)/m) || [])[1];
      const supersededBy = (fm.match(/^superseded_by:\s*(\S+)/m) || [])[1];

      if (!kind) out.push({ msg: `${f} front matter declares no kind: (expected ${expected}).` });
      else if (kind !== expected) {
        out.push({
          msg: `${f} declares kind: ${kind} but its location says ${expected}. Either the file was ` +
            `moved without updating its front matter — a half-finished reorganization — or it is ` +
            `filed in the wrong folder. Both are real; fix whichever it is.`,
        });
      }
      const allowed = FM_KINDS[kind] || [];
      if (!status) out.push({ msg: `${f} front matter declares no status:.` });
      else if (kind && FM_KINDS[kind] && !allowed.includes(status)) {
        out.push({
          msg: `${f} declares status: ${status}, which is not valid for kind: ${kind} ` +
            `(allowed: ${allowed.join(", ")}).`,
        });
      }
      // A superseded document must say what replaced it, and that target must exist — otherwise "superseded" is a dead end telling a reader to go somewhere unnamed.
      if (status === "superseded" && !supersededBy) {
        out.push({ msg: `${f} is status: superseded but names no superseded_by: target.` });
      }
      if (supersededBy) {
        if (status !== "superseded") {
          out.push({ msg: `${f} names superseded_by: but its status is ${status}, not superseded.` });
        }
        // 🔴 `existsSync`/`join`, NOT `fs.`/`path.` -- this module imports them as NAMED bindings (line 49/51), so the original `fs.existsSync(path.join(ROOT, supersededBy))` referenced three identifiers that do not exist here (`fs`, `path`, and `ROOT` -- the repo root is `REPO`). It threw ReferenceError on the FIRST document to ever use superseded_by, 2026-08-23 11:36 EDT, which is also the first time this branch had ever executed: nothing in the repo carried the field, so the check was written, wired, counted among the passing gates, and never once run. A check that cannot run is not coverage.
        if (!existsSync(join(REPO, supersededBy))) {
          out.push({ msg: `${f} points superseded_by: at ${supersededBy}, which does not exist.` });
        }
      }
      declaredPublished.set(f, /^published:\s*true\b/m.test(fm));
    }

    // `published: true` marks a doc that renders to the live dioreo.app site. It exists so a session editing CONTRIBUTING.md or the Privacy Policy can see, at the top of the file, that the change is publicly visible — that fact previously lived only inside buildLegalPages.js.
    //
    // ⚠️ It is CROSS-CHECKED against the generator's own page tables rather than against a list kept here, so the field cannot quietly disagree with what actually publishes. A second hand-kept copy of the roster would be precisely the duplicated state this schema avoids elsewhere. A tree with no generator (a fixture) legitimately has nothing to cross-check, so its absence is not a finding here — the build, `scripts-documented` and `ci-wiring` all fail loudly if it vanishes from the real repo. The vacuous-pass risk that DOES matter is a generator that exists but yields no sources, which is caught explicitly below.
    const gen = read("scripts/buildLegalPages.js");
    if (gen !== null) {
      const declaredInGenerator = new Set();
      for (const m of gen.matchAll(/file:\s*'([^']+\.md)'/g)) {
        const bare = m[1];
        const full = [...declaredPublished.keys()].find((t) => t === bare || t.endsWith("/" + bare));
        if (full) declaredInGenerator.add(full);
      }
      if (declaredInGenerator.size === 0) {
        out.push({
          msg: `no published Markdown sources could be read out of scripts/buildLegalPages.js, so ` +
            `the published: field verified NOTHING this run. Its page tables were probably ` +
            `reshaped — update this check in the same change rather than leaving it vacuous.`,
        });
      }
      for (const [f, isPublished] of declaredPublished) {
        const shouldBe = declaredInGenerator.has(f);
        if (shouldBe && !isPublished) {
          out.push({
            msg: `${f} is rendered to the live site by buildLegalPages.js but does not declare ` +
              `published: true. Anyone editing it cannot tell the change is publicly visible.`,
          });
        } else if (!shouldBe && isPublished) {
          out.push({
            msg: `${f} declares published: true but buildLegalPages.js does not render it. Either ` +
              `the field is stale or the page was dropped from the site.`,
          });
        }
      }
    }
    return { findings: out, examined };
  }
);

/* -------------------------- memory-softwrap ------------------------- */
// Added 2026-08-08 12:56 EDT, Harkirat: "github ci can't check outside the repo, BUT WE CAN, no? so why not implement it in one of the checks you conduct locally?" — answering my own claim that the memory store could not be covered, which was me letting the WEAKEST consumer set the bar. This audit runs locally before every PR; CI is not the only reader.
//
// The memory store was reflowed to soft-wrapped prose alongside the repo (v2.63.0). Nothing stopped it drifting back, and drift there is invisible: memory files never appear in a git diff, so the one signal that surfaces everything else in this repo does not exist for them.
//
// ⚠️ It DIFFERS from its sibling memory checks on purpose. They skip outright under DOCS_AUDIT_ROOT ("the memory store is machine-global, not part of this tree"), which also means they can never be proven by the self-test and live on the exempt list. This one resolves to `<root>/memory` under a fixture instead, so `proves()` exercises the real logic. A proven check beats an exempt one.
//
// Severity is WARN, not ERROR: hard-wrapped memory is a searchability loss, not a correctness defect, and it is unreachable from CI — an ERROR that can only ever fire on one machine would block merges for a reason the runner cannot even see.
const MEMORY_WRAP_DIR = process.env.DOCS_AUDIT_ROOT ? join(REPO, "memory") : MEMORY_DIR;

check(
  "memory-softwrap",
  "WARN",
  "memory files are soft-wrapped, the same as the repo's prose",
  () => {
    if (!existsSync(MEMORY_WRAP_DIR)) {
      return {
        findings: [],
        skipped: `no memory store at ${MEMORY_WRAP_DIR} — expected on CI, where it is machine-global and absent. NOT a pass.`,
      };
    }
    const out = [];
    let examined = 0;
    for (const name of readdirSync(MEMORY_WRAP_DIR)) {
      if (!name.endsWith(".md")) continue;
      const p = join(MEMORY_WRAP_DIR, name);
      let text;
      try { text = readFileSync(p, "utf8"); } catch { continue; }
      examined++;
      // Same rule the repo uses: if reflowing would change it, it is not soft-wrapped. Reusing the real implementation rather than a second heuristic keeps the two from disagreeing.
      if (reflow(text) !== text) {
        out.push({
          msg: `${name} is hard-wrapped. Memory is prose and is searched with \`rg\`, so a phrase ` +
            `split across a wrap boundary cannot be found. Fix: ` +
            `node scripts/reflow-prose.mjs --write "${MEMORY_WRAP_DIR}"/*.md`,
        });
      }
    }
    return { findings: out, examined };
  }
);

/* --------------------------- notes-line-refs ------------------------ */
// Added 2026-08-08 12:10 EDT, after the soft-wrap reflow made the problem impossible to ignore.
//
// Code comments and docs had accumulated 22 breadcrumbs of the form "notes L184" pointing into docs/ideas/diors-notes.md. That file is a SCRATCHPAD — items are added, marked, and swept out constantly — so a line number in it is stale the moment anything above it changes. They were already unreliable; reflowing the tree moved the file from 200+ lines to 159 and made 13 of them point past the end of the file, which is how they finally became visible.
//
// The durable fix is not "renumber them" but "stop addressing a moving file by offset". Quote a few words of the item instead — that survives edits, and it still says which item you meant.
//
// Records and the archive are exempt: CHANGELOG/DEVLOG entries and swept graveyard items are statements about what was true on a date, and back-editing them would be falsifying history.
check(
  "notes-line-refs",
  "ERROR",
  "no live doc or comment addresses the notes scratchpad by line number",
  () => {
    const exempt = (f) =>
      f === "docs/CHANGELOG.md" ||
      f === "docs/CHANGELOG-SUMMARY.md" ||
      f === "docs/DEVLOG.md" ||
      f === "docs/ideas/diors-notes.md" ||
      f.startsWith("docs/archive/") ||
      f.startsWith("docs/superpowers/") ||
      f.startsWith("public/") ||
      // This check and its self-test both have to WRITE the offending pattern in order to define and prove it. Same shape as outstanding-not-filed.sh stripping quoted spans: describing a violation is not committing one.
      f === "scripts/docs-audit.mjs" ||
      f === "scripts/docs-audit.test.mjs";
    const out = [];
    let examined = 0;
    for (const f of tracked()) {
      if (!/\.(js|mjs|md|sh)$/.test(f) || exempt(f)) continue;
      const text = read(f);
      if (text === null) continue;
      examined++;
      const hits = text.match(/notes L\d+/g);
      if (hits) {
        out.push({
          msg: `${f} cites ${[...new Set(hits)].join(", ")} — a line number in the notes ` +
            `scratchpad, which shifts on every edit to that file. Quote a few words of the item ` +
            `instead; that survives edits and still identifies which item you meant.`,
        });
      }
    }
    return { findings: out, examined };
  }
);

/* ------------------------- generator-artifact ----------------------- */
check(
  "generator-artifact",
  "ERROR",
  "no uninterpolated heredoc expression reached a tracked file",
  () => {
    // 🔴 THE EDITING TECHNIQUE THIS REPO MANDATES CAN EMIT ITS OWN SOURCE. The batching contract says any multi-file edit goes through a `python3` heredoc, so nearly every doc and script here is written by a generator -- and a mis-quoted f-string, or a concatenation that lands inside a literal instead of around it, ships the EXPRESSION rather than its value. One did exactly that in this file's own comments and survived a full `npm test`, a `docs:audit` and a comment-reflow pass, because to every gate it reads as ordinary prose. Added 2026-09-02 20:31 EDT.
    //
    // ⚠️ MY FIRST TWO NEEDLES WERE BOTH WRONG, IN OPPOSITE DIRECTIONS, AND THE RUN THAT CAUGHT THEM IS WHY THIS COMMENT EXISTS. `${STAMP}` flagged `.claude/hooks/ctx-index-refresh.sh`, where it is a perfectly ordinary SHELL VARIABLE -- a detector that cannot tell its target from valid code. And a bare triple-quote fragment flagged this file, because documenting the pattern spells it. Third detector today that did not match its own intent. The shape is pinned precisely now, and a line may opt out with GEN-EXAMPLE -- the same per-line, deliberately-typed, greppable escape `timestamp-check.sh` uses, for the identical reason: prose ABOUT a bad pattern must be able to quote it.
    const SHAPE = /"{3}\s*\+\s*[A-Za-z_$][\w$]*\s*\+\s*"{3}|'{3}\s*\+\s*[A-Za-z_$][\w$]*\s*\+\s*'{3}/;
    const out = [];
    for (const f of tracked()) {
      if (!/\.(md|mjs|js|sh|json)$/.test(f)) continue;
      const t = read(f);
      if (t === null) continue;
      t.split("\n").forEach((line, n) => {
        if (line.includes("GEN-EXAMPLE")) return;
        if (SHAPE.test(line)) out.push({ msg: `${f}:${n + 1} carries an uninterpolated generator expression — the heredoc that wrote this line emitted its own source instead of the value. If the line is deliberately quoting the pattern, mark it GEN-EXAMPLE.` });
      });
    }
    return out;
  }
);

/* ----------------------------- rule-globs --------------------------- */
check(
  "rule-globs",
  "ERROR",
  "every .claude/rules glob still matches a real file",
  () => {
    // A path-scoped rule loads ONLY when you open a matching file. If a glob matches nothing — because the code it described was renamed or deleted — the rule silently never loads again, and the subsystem's "why" notes quietly stop reaching anyone. Same dead-guard shape, applied to docs.
    const files = tracked();
    // ONE pass, no placeholder character. The previous version used a NUL byte as a sentinel between the `**` and `*` substitutions — functionally fine, but it made this source file BINARY to ripgrep ("binary file matches", no results shown). In a project whose CLAUDE.md mandates `rg` as the primary search tool, the enforcement script had quietly made itself unsearchable. See the `binary-in-text` check below, which now makes that impossible to reintroduce anywhere.
    const toRe = (g) =>
      new RegExp(
        "^" +
          g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*|\*/g, (m) => (m === "**" ? ".*" : "[^/]*")) +
          "$"
      );
    const out = [];
    let globCount = 0;
    for (const rule of files.filter((f) => f.startsWith(".claude/rules/") && f.endsWith(".md"))) {
      const text = read(rule);
      if (text === null) continue;
      const fm = text.split("---")[1] || "";
      const inline = (fm.match(/paths:\s*\[([^\]]+)\]/) || [])[1];
      const listed = [...fm.matchAll(/^\s*-\s*(\S+)\s*$/gm)].map((m) => m[1]);
      const globs = (inline ? inline.split(",") : listed).map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
      // A rule with NO `paths:` is legal and documented -- it loads unconditionally at launch, at the same priority as `.claude/CLAUDE.md`. This check predates that being known and treated every rule as path-scoped, so it reported the first genuinely unconditional rule as broken.
      //
      // It still ERRORS on an empty `paths:` by DEFAULT, because the far more likely cause is a rule whose globs were deleted or never written -- and that rule then never loads for anything, silently, which is the dead-guard shape this check exists for. `unconditional: true` is how a rule says the emptiness is deliberate: one line, visible in the frontmatter and in any diff, so intent and accident can never look the same. Added 2026-09-02 15:58 EDT with the first such rule (`silent-mode.md`, an instruction that applies to every turn rather than to one subsystem).
      if (!globs.length) {
        if (/^\s*unconditional:\s*true\s*$/m.test(fm)) continue;
        out.push({ msg: `${rule} declares no \`paths:\` globs, so it never auto-loads for any file. If that is deliberate -- an instruction that applies to every turn rather than a trap for one subsystem -- add \`unconditional: true\` to its frontmatter so the intent is explicit and a rule whose globs were simply LOST still fails.` });
        continue;
      }
      globCount += globs.length;
      for (const g of globs) {
        let re;
        try {
          re = toRe(g);
        } catch {
          continue;
        }
        if (!files.some((f) => re.test(f))) {
          out.push({ msg: `${rule} scopes to \`${g}\`, which matches no tracked file — that rule will never load again.` });
        }
      }
    }
    return { findings: out, examined: globCount };
  }
);

/* --------------------------- memory-index --------------------------- */
check(
  "memory-index",
  "WARN",
  "MEMORY.md indexes every memory file, and every index link resolves",
  () => {
    // Skipped where the store is absent (CI, fresh clone) — see MEMORY_DIR. Locally it is a real check: MEMORY.md is what gets loaded into context each session, so a memory file missing from it is a memory that effectively does not exist, and a dangling link is a pointer into nothing.
    if (process.env.DOCS_AUDIT_ROOT) {
      return { findings: [], skipped: "auditing a foreign tree (DOCS_AUDIT_ROOT); the memory store is machine-global, not part of it" };
    }
    if (!existsSync(MEMORY_DIR)) {
      return { findings: [], skipped: "memory store not present — the index was NOT verified" };
    }
    const idxPath = join(MEMORY_DIR, "MEMORY.md");
    if (!existsSync(idxPath)) {
      return [{ msg: `the memory store has no MEMORY.md index — CLAUDE.md's canonical-memory-path sanity test treats that as being at the WRONG PATH.` }];
    }
    const idx = readFileSync(idxPath, "utf8");
    const linked = new Set([...idx.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]));
    const out = [];
    for (const f of readdirSync(MEMORY_DIR)) {
      if (!f.endsWith(".md") || f === "MEMORY.md" || f.startsWith("_")) continue;
      if (!linked.has(f)) out.push({ msg: `memory/${f} exists but has no pointer line in MEMORY.md — it will not be surfaced at session start.` });
    }
    for (const l of linked) {
      if (!existsSync(join(MEMORY_DIR, l))) out.push({ msg: `MEMORY.md links to ${l}, which no longer exists in the store.` });
    }
    return { findings: out, examined: linked.size };
  }
);

/* -------------------------- nested-worktree ------------------------- */
check(
  "nested-worktree",
  "WARN",
  "no git worktree lives inside the repo working tree",
  () => {
    // Found 2026-07-28 22:45 EDT: a live worktree at .claude/worktrees/co-authored-commits-f280b2 holding an OLD copy of CLAUDE.md. It is excluded via .git/info/exclude, so it is invisible to a normal search — but CLAUDE.md itself instructs searching with `--hidden --no-ignore`, which surfaces the stale duplicate and can send a session editing the wrong file. Advisory, because removing someone else's worktree is destructive and is Harkirat's call, not the audit's. --porcelain, NOT the human format. This repo lives at "/Applications/Claude Code/Diors-Builds" — the path contains a SPACE — so `line.split(" ")[0]` yields "/Applications/Claude" and every comparison below silently fails. That is exactly how this check shipped dead in its first version, and the self-test could not catch it because fixtures were built in a space-free tmpdir. Fixtures now deliberately contain a space. realpath BOTH sides. git reports fully-resolved paths, but REPO may still contain a symlink -- on macOS every temp dir does (/var -> /private/var), so an unresolved comparison silently matched nothing and this check reported clean against a fixture that literally had a nested worktree.
    let base;
    try { base = realpathSync(REPO); } catch { base = REPO; }
    const allWt = git("worktree", "list", "--porcelain")
      .split("\n")
      .filter((l) => l.startsWith("worktree "))
      .map((l) => l.slice("worktree ".length).trim());
    return {
      examined: allWt.length,
      findings: allWt
      .filter((p) => p !== base && p.startsWith(base + "/"))
      .map((p) => ({
        msg: `a git worktree is nested inside this repo at ${p.slice(REPO.length + 1)}. It holds a ` +
          `second copy of tracked files (CLAUDE.md, .gitignore, docs/) that an \`rg --hidden ` +
          `--no-ignore\` sweep will surface as if it were live. Remove it with \`git worktree remove\` ` +
          `once its branch is merged, or move it outside the repo.`,
      })),
    };
  }
);

/* ---------------------------- version-sync -------------------------- */
check(
  "version-sync",
  "ERROR",
  "package.json matches the newest changelog entry",
  () => {
    const ch = read("docs/CHANGELOG.md");
    const pkgRaw = read("package.json");
    if (ch === null || pkgRaw === null) return [];
    let pkg;
    try {
      pkg = JSON.parse(pkgRaw).version;
    } catch {
      return [{ msg: "package.json is not valid JSON." }];
    }

    // Whichever heading style appears FIRST is the newest entry. During v3 pre-release the changelog uses "## Pre-Release v3.1.0" and package.json carries "3.1.0-pre"; on main it is "## v2.42.0" and a bare "2.42.0". Both are valid, and conflating them would fail CI on every v3 PR.
    const normal = ch.match(/^## (v\d+\.\d+\.\d+)/m);
    const pre = ch.match(/^## Pre-Release (v\d+\.\d+\.\d+)/m);
    const firstIdx = (m) => (m ? ch.indexOf(m[0]) : Infinity);
    const isPre = firstIdx(pre) < firstIdx(normal);
    const newest = isPre ? pre && pre[1] : normal && normal[1];
    if (!newest) return [];

    const expected = isPre ? `${newest.slice(1)}-pre` : newest.slice(1);
    if (pkg !== expected) {
      return [{
        msg: `package.json reads "${pkg}" but the newest changelog entry is ${isPre ? "Pre-Release " : ""}` +
          `${newest}, so it should read "${expected}". One version per merged PR — a bump without an ` +
          `entry (or an entry without a bump) is how the 16 two-commit releases v2.33.0–v2.35.15 happened.`,
      }];
    }
    return { findings: [], examined: 1 };
  }
);

/* ---------------------------- tag-coverage -------------------------- */
check(
  "tag-coverage",
  "ERROR",
  "every released version has a git tag",
  () => {
    const ch = read("docs/CHANGELOG.md");
    if (ch === null) return [];
    if (isShallow()) {
      return { findings: [], skipped: "shallow clone — no tags fetched; tag coverage NOT verified" };
    }
    // Pre-Release entries are deliberately excluded: no tags are minted until v3.0.0 ships.
    const versions = [...ch.matchAll(/^## (v\d+\.\d+\.\d+)/gm)].map((m) => m[1]);
    const tags = new Set(git("tag", "--list", "v*").split("\n").filter(Boolean));
    // The newest entry is legitimately untagged between writing the entry and merging: the tag goes on the squash commit, which does not exist yet. Everything older must be tagged.
    return {
      examined: Math.max(0, versions.length - 1),
      findings: versions
      .slice(1)
      .filter((v) => !tags.has(v))
      .map((v) => ({
        msg: `${v} has a changelog entry but NO git tag. Only the newest entry may be untagged ` +
          `(its squash commit does not exist until the merge). Tag it, or the release is unreachable ` +
          `by \`git show ${v}\`.`,
      })),
    };
  }
);

/* --------------------------- hook-integrity ------------------------- */
check(
  "hook-integrity",
  "ERROR",
  "every hook script referenced in .claude/settings.json exists and is executable",
  () => {
    const raw = read(".claude/settings.json");
    if (raw === null) return [];
    let settings;
    try {
      settings = JSON.parse(raw);
    } catch (e) {
      // A malformed settings.json disables EVERY hook at once, silently. That is the single highest-blast-radius failure in the enforcement layer, so it is an error in its own right.
      return [{ msg: `.claude/settings.json is not valid JSON (${e.message}) — this disables every hook at once.` }];
    }
    const out = [];
    const blob = JSON.stringify(settings.hooks || {});
    const seen = new Set();
    // Anchored on ".claude/hooks/" itself rather than a greedy prefix. The greedy version was `[^"' ]*\.claude\/hooks\/...`, which stops at a SPACE — and this repo's path has one, so it was matching "Code/Diors-Builds/.claude/hooks/x.sh" and only worked because of the slice below. Correct by accident is one refactor away from correct by nothing.
    for (const m of blob.matchAll(/\.claude\/hooks\/[A-Za-z0-9_.-]+\.(?:sh|mjs|js)/g)) {
      const rel = m[0];
      if (seen.has(rel)) continue;
      seen.add(rel);
      const abs = join(REPO, rel);
      if (!existsSync(abs)) {
        out.push({ msg: `.claude/settings.json registers ${rel}, which DOES NOT EXIST — that hook silently never runs.` });
        continue;
      }
      if (!(statSync(abs).mode & 0o111)) {
        out.push({ msg: `${rel} is registered as a hook but is NOT executable — it will fail silently at the moment it should fire.` });
      }
    }
    // Also: a hook delegating to this audit with a check id that doesn't exist is a dead gate.
    const ids = new Set(checks.map((c) => c.id));
    for (const m of blob.matchAll(/--only\s+([a-z-]+)/g)) {
      if (!ids.has(m[1])) {
        out.push({ msg: `a hook calls docs-audit with --only ${m[1]}, which is not a known check id — that gate is dead.` });
      }
    }
    return { findings: out, examined: seen.size };
  }
);

/* --------------------------- binary-in-text ------------------------- */
check(
  "binary-in-text",
  "ERROR",
  "no tracked text file contains a NUL byte (which makes it invisible to ripgrep)",
  () => {
    // Found 2026-07-29 00:05 EDT, in THIS script. `rule-globs` used a NUL as a placeholder between two regex substitutions — functionally fine, and it made docs-audit.mjs BINARY to ripgrep, which reports "binary file matches" and shows nothing. In a project whose CLAUDE.md mandates `rg` as the primary search tool, the enforcement script had silently made ITSELF unsearchable. Nothing would ever have surfaced that; it is invisible to the very tool you would look with.
    const exts = /\.(md|js|mjs|cjs|json|sh|ya?ml|txt|html|css)$/i;
    const files = tracked().filter((f) => exts.test(f));
    const out = [];
    for (const f of files) {
      const p = join(REPO, f);
      if (!existsSync(p)) continue;
      const buf = readFileSync(p);
      const at = buf.indexOf(0);
      if (at !== -1) {
        out.push({
          msg: `${f} contains a NUL byte at offset ${at}. ripgrep treats it as BINARY and will not show ` +
            `matches, so this file is effectively unsearchable — use a printable sentinel, or restructure ` +
            `to need none.`,
        });
      }
    }
    return { findings: out, examined: files.length };
  }
);

/* ----------------------------- root-docs ---------------------------- */
check(
  "root-docs",
  "ERROR",
  "every authoritative root-level document is named in CLAUDE.md or docs/README.md",
  () => {
    // The gap a LIVE parallel session exposed 2026-07-29 00:10 EDT: another branch added LICENSE, NOTICE, CONTRIBUTING.md and CONTRIBUTORS.md at the repo root, and this audit — which only ever looked under docs/ — saw none of them. Root-level records are the most authoritative documents in the repo and were the least watched.
    const claude = read("CLAUDE.md");
    const readme = read("docs/README.md");
    if (claude === null || readme === null) return { findings: [], examined: 0 };
    const roots = tracked().filter(
      (f) => !f.includes("/") && (/\.(md|txt)$/i.test(f) || /^(LICENSE|NOTICE|COPYING)$/i.test(f)) && f !== "CLAUDE.md"
    );
    const out = roots
      .filter((f) => !claude.includes(f) && !readme.includes(f))
      .map((f) => ({
        msg: `${f} sits at the repo root but is named in neither CLAUDE.md nor docs/README.md. A ` +
          `top-level record nobody maps is a record nobody is told to maintain.`,
      }));
    return { findings: out, examined: roots.length };
  }
);

/* -------------------------- top-level-dirs -------------------------- */
check(
  "top-level-dirs",
  "ERROR",
  "every tracked top-level directory is described somewhere",
  () => {
    // Same live lesson: the parallel branch also added an entire `public/` tree. A new top-level directory is the single largest unit of growth a repo has, and nothing was watching for one.
    const claude = read("CLAUDE.md");
    const readme = read("docs/README.md");
    if (claude === null || readme === null) return { findings: [], examined: 0 };
    const dirs = [...new Set(tracked().filter((f) => f.includes("/")).map((f) => f.split("/")[0]))].sort();
    const out = dirs
      .filter((d) => !claude.includes(d + "/") && !readme.includes(d + "/"))
      .map((d) => ({
        msg: `top-level directory \`${d}/\` is tracked but described in neither CLAUDE.md nor ` +
          `docs/README.md. Add it to the navigation map, or a future session has no idea what it is for.`,
      }));
    return { findings: out, examined: dirs.length };
  }
);

/* ------------------------ scripts-documented ------------------------ */
check(
  "scripts-documented",
  "ERROR",
  "every script is mentioned in some rule file or doc",
  () => {
    // `.claude/rules/scripts-and-migrations.md` is explicitly a POINTER MAP — "which subsystem rule documents each script". So the correct test is "named SOMEWHERE", not "named in that file": `checkEmojiCaptures.js` is documented in rendering-and-ui.md, and a narrower check would have reported it falsely. 🔴 RAISED WARN → ERROR 2026-09-04 20:18 EDT. The old justification was "a brand-new script legitimately lands before its docs do" — but the documenting edit is in the same working tree as the script, so "before" is a window of minutes that only exists if somebody chooses to leave it open. Against that: **a WARN with a green exit is invisible to this repo's own discipline of reading the exit code and never the tail.** `docs:audit` ran eight times in one session while this check warned about a file that session had just created, and every one of those runs was read as clean. The check was correct and unheard, which is the failure mode a warning has. At the moment of the raise the tree had **0 undocumented scripts of 172**, so this costs nothing today and only ever costs one line in the pointer map.
    const scripts = tracked().filter((f) => f.startsWith("scripts/") && /\.(js|mjs|sh)$/.test(f));
    const corpus = tracked()
      .filter((f) => f === "CLAUDE.md" || f.startsWith(".claude/rules/") || f.startsWith("docs/"))
      .map((f) => read(f) || "")
      .join("\n");
    const out = scripts
      .filter((s) => !corpus.includes(s.split("/").pop()))
      .map((s) => ({
        msg: `${s} is tracked but named in no rule file or doc. Add it to the pointer map in ` +
          `.claude/rules/scripts-and-migrations.md, or to whichever subsystem rule owns it.`,
      }));
    return { findings: out, examined: scripts.length };
  }
);

/* --------------------------- nav-map-sync --------------------------- */
check(
  "nav-map-sync",
  "ERROR",
  "CLAUDE.md's nav map and docs/README.md both list every path-scoped rule file",
  () => {
    // Path-scoped rules only load when you touch a matching file, so a rule missing from the nav map is invisible until someone happens to open the right file. Adding a 14th rule would have left both indexes stale with nothing reporting it.
    const claude = read("CLAUDE.md");
    const readme = read("docs/README.md");
    if (claude === null || readme === null) return { findings: [], examined: 0 };
    const rules = tracked()
      .filter((f) => f.startsWith(".claude/rules/") && f.endsWith(".md"))
      .map((f) => f.split("/").pop());
    const out = [];
    for (const r of rules) {
      if (!claude.includes(r)) out.push({ msg: `.claude/rules/${r} is missing from CLAUDE.md's 🗺️ navigation map.` });
      if (!readme.includes(r.replace(/\.md$/, ""))) out.push({ msg: `.claude/rules/${r} is missing from docs/README.md's rules list.` });
    }
    // A hardcoded count in that README row is duplicated state and rots the moment a rule is added.
    const claimed = (readme.match(/(\d+) files \(commands-overview/) || [])[1];
    if (claimed && Number(claimed) !== rules.length) {
      out.push({
        msg: `docs/README.md hardcodes "${claimed} files" for .claude/rules/ but there are ${rules.length}. ` +
          `Delete the number rather than correcting it — see feedback_no_duplicated_state_in_prose.`,
      });
    }
    return { findings: out, examined: rules.length };
  }
);

/* ------------------------- claude-md-shape -------------------------- */
export const CLAUDE_MD_SECTION_MAX = 130;
check(
  "claude-md-shape",
  "ERROR",
  "no CLAUDE.md section has grown into subsystem detail that belongs in a rule file",
  () => {
    // ⚠️ THIS EXISTS BECAUSE THE RULE WAS PROSE-ONLY AND DEGRADED EXACTLY AS PROSE RULES DO (2026-08-01 23:40 EDT). CLAUDE.md's own opening states it is "invariants + a navigation map", cut from ~3,300 lines in the 2026-07-22 modularization so that sessions stop paying for detail they will never use — it is the one file loaded IN FULL every session. Nothing checked it. The `public/` section grew to 286 lines, 43% of the whole file, across many sessions, and every other gate stayed green: nav-map-sync only fires once a rule file EXISTS and is unlisted, so it cannot see detail that was never moved into one.
    //
    // The threshold is DERIVED, not guessed. Measured on the tree the day this was added: the offending section was 285 lines and the largest legitimate one — the git workflow, a genuine hard invariant that must survive /compact — was 102. 130 sits clear of the real invariants and well under the failure, so it fires long before a section reaches the size that prompted this.
    //
    // It counts `###` sections because that is the grain the file is organised in. A section over the limit is not automatically wrong, it is a prompt: either it is genuinely a hard invariant that must be re-injected after /compact, or it is subsystem craft and belongs in `.claude/rules/`.
    const claude = read("CLAUDE.md");
    if (claude === null) return { findings: [], examined: 0 };
    const lines = claude.split("\n");
    const secs = [];
    let cur = null, n = 0, at = 0;
    const close = () => { if (cur !== null) secs.push({ title: cur, n, at }); };
    lines.forEach((l, i) => {
      if (l.startsWith("### ")) { close(); cur = l.slice(4).trim(); n = 0; at = i + 1; }
      else if (cur !== null) n++;
    });
    close();
    const out = secs
      .filter((s) => s.n > CLAUDE_MD_SECTION_MAX)
      .map((s) => ({
        msg: `CLAUDE.md:${s.at} "${s.title.slice(0, 60)}" is ${s.n} lines (limit ${CLAUDE_MD_SECTION_MAX}). ` +
          "This file is loaded in full EVERY session. If it is subsystem detail, move it to a " +
          "path-scoped .claude/rules/*.md and leave a pointer plus any safety line that must " +
          "survive /compact. If it genuinely is a hard invariant, tighten it.",
      }));
    // ⚠️ examined is the LINE count, not the section count, and the self-test's evidence ledger is what forced that. A CLAUDE.md with no `###` headings at all would have examined 0 sections and reported a pass that verified nothing — a vacuous pass, which this suite treats as a failure. The check reads every line of the file to find its sections, so lines are what it examined.
    return { findings: out, examined: lines.length };
  }
);

/* -------------------------- chronicle-drift ------------------------- */
// ⚠️ SUPPRESSED IN THE REAL REPO — 2026-08-06 00:18 EDT, Harkirat's call.
//
// WHY. The three chronicle pages are withdrawn from the nav and are waiting on the journey-pages rework. Until that starts, this meter reports the same known drift on every single run, and it grows by one line per release. A warning that is always present and always expected trains everyone to read past the whole WARN block — which is worse than no warning at all, because it camouflages the NEXT one. That is the failure this file exists to prevent, so leaving it noisy was not the safe option it looks like.
//
// ⚠️ SUPPRESSED, NOT DELETED, AND NOT SILENT — the three properties that keep this from becoming a dead gate:
//   1. It still RUNS and still examines both pairs, so the vacuous-pass detector keeps watching it. A broken matcher here would still surface as "examined 0".
//   2. It still PRINTS one line per run stating how far behind the pages are. The state stays visible; only the WARN finding is withheld.
//   3. It is gated on DOCS_AUDIT_ROOT being ABSENT, so the fixture tree is untouched and docs-audit.test.mjs's `proves("a changelog entry whose built page was never regenerated")` keeps exercising the real logic. A suppression that also disabled its own failure test would be precisely the silently-dead gate this repo has already paid for twice.
//
// LIFT IT when work starts on the three journey pages. That is the trigger, and it is tracked as a reminder in docs/db-deferred-list.md — flip this to `false`, delete this block, and run `npm run site` to resync public/changelog/.
const SUPPRESS_CHRONICLE_DRIFT = !process.env.DOCS_AUDIT_ROOT;

check(
  "chronicle-drift",
  "WARN",
  "the built changelog pages still match their sources",
  () => {
    // ⚠️ WARN BY DESIGN, and this one is a deliberate allowance rather than a defect. Harkirat's call 2026-08-02 02:45 EDT: the three chronicle pages are withdrawn from the nav and reachable by nobody, so forcing a rebuild+commit of their HTML on every changelog or devlog edit is churn for output no reader is served. Both the CI freshness gate and the deploy workflow now exclude public/changelog/ for that reason.
    //
    // The cost of that allowance is that the built pages go quietly stale. This is the meter: it does not block anything, it just says how far behind they are, so the bulk resync when those pages are revived is a known quantity rather than a surprise.
    //
    // It compares the newest VERSION HEADING in each source against the rendered page — cheap, and it catches the case that actually happens (an entry added, page not rebuilt). It does not attempt a full content diff; that is what `npm run site` is for.
    const pairs = [
      ["docs/CHANGELOG.md", "public/changelog/detailed.html"],
      ["docs/CHANGELOG-SUMMARY.md", "public/changelog/index.html"],
    ];
    const out = [];
    let examined = 0;
    for (const [src, built] of pairs) {
      const a = read(src), b = read(built);
      if (a === null || b === null) continue;
      examined++;
      const newest = (a.match(/^##\s+(v\d+\.\d+\.\d+)/m) || [])[1];
      if (!newest) continue;
      if (!b.includes(newest)) {
        out.push({
          msg: `${built} does not contain ${newest}, the newest version in ${src}. The chronicle ` +
            "pages are deliberately allowed to drift while they are withdrawn from the nav — this " +
            "is the meter, not an error. Run `npm run site` and commit public/changelog/ when those " +
            "pages are revived.",
        });
      }
    }
    // Withhold the findings, but never the information — see the SUPPRESS_CHRONICLE_DRIFT note above.
    //
    // ⚠️ STDERR, NOT STDOUT, and this cost a real defect within two minutes of being written. `--json` mode writes the whole report to stdout as a single JSON document, and TWO hooks (`docs-audit-gate.sh`, `devlog-toc-check.sh`) parse it. A `console.log` here prepended a prose line to that document, so both hooks reported "DOCS AUDIT CRASHED: it did not return valid JSON" — a check that delegates is only as sound as the contract it delegates across. This check body runs in BOTH modes, unlike the summary notes further down which run only in the human path, so anything printed from inside a check must go to stderr.
    if (SUPPRESS_CHRONICLE_DRIFT && out.length) {
      console.error(
        `  · chronicle-drift SUPPRESSED (since 2026-08-06 00:20 EDT): ${out.length} of ${examined} ` +
          `chronicle page(s) behind their source. Deliberate while those pages are withdrawn from ` +
          `the nav — lift it when the journey-pages rework starts (reminder in db-deferred-list.md).`
      );
      return { findings: [], examined };
    }
    return { findings: out, examined };
  }
);

/* ------------------------- unreleased-on-main ----------------------- */
check(
  "unreleased-on-main",
  "WARN",
  "no commit sits on main without belonging to a release",
  () => {
    // Version is minted at MERGE here, one per squashed PR, and the tag lands on that commit — so after a proper merge the range newest-tag..main is EMPTY. A non-empty range means a commit reached main some other way, which in practice means a direct push. That is what happened on 2026-08-02 01:10 EDT: a docs commit went straight to main immediately after v2.47.0 was tagged, and belongs to no version and no changelog.
    //
    // ⚠️ WARN, not ERROR, and the reason matters. There is a legitimate window between `gh pr merge` and `git tag` where this is briefly true — the workflow explicitly separates those two steps, because chaining them once put a tag on the wrong commit. An ERROR here would fire during correct behaviour, get muted, and then catch nothing. The prevention lives in .claude/hooks/main-push-guard.sh; this is only the detector for when something got past it.
    if (isShallow()) return { findings: [], skipped: "shallow clone — tag history is incomplete" };
    // ⚠️ git() here returns "" on failure rather than throwing, so absence has to be tested, not caught. A try/catch around it would never fire and the check would silently treat "no tags" as "nothing unreleased" — a vacuous pass. Distinguish the two ways this cannot run. Reporting "no tags" when the real cause is "no main branch" sent me looking in the wrong place for a CI-only failure.
    if (!git("rev-parse", "--verify", "--quiet", "main").trim()) {
      return { findings: [], skipped: "no `main` branch in this checkout — not verified" };
    }
    const newest = git("describe", "--tags", "--abbrev=0", "main").trim();
    if (!newest) return { findings: [], skipped: "no tag reachable from main — nothing to measure against" };
    const commits = git("log", "--oneline", `${newest}..main`).trim();
    if (!commits) return { findings: [], examined: 1 };
    const list = commits.split("\n").filter(Boolean);
    return {
      findings: [{
        msg: `${list.length} commit(s) on main after ${newest} belong to no release: ` +
          list.map((l) => l.split(" ")[0]).join(", ") +
          ". If a merge is mid-flight this is expected and clears when you tag. Otherwise " +
          "they reached main outside the PR flow — cover them in the next release's changelog.",
      }],
      examined: 1,
    };
  }
);

/* ---------------------------- lock-version -------------------------- */
check(
  "lock-version",
  "ERROR",
  "package-lock.json carries the same version as package.json",
  () => {
    // ⚠️ FOUND AT 2.35.3 WHILE package.json READ 2.47.0 — twelve releases of silent drift, because npm only rewrites the lock's version when a dependency-touching command runs, and a release here is a hand-edited bump. `version-sync` never saw it: that check compares package.json against the changelog, and nothing looked at the lock at all.
    //
    // It does not break `npm ci`, which ignores the field — which is exactly why it went unnoticed for so long, and exactly why it needs a gate rather than a habit. It is still wrong: the lockfile is the artefact a consumer reads to know what version they resolved.
    //
    // ⚠️ FIX IT BY EDITING THE TWO VERSION FIELDS, never with `npm install --package-lock-only`. That command recomputes the whole tree from package.json's ranges and can bump transitive dependencies — which at release time silently invalidates NOTICE §1 and the licence audit.
    const pkg = read("package.json");
    const lock = read("package-lock.json");
    if (pkg === null || lock === null) return { findings: [], examined: 0 };
    let p, l;
    try { p = JSON.parse(pkg); l = JSON.parse(lock); } catch (e) {
      return { findings: [{ msg: `package.json or package-lock.json does not parse (${e.message}).` }], examined: 0 };
    }
    const out = [];
    const root = (l.packages && l.packages[""]) || {};
    if (l.version !== p.version) {
      out.push({ msg: `package-lock.json "version" is ${l.version} but package.json is ${p.version}. Edit the field; do NOT run npm install --package-lock-only at release time.` });
    }
    if (root.version && root.version !== p.version) {
      out.push({ msg: `package-lock.json packages[""].version is ${root.version} but package.json is ${p.version}. npm writes both — both have to move.` });
    }
    return { findings: out, examined: 2 };
  }
);

/* --------------------------- dep-licences --------------------------- */
// Reciprocal licences. Any of these anywhere in the tree could force source publication on terms incompatible with the source-available model this project ships under, so they are a build failure rather than a note. LGPL is included deliberately: its dynamic-linking carve-out is an argument, not a guarantee, and this is not the place to be having that argument.
const COPYLEFT = /\b(GPL|AGPL|LGPL|MPL|SSPL|CDDL|EPL|CC-BY-SA|OSL|EUPL)\b/i;
// Phrases from the licence TEXT, for packages that declare nothing in their package.json. Order matters: the copyleft names are tested first so a permissive-sounding preamble cannot mask one.
const LICENCE_TEXT = [
  [/GNU\s+AFFERO\s+GENERAL\s+PUBLIC/i, "AGPL"],
  [/GNU\s+LESSER\s+GENERAL\s+PUBLIC/i, "LGPL"],
  [/GNU\s+GENERAL\s+PUBLIC/i, "GPL"],
  [/Mozilla\s+Public\s+License/i, "MPL"],
  [/Server\s+Side\s+Public\s+License/i, "SSPL"],
  [/Common\s+Development\s+and\s+Distribution/i, "CDDL"],
  [/Eclipse\s+Public\s+License/i, "EPL"],
  [/Apache\s+License/i, "Apache-2.0"],
  [/Permission\s+is\s+hereby\s+granted,\s+free\s+of\s+charge/i, "MIT"],
  [/Redistributions\s+of\s+source\s+code\s+must\s+retain/i, "BSD"],
  [/Permission\s+to\s+use,\s+copy,\s+modify/i, "ISC"],
];

/** Resolve one installed package's licence: lock metadata → its package.json → its licence TEXT. */
function licenceOf(dir, lockEntry) {
  let l = lockEntry && lockEntry.license;
  if (!l) {
    try {
      const p = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      l = p.license || (Array.isArray(p.licenses) ? p.licenses.map((x) => x.type).join(" OR ") : null);
    } catch { /* fall through to the text */ }
  }
  if (l && typeof l === "object") l = l.type;
  if (l) return String(l);
  // ⚠️ THE TEXT FALLBACK IS NOT OPTIONAL. Two real packages in this tree — chroma-js and exif-parser — declare no licence field at all. Without this they resolve to "unknown", and a scanner that treats unknown as clean fails OPEN, which is the entire failure mode it exists to prevent. Reading the file identifies them (BSD and MIT respectively) with no allowlist and no exemption to go stale.
  let names = [];
  try { names = readdirSync(dir).filter((f) => /^(licen[sc]e|copying)/i.test(f)); } catch { return null; }
  for (const f of names) {
    let body = "";
    try { body = readFileSync(join(dir, f), "utf8").slice(0, 4000); } catch { continue; }
    for (const [re, name] of LICENCE_TEXT) if (re.test(body)) return name;
  }
  return null;
}

check(
  "dep-licences",
  "ERROR",
  "no copyleft licence has entered the dependency tree, and every package's licence is known",
  () => {
    // CLAUDE.md's licensing section required this be "re-checked whenever dependencies change" and nothing did it — last hand-verified 2026-07-28, then trusted. NOTICE §3 makes a standing claim about this tree, so it is a claim the build should be able to defend.
    const lockRaw = read("package-lock.json");
    if (lockRaw === null) return { findings: [], examined: 0 };
    let lock;
    try { lock = JSON.parse(lockRaw); } catch (e) {
      return { findings: [{ msg: `package-lock.json does not parse (${e.message}) — the tree cannot be audited.` }], examined: 0 };
    }
    const entries = Object.entries(lock.packages || {}).filter(([k]) => k.startsWith("node_modules/"));
    if (!entries.length) return { findings: [], examined: 0 };
    if (!existsSync(join(REPO, "node_modules"))) {
      return { findings: [], skipped: "no node_modules on this machine — licences NOT verified (CI installs them)" };
    }
    const out = [];
    for (const [k, v] of entries) {
      const name = k.replace(/.*node_modules\//, "");
      if (v.link) continue;                       // a workspace symlink, not a published package
      const l = licenceOf(join(REPO, k), v);
      if (!l) {
        out.push({ msg: `${name}: licence could NOT be determined from the lockfile, its package.json, or its licence file. An undetermined licence is not a permissive one — identify it by hand.` });
      } else if (COPYLEFT.test(l)) {
        out.push({ msg: `${name} is ${l}. A reciprocal licence in this tree could force source publication on terms incompatible with the source-available model (LICENSE §4, NOTICE §3). Remove it or take a deliberate decision and record it.` });
      }
    }
    return { findings: out, examined: entries.length };
  }
);

/* ------------------------ notice-attribution ------------------------ */
check(
  "notice-attribution",
  "ERROR",
  "NOTICE §1 lists every runtime dependency at the version actually installed",
  () => {
    // NOTICE is incorporated into LICENSE by reference (§7.1) and carries the Apache-2.0 attributions that discord.js and xlsx OBLIGE us to reproduce — a duty that attaches upstream and survives whatever our own licence permits. So a dependency added or bumped without regenerating NOTICE is a licence-compliance defect, not stale prose. The version is checked as well as the name because "regenerate when dependencies change" is mostly about CHANGES, and a name-only check would call a two-major-versions-stale attribution correct.
    const notice = read("NOTICE");
    const pkgRaw = read("package.json");
    if (notice === null || pkgRaw === null) return { findings: [], examined: 0 };
    const deps = Object.keys(JSON.parse(pkgRaw).dependencies || {});
    if (!deps.length) return { findings: [], examined: 0 };
    const from = notice.indexOf("1. DIRECT DEPENDENCIES");
    if (from < 0) return { findings: [{ msg: "NOTICE has no \"1. DIRECT DEPENDENCIES\" section — the attribution list cannot be located, so it cannot be verified." }], examined: 0 };
    // ⚠️ The section ends at the next LINE-INITIAL numbered heading, not at the next "2.". The first version of this searched for the literal "2." and matched inside `chrono-node 2.9.1` — the very first entry — so the section was empty and every dependency was reported missing. A check that fires on everything is as useless as one that fires on nothing, and this one did it on its first run against a NOTICE that was completely correct.
    const nextHead = /\n(\d+)\.\s+[A-Z]/g;
    nextHead.lastIndex = from + 1;
    const m = nextHead.exec(notice);
    const sec = notice.slice(from, m ? m.index : undefined);
    const lockRaw = read("package-lock.json");
    const lock = lockRaw ? JSON.parse(lockRaw) : { packages: {} };
    const out = [];
    for (const d of deps) {
      const line = new RegExp(`^\\s*${d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+([0-9][^\\s]*)`, "m").exec(sec);
      if (!line) {
        out.push({ msg: `NOTICE §1 does not list the runtime dependency \`${d}\`. Its attribution is a licence obligation, not documentation — add it and re-check §3.` });
        continue;
      }
      const installed = (lock.packages || {})[`node_modules/${d}`];
      if (installed && installed.version && installed.version !== line[1]) {
        out.push({ msg: `NOTICE §1 lists \`${d} ${line[1]}\` but the lockfile resolves ${installed.version}. Regenerate §1 (and re-check §3) — see the licensing section of CLAUDE.md.` });
      }
    }
    return { findings: out, examined: deps.length };
  }
);

/* ------------------------ privacy-inventory ------------------------- */
check(
  "privacy-inventory",
  "ERROR",
  "PRIVACY Appendix A names every field the UserPreference schema actually stores",
  () => {
    // ⚠️ THE POLICY DECLARES THIS INVARIANT ITSELF and nothing was checking it. Appendix A says it "mirrors the UserPreference schema", that it is "a transcription of it, not a summary", and it ends "That's the whole list." CLAUDE.md said drift here makes the policy "a false statement about live data collection" — and left it to whoever remembered.
    //
    // It had already drifted (found 2026-08-01 23:55 EDT): decorationColorHex and nameplateColorHex were stored and unlisted, and the four *PaletteSource fields were covered only by a parenthetical "(+ source hashes)" rather than named. Published, under a heading that claims completeness.
    //
    // The schema is read through mongoose rather than by regex on purpose: a regex that misses an unusually-formatted field fails OPEN, and failing open is the exact defect this check exists to catch. If the dependency is unavailable the check SKIPS and says so, rather than reporting a conclusion it cannot support.
    const md = read("docs/legal/PRIVACY.md");
    if (md === null) return { findings: [], examined: 0 };
    let schema;
    try {
      const require_ = createRequire(import.meta.url);
      schema = require_(join(REPO, "models/UserPreference.js")).schema;
    } catch (e) {
      return { findings: [], skipped: `could not load models/UserPreference.js (${e.code || e.message}) — inventory NOT verified` };
    }
    const stored = [...new Set(
      Object.keys(schema.paths)
        .filter((p) => !["_id", "__v"].includes(p))
        .map((p) => p.split(".")[0])
    )];
    // Bounded to the appendix's own list. Past "That's the whole list." the section discusses the site's local-storage item, whose backticked VALUES (`light`, `dark`) are not field names.
    const from = md.indexOf("## Appendix A");
    const to = md.indexOf("That's the whole list", from);
    if (from < 0 || to < 0) {
      return { findings: [{ msg: "docs/legal/PRIVACY.md: Appendix A or its closing \"That's the whole list.\" is missing — the inventory cannot be located, so it cannot be verified." }], examined: 0 };
    }
    const named = new Set(
      [...md.slice(from, to).matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)].map((m) => m[1])
    );
    const out = stored.filter((f) => !named.has(f)).map((f) => ({
      msg: `docs/legal/PRIVACY.md Appendix A does not name \`${f}\`, which UserPreference stores. ` +
        "The appendix claims to be a complete transcription of the schema, so an unlisted field makes " +
        "the published policy inaccurate about live data collection. Add it, bump the policy version, " +
        "and add a change-history row.",
    }));
    return { findings: out, examined: stored.length };
  }
);

/* --------------------- privacy-model-coverage ------------------------ */
check(
  "privacy-model-coverage",
  "ERROR",
  "any new per-user Mongoose model is disclosed somewhere in the Privacy Policy",
  () => {
    // ⚠️ THE CHECK ABOVE ONLY EVER LOOKED AT UserPreference.js BY NAME. That catches drift within the one schema everyone already knows is personal data, but a second model with its OWN user-identifying key — a future collection with a discordId/userId field — would ship with nothing checking whether the policy ever mentions it at all. Requested 2026-08-05 12:43 EDT, after auditing the six live models against the policy and finding AlertLog's data undisclosed in §5's provider table (§2.4 already described it in prose; §5's MongoDB row didn't — fixed separately, see PRIVACY.md's change history).
    //
    // The heuristic: a model whose schema paths include a field literally named discordId, userId, or user_id is "per-user", the same shape UserPreference has. SeasonalData, Loadout, BotInstance, AlertCounter and AlertLog all genuinely don't key on a user — which is WHY none of them are named in the policy today — so this check's clean baseline comes from them not matching the heuristic, not from an allow-list. It keeps working if one of them is later reshaped to key on a user, which an allow-list would not.
    const md = read("docs/legal/PRIVACY.md");
    if (md === null) return { findings: [], examined: 0 };
    const dir = join(REPO, "models");
    let files;
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".js"));
    } catch (e) {
      return { findings: [], skipped: `could not read models/ (${e.code || e.message}) — model coverage NOT verified` };
    }
    const require_ = createRequire(import.meta.url);
    const out = [];
    let examined = 0;
    for (const file of files) {
      // UserPreference is the check ABOVE's job, at the stricter field level — asserting it here too would only ever be a weaker, name-substring version of the same assertion, and the policy is not obliged to spell out an internal Mongoose class name anywhere as long as its FIELDS are all named, which the other check already verifies. This one exists for every model UserPreference.js is not.
      if (file === "UserPreference.js") continue;
      let schema;
      try {
        schema = require_(join(dir, file)).schema;
      } catch {
        continue; // not every export here is guaranteed to load standalone outside the app — skip what won't
      }
      if (!schema || !schema.paths) continue;
      // ⚠️ WIDENED 2026-08-10 15:54 EDT, from a live miss. The heuristic was the three literal names below's first group, and models/GuildSettings.js shipped storing a Discord user ID in `updatedBy` — personal data by this policy's own §2.1 reasoning — without this check ever EXAMINING it. It did not fail; it reported a VACUOUS PASS, which reads as green. The actor names in the second group are the ordinary way a schema records "who did this", so a model carrying one is holding a user ID whatever the key of the collection is. ⚠️ WIDENED AGAIN 2026-08-16, for the SECOND vacuous-pass class this check has had. The list above is every way a schema spells a RAW user id -- and models/AnalyticsEvent.js stores a PSEUDONYM (`userHash`, an HMAC of the Discord id) instead, which matched nothing, so a model built entirely out of per-user rows would have sailed past this check reporting green. A keyed hash is still personal data under GDPR Recital 26 and still has to be disclosed. The observability design named this check as the ENFORCEMENT for its privacy disclosure; without this line that enforcement did not exist.
      const isPerUser = Object.keys(schema.paths)
        .some((f) => /^(discordId|userId|user_id|userHash|updatedBy|createdBy|authorId|ownerId|actorId)$/i.test(f.split(".")[0]));
      if (!isPerUser) continue;
      examined++;
      const name = file.replace(/\.js$/, "");
      if (!md.toLowerCase().includes(name.toLowerCase())) {
        out.push({
          msg: `models/${file} stores a user-identifying field (discordId/userId/updatedBy or similar) and is not named anywhere ` +
            "in docs/legal/PRIVACY.md. A new per-user collection needs its own disclosure — extend " +
            "§2 or Appendix A the way UserPreference already is, and add a change-history row.",
        });
      }
    }
    return { findings: out, examined };
  }
);

/* ------------------------- external-anchors ------------------------- */
check(
  "external-anchors",
  "ERROR",
  "files outside this repo that its docs depend on still exist",
  () => {
    // These are referenced BY NAME from CLAUDE.md, docs/README.md, db-deferred-list.md and memory, and they all live at absolute paths that `xref` deliberately skips — so a rename or move would break every pointer with nothing reporting it. In CI none of them exist, so the whole check SKIPS and says so, rather than failing loudly for a reason that has nothing to do with the PR.
    if (!existsSync(join(process.env.HOME || "", ".claude"))) {
      return { findings: [], skipped: "no ~/.claude on this machine (CI) — external anchors NOT verified" };
    }
    const out = EXTERNAL_ANCHORS.filter((a) => !existsSync(a.path)).map((a) => ({
      msg: `${a.path} is missing — ${a.why}. Every doc pointing at it is now a dead reference.`,
    }));
    return { findings: out, examined: EXTERNAL_ANCHORS.length };
  }
);

/* ---------------------------- memory-slug --------------------------- */
check(
  "memory-slug",
  "ERROR",
  "the memory store path still matches the slug derived from this repo's location",
  () => {
    // THIS EXACT FAILURE ALREADY HAPPENED. The repo moved to /Applications/Claude Code/ on 2026-07-14, the harness derives the project folder from the repo path, and the memory store was left stranded at the old slug — read by nothing, bridged only by a note in CLAUDE.md that a session had to remember to follow. It went unnoticed for two weeks. If the repo ever moves again, this fails immediately instead.
    if (!existsSync(join(process.env.HOME || "", ".claude/projects"))) {
      return { findings: [], skipped: "no ~/.claude/projects on this machine (CI) — slug NOT verified" };
    }
    // Derive from the MAIN worktree, never the current one: in a worktree REPO is a temp path and the derived slug would be meaninglessly different. Deliberately the SCRIPT's own repo, not REPO/DOCS_AUDIT_ROOT: this check asks whether THIS checkout's memory store is correctly located, which is meaningless for a fixture or for another tree being audited. Using REPO made every temp-dir fixture look like a relocated repo.
    const scriptRepo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    let wtOut = "";
    try {
      wtOut = execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: scriptRepo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {}
    const mainWt = (wtOut.split("\n").find((l) => l.startsWith("worktree ")) || "").slice("worktree ".length).trim();
    if (!mainWt) return { findings: [], skipped: "could not determine the main worktree path" };
    const expected = join(process.env.HOME || "", ".claude/projects", mainWt.replace(/[^a-zA-Z0-9]+/g, "-"), "memory");
    if (expected === MEMORY_DIR) return { findings: [], examined: 1 };
    return {
      examined: 1,
      findings: [{
        msg: `the repo is at ${mainWt}, whose harness slug implies the memory store should be ` +
          `${expected} — but this audit and CLAUDE.md point at ${MEMORY_DIR}. Claude Code derives the ` +
          `project folder from the repo path, so the store is now orphaned: the platform will read a ` +
          `DIFFERENT directory than the one being written. Migrate the store and update CLAUDE.md, ` +
          `MEMORY_DIR here, and the SessionStart hooks together.`,
      }],
    };
  }
);

/* ------------------------ archive-conservation ---------------------- */
/* --diff only: this is a fact about a CHANGE, not about the tree. */
const CONSERVATION_PAIRS = 2; // notes -> graveyard, deferred-list -> resolved-list
const conservation = (base) => {
  const pairs = [
    { active: "docs/ideas/diors-notes.md", archive: "docs/archive/graveyard.md", verb: "swept" },
    { active: "docs/db-deferred-list.md", archive: "docs/archive/resolved-list.md", verb: "resolved" },
  ];
  const out = [];
  for (const { active, archive, verb } of pairs) {
    const diff = git("diff", "--unified=0", `${base}...HEAD`, "--", active);
    if (!diff) continue;
    // ⚠️ Both the window AND the haystack must be built the SAME way. The first version filtered short words out of the window but not out of the haystack, so a window like "open intake item long enough count" could never match a haystack still reading "... long enough to count ...". Both fingerprint matchers here had that bug and neither was ever exercised — `traceable()` only runs when the archive DID grow, and the zero-growth branch fired first every time. Caught 2026-07-29 01:10 EDT by the in-place-edit self-test.
    const words = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w.length > 2);
    const norm0 = (s) => words(s).join(" ");
    const lines = diff.split("\n");
    const minus = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).map((l) => l.slice(1).trim());
    const plus = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1).trim());

    // ⚠️ A unified diff renders an EDITED line as a removal plus an addition. Counting bare "-" lines therefore treats every in-place correction as a deleted item — caught 2026-07-29 00:55 EDT when this gate demanded a graveyard entry for a one-line path fix in the notes file. Left in, it would have taught everyone to bypass the gate, which is worse than not having it. So: a removed line that has a similar ADDED line in the same file is an edit, not a removal.
    const editedInPlace = (line) => {
      const w = words(line);
      if (w.length < 6) return false;
      const hay = plus.map(norm0).join(" ");
      for (let i = 0; i + 6 <= w.length; i++) if (hay.includes(w.slice(i, i + 6).join(" "))) return true;
      return false;
    };

    // ⚠️ A MARKDOWN HEADING IS STRUCTURE, NEVER AN ITEM, and counting one as an item made this gate fire on a project RENAME — caught 2026-08-04 16:29 EDT on v2.52.0. The active list's own H1 ("# Deferred list — Dior's Builds (db-deferred-list.md)") changed to say Dioreo, which a unified diff renders as a removal plus an addition. editedInPlace() could not pair them because the old title's six-word fingerprint contains the old NAME and the new one does not, so it was reported as an item deleted rather than resolved. The finding was false and the branch it blocked had swept its one real item correctly. Excluding headings costs no coverage: on the active side every item is a bullet (the notes file's Legend makes that explicit — "always `- [ ]`, never a bare `-`"), and deleting a sub-section takes its bullets with it, which this still catches. What it removes is a whole class of false positive — any heading edit, of which a rename is only the loudest. ⚠️ Its self-test was VACUOUS on the first attempt and the removal proof is what caught it: the fixture's own H1 is "# Notes", seven characters, dropped by the length filter below before this rule is ever reached. Never trust a conservation test that has not been watched to fail.
    const removed = minus
      .filter((l) => !/^#{1,6}\s/.test(l)) // a heading is structure, not an item
      .filter((l) => l.length > 40) // ignore whitespace/rewrap churn; real items are long
      .filter((l) => !editedInPlace(l));
    if (!removed.length) continue;

    const archiveDiff = git("diff", "--unified=0", `${base}...HEAD`, "--", archive);
    const addedLines = archiveDiff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));

    if (!addedLines.length) {
      out.push({
        msg: `this branch removes ${removed.length} substantive line(s) from ${active} but adds NOTHING to ` +
          `${archive}. An item leaves an active list only by being ${verb} into its archive — otherwise ` +
          `the tidy-up silently DELETED it. First removed line: "${removed[0].slice(0, 90)}…"`,
      });
      continue;
    }

    // "The archive grew at all" is far too weak — removing ten items and adding one line would pass. So trace each removed item into the archive by CONTENT. Compared on a normalised word stream, because a swept item is routinely rewrapped, re-bulleted, struck through, or given a mark, and an exact string match would report every genuine sweep as a deletion. Same normalisation on both sides — see the note above editedInPlace.
    const haystack = norm0(addedLines.join(" "));
    const traceable = (line) => {
      const w = words(line);
      if (w.length < 6) return true; // too short to fingerprint; don't guess
      for (let i = 0; i + 6 <= w.length; i++) {
        if (haystack.includes(w.slice(i, i + 6).join(" "))) return true;
      }
      return false;
    };
    const orphans = removed.filter((l) => !traceable(l));
    if (orphans.length === removed.length) {
      out.push({
        msg: `this branch removes ${removed.length} item(s) from ${active} and DOES add to ${archive}, ` +
          `but none of the removed text can be traced into it. That is a deletion wearing a sweep's ` +
          `clothes. First untraceable: "${orphans[0].slice(0, 90)}…"`,
      });
    } else if (orphans.length) {
      out.push({
        severity: "WARN",
        msg: `${orphans.length} of ${removed.length} line(s) removed from ${active} could not be traced ` +
          `into ${archive}. Rewording during a sweep is normal, so this is advisory — but confirm each ` +
          `one landed. First: "${orphans[0].slice(0, 90)}…"`,
      });
    }
  }
  return out;
};

/* ------------------------------ runner ------------------------------ */

const argv = process.argv.slice(2);
const arg = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1];
};
const only = arg("--only");
const base = arg("--diff");
const asJson = argv.includes("--json");

if (argv.includes("--list")) {
  for (const c of checks) console.log(`${c.severity.padEnd(5)} ${c.id.padEnd(22)} ${c.title}`);
  console.log(`\n${checks.length} checks (+ archive-conservation, which needs --diff <base>).`);
  process.exit(0);
}

// A typo'd --only used to print `check "devlog-tocs" passed` and exit 0 — so a single wrong character in a hook registration silently disabled that gate while still reporting success. That is precisely the dead-guard failure this audit exists to prevent, reproduced inside the audit itself. Exit 2 to distinguish "the tool was misused" from "the tree has findings" (exit 1).
const KNOWN_IDS = new Set([...checks.map((c) => c.id), "archive-conservation"]);
if (only && !KNOWN_IDS.has(only)) {
  console.error(`docs-audit: unknown check "${only}".\nKnown checks:\n  ${[...KNOWN_IDS].sort().join("\n  ")}`);
  process.exit(2);
}
if (only === "archive-conservation" && !base) {
  console.error(`docs-audit: --only archive-conservation requires --diff <base-ref>.`);
  process.exit(2);
}

/**
 * EVIDENCE ACCOUNTING — the answer to "how does a future session know a pass was real?"
 *
 * Until now this printed `19 checks passed`, which conflates three completely different outcomes:
 *   - VERIFIED  — the check ran and inspected N real things.
 *   - SKIPPED   — the check could not run (no memory store, shallow clone) and said nothing.
 *   - VACUOUS   — the check ran, matched ZERO things, and "passed" because there was nothing to disagree with. This is the dangerous one: reformat the docs so `xref` finds no path-shaped tokens and it passes forever, having verified nothing.
 *
 * A check may now return either a findings array (legacy) or {findings, examined, skipped}. The summary reports all three states, and a check that examined 0 items WARNS rather than passing quietly. Green is only meaningful when you can see what it looked at.
 */
const ledger = [];
const results = [];
for (const c of checks) {
  if (only && c.id !== only) continue;
  let out;
  try {
    out = c.run() || [];
  } catch (err) {
    // A crashing check must be loud. A silent pass is the failure mode this whole file exists to stop.
    out = [{ msg: `check crashed: ${err && err.message}` }];
  }
  const findings = Array.isArray(out) ? out : out.findings || [];
  const examined = Array.isArray(out) ? null : out.examined ?? null;
  const skipped = Array.isArray(out) ? null : out.skipped ?? null;
  ledger.push({ id: c.id, examined, skipped });
  for (const f of findings) results.push({ id: c.id, severity: c.severity, title: c.title, ...f });
  if (examined === 0 && !skipped && !findings.length && !c.vacuousOk) {
    results.push({
      id: c.id,
      severity: "WARN",
      title: c.title,
      msg: `VACUOUS PASS — this check ran but examined 0 items, so its "pass" verified nothing. ` +
        `Either the corpus genuinely is empty, or its matcher has stopped matching (a reformat, a ` +
        `renamed convention). Confirm which before trusting the green.`,
    });
  }
}
// archive-conservation lives outside the `checks` array because it needs a base ref, and that meant it was invisible to the evidence ledger — `--only archive-conservation` reported "0/0 checks verified", i.e. the accounting silently excluded the very check being run. Any check absent from the ledger is a check whose pass cannot be audited, which is the whole problem this ledger exists to solve.
if (base && (!only || only === "archive-conservation")) {
  const found = conservation(base);
  ledger.push({ id: "archive-conservation", examined: CONSERVATION_PAIRS, skipped: null });
  for (const f of found) {
    results.push({ id: "archive-conservation", severity: "ERROR", title: "items leave an active list only via its archive", ...f });
  }
} else if (!only) {
  ledger.push({
    id: "archive-conservation",
    examined: null,
    skipped: "no --diff <base> given; conservation is a fact about a CHANGE and cannot be read from the tree",
  });
}

const errors = results.filter((r) => r.severity === "ERROR");
const warns = results.filter((r) => r.severity === "WARN");

// The accounting line. Printed on PASS and on FAIL, because a run with findings can still be hiding skipped or vacuous checks, and those change what the findings mean.
const verified = ledger.filter((l) => !l.skipped && l.examined !== 0);
const skippedChecks = ledger.filter((l) => l.skipped);
const totalExamined = ledger.reduce((n, l) => n + (l.examined || 0), 0);
const accounting = () => {
  console.log(
    `\ndocs-audit: ${verified.length}/${ledger.length} checks verified` +
      (totalExamined ? ` (${totalExamined} items examined)` : "") +
      (skippedChecks.length ? `, ${skippedChecks.length} SKIPPED` : "") +
      "."
  );
  for (const s of skippedChecks) console.log(`  · skipped [${s.id}]: ${s.skipped}`);
  const empty = ledger.filter((l) => l.examined === 0 && !l.skipped);
  if (empty.length) console.log(`  · examined nothing (empty corpus is legitimate here): ${empty.map((e) => e.id).join(", ")}`);
  // Gitignored files are WORKING-TREE-LOCAL. In a linked worktree or a fresh clone they simply are not there, so xref reports them as unresolved — accurate, but baffling unless you know where you are running. Say it, rather than let a future session re-derive it from confusing output.
  if (isLinkedWorktree()) {
    console.log(
      `  · running in a LINKED WORKTREE — gitignored files that exist only in the main working tree ` +
        `(docs/ideas/Harkirats-Space.md, local/*) are absent here, so xref may flag them. Not staleness.`
    );
  }
  // Stated on every run, deliberately. This audit is a WHITELIST of failures that have already happened; it cannot detect a category nobody has hit yet, cannot judge whether a doc is any good, and cannot verify a judgement call. "Green" means "no known failure mode tripped" — never "the records are correct". Treating it as the latter is how a gate starts causing harm.
  console.log(
    `  · a pass means no KNOWN failure mode tripped — not that the records are correct. ` +
      `Novel drift, prose quality and judgement are outside what any of this can see.`
  );
};

if (asJson) {
  console.log(JSON.stringify({ errors: errors.length, warnings: warns.length, ledger, results }, null, 2));
} else if (!results.length) {
  const scope = only ? `check "${only}"` : "all checks";
  console.log(`docs-audit: ${scope} passed.`);
  accounting();
} else {
  const render = (list, label) => {
    if (!list.length) return;
    console.log(`\n${label} (${list.length})`);
    let last = "";
    for (const r of list) {
      if (r.id !== last) {
        console.log(`\n  [${r.id}] ${r.title}`);
        last = r.id;
      }
      console.log(`    - ${r.msg}`);
    }
  };
  render(errors, "❌ ERRORS — these fail CI");
  render(warns, "⚠️  WARNINGS — advisory, never blocking");
  accounting();
  console.log();
}

process.exit(errors.length ? 1 : 0);
