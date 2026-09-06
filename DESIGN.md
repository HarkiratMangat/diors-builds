---
kind: reference
status: live
name: Dioreo Admin Portal
description: Blued-steel operator console for administering Dioreo's live content
colors:
  desk: "#0F1418"
  paper: "#171E24"
  raised: "#1F272E"
  sunk: "#0B0F12"
  hi: "#232C34"
  rule: "#2A343D"
  rule2: "#3A4752"
  ink: "#E8EDF1"
  ink2: "#9DAAB4"
  ink3: "#85939F"
  ink4: "#5C6A75"
  patch: "#F2C230"
  warn: "#FF7A45"
  warnInk: "#FF9E72"
  ok: "#3DDC97"
  info: "#409AD0"
  sched: "#A680FB"
  del: "#FF6B6B"
  laneNewDraws: "#AE72E0"
  laneReturning: "#E8639B"
  laneDrawWindow: "#6B4E7D"
  laneEvent: "#4A90D9"
  lanePlaylist: "#2CC4C4"
  lanePatchNotes: "#F2C230"
  lineBattlePass: "#F2994A"
  lineRanked: "#FF3430"
  lineDmz: "#337BA6"
  discord: "#5865F2"
typography:
  ui:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
  display:
    fontFamily: "Big Shoulders Display, Space Grotesk, sans-serif"
rounded:
  rad1: "3px"
  rad2: "6px"
  rad3: "10px"
  round: "50%"
  pill: "999px"
components:
  button:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink2}"
    rounded: "{rounded.rad2}"
    padding: "9px"
    height: "44px"
  chip:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink2}"
    rounded: "{rounded.pill}"
    padding: "6px 11px"
    height: "32px"
  pill:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink2}"
    rounded: "{rounded.pill}"
    padding: "8px 13px"
  input:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.rad2}"
    padding: "8px 10px"
    height: "44px"
  card:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.rad2}"
    padding: "9px 10px"
  drawer:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.rad3}"
    width: "min(560px, calc(100vw - 40px))"
  tooltip:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.rad2}"
    padding: "6px 10px"
  flag:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink2}"
    rounded: "{rounded.rad2}"
    padding: "8px 11px"
---

# Design — Dioreo admin portal

<!-- impeccable:design-source mockups -->

> 🔴 **THIS FILE DESCRIBES THE MOCKUPS, NOT `portal/ui/`** — the mockups are the design authority and the portal is the thing being converged onto them. Recording the incumbent would canonise its drift.
>
> **Regenerated 2026-08-30 14:5x EDT against `docs/superpowers/mockups/2026-08-23-portal-interactive/`** — `assets/tokens.css`, `assets/app.css`, `assets/fixtures.js` and the seven realm pages. That package is the current authority: CLAUDE.md's portal row names it, the whole conformance pass diffs against it, and Harkirat settled it on 2026-08-27 (*"the design is the mockup"*).
>
> 🔴 **THE PREVIOUS VERSION OF THIS FILE WAS GENERATED FROM `2026-08-20-portal/`, WHICH IS SUPERSEDED — and it was wrong in almost every measurable field.** It recorded the typography as IBM Plex Sans Condensed / IBM Plex Mono (the package uses **Space Grotesk / JetBrains Mono / Big Shoulders Display**), the radii as 2–5px (they are **3 / 6 / 10px** plus a circle and a pill), `--ink3` as `#80909D` (**`#85939F`**, lifted to clear the AA floor), `--ink4` as `#4E5A64` (**`#5C6A75`**), and it claimed the direction was borders-only with no shadows and carried "exactly one" transition — the package has **98 `box-shadow` rules and 91 `transition` declarations**. Its two "known divergences" were re-measured on the current package and **neither reproduces**. **The lesson is the plan's own §0.5 R2: a citation has two tests — does it EXIST, and does it still GOVERN.** Date every source; the later artifact wins.
## Direction

**Blued steel.** A dark, cool, instrument-panel surface — deliberately distinct from the public site's violet-graphite (legal pages) and green-black (chronicle) while obviously the same house. The operator arrives knowing what they came to change; the interface is a workbench, not a brochure. Mode is **Operate**: scanability, consistency and the real usage scene outrank expression, and brand lives in precise details rather than in decoration.

## Palette

Colour carries **topic**; shape carries **state**. That separation is the portal's signature and it is load-bearing rather than stylistic — it means a bar's meaning survives being read in greyscale, and it is why the accent is a fill and never a text colour (a proven 4.58:1 floor with `#000` ink).

Six surfaces step from `--sunk` through `--desk`, `--paper`, `--raised`, `--hi` to `--rule`/`--rule2`, each jump only a few points of lightness.

🔴 **FOUR INK TIERS EXIST AND ONLY THREE MAY CARRY TEXT.** Measured 2026-08-24 against every surface: `--ink4` at `#5C6A75` scores **3.02:1 on `--paper`**, failing AA in all 89 places it coloured text. Solving for four AA-passing steps collapses two into each other — at this floor, on these surfaces, the scale has room for three text tones. `--ink3` was lifted from `#80909D` to **`#85939F`** to sit on the 4.5:1 floor exactly. **`--ink4` is kept dark deliberately, for the 11 places it draws a border, stroke or fill. Never write `color:var(--ink4)`.**

⚠️ **Two signal colours have the same problem and the same solution — one value for the fill, one lifted for ink, hue and saturation untouched because those ARE the identity:** `--ev` (3.28:1) pairs with **`--ev-ink:#25A570`**, and `--warn` pairs with **`--warn-ink:#FF9E72`** (composited true value 4.53:1 — passing by 0.03, which is not a margin).

⚠️ **TOPIC ACCENT IS TWO DIFFERENT SETS AND CONFLATING THEM IS A REAL TRAP.** The package's `:root` declares `--draw:#FF3430 · --ret:#337BA6 · --ev:#1F8A5E · --play:#8A6BD1`, but what the Track and Board actually paint comes from the LANES fixture: **new draws `#AE72E0` · returning `#E8639B` · draw windows `#6B4E7D` · events `#4A90D9` · playlists `#2CC4C4` · patch notes `#F2C230`**. `portal/ui/tokens.css` matches the LANE hexes. Two of the `:root` values (`#FF3430`, `#337BA6`) are the **deadline line** colours for Ranked and DMZ, so reading `:root` as the topic palette produces a set that is both wrong and confusingly plausible.

## Typography

**Three families, split by kind rather than by hierarchy.** `--ui` (**Space Grotesk**) for interface chrome; `--data` (**JetBrains Mono**) for **every date, count, id and code**, so numerals align in columns; `--display` (**Big Shoulders Display**) for figures and realm titles. The mono assignment is a data-integrity decision, not a texture one.

**The UI type scale moved up half a step on 2026-09-06 01:24 EDT** (build-out decision D6, `typeset`): `--t-micro 9.5 · --t-xs 10.5 · --t-sm 12 · --t-base 13 · --t-md 14.5 · --t-lg 16.5 · --t-xl 19 · --t-hero 26`, with three line-height jobs (`--lh-tight 1.15 · --lh-ui 1.35 · --lh-body 1.5`). Every literal px font-size in `portal/ui/app.css` was mapped onto a step in the same change (316 sites; 17px and 20px stay literal on the Armory rank column; the Discord preview keeps Discord's own sizes). ⚠️ **The mockup package keeps the old scale** (`--t-sm 11.5`, `--t-micro 9`): it is the design as approved, and the portal is deliberately ahead of it here — see Known divergences.

## Shape carries state

- **solid fill** — live
- **hollow, dashed border** — staged
- **diagonal hatch** — conflict

Applied via a `--topic-accent` custom property set on the element, never via a colour class. A new state gets a new *shape*; a new entity gets a new *accent*.

## Depth and geometry

Structure is carried by **borders** (`--rule`, `--rule2`) — but "no shadows" is false and was an error in the previous version of this file: the package carries **98 `box-shadow` declarations**, overwhelmingly *inset* rings that occupy no layout (`inset 0 0 0 1px`) plus the drawer's single lift. **An inset ring is a border that does not take space** — that is the depth strategy, and it is why a ring can be added to an element whose box is already committed.

**Five radii, named by size rather than by component:** `--rad-1:3px` (chips, ticks, tags — boxes under ~24px) · `--rad-2:6px` (**the default**: buttons, inputs, cards, panels) · `--rad-3:10px` (drawers, modals, the ⌘K palette) · `--rad-round:50%` (avatars, dots, beads) · `--rad-pill:999px` (a radius that always exceeds half the height). A workbench control reads as machined, not soft.

## Components

*Added 2026-09-06 00:27 EDT, from `impeccable doctor`'s only finding: nothing here told a screen generator what a control looks like, so the live design panel drew generic approximations in their place.*

🔴 **Extracted from the design package's `assets/app.css`, then diffed against `portal/ui/app.css`. All ten primitives below are BYTE-IDENTICAL on the two sides** — so unusually for this file, the Components section describes the mockups and the portal at once, and needs no divergence note.

**Every control is a rectangle of `--sunk` or `--raised` inside a one-pixel `--rule2` border.** There is no filled-button variant anywhere in the system: emphasis is carried by *ground* (`--raised` sits forward, `--sunk` sits back) and by the accent appearing on a border or an inset ring, never by a saturated fill behind label text. That is what keeps `--on-accent` off the critical path — and it is why a new filled state is the one addition that has to declare which ground it is for.

| Component | Ground | Border | Radius | Padding | Height |
|---|---|---|---|---|---|
| `.btn` | `--raised` | `--rule2` | `--rad-2` 6px | `9px` | `--tap` 44px |
| `.chip` | `--sunk` | `--rule2` | `--rad-pill` | `6px 11px` | 32px |
| `.pill` | `--sunk` | `--rule` | `--rad-pill` | `8px 13px` | auto |
| `input` / `select` | `--sunk` | `--rule2` | `--rad-2` | `8px 10px` | `--tap` 44px |
| `.card` | `--raised` | `--rule2` | `--rad-2` | `9px 10px` | content |
| `.drawer` | `--raised` | `--rule2` | `--rad-3` 10px | — | `min(84vh,860px)` |
| `.tip` | `--raised` | `--rule2` | `--rad-2` | `6px 10px` | content |
| `.flag` | `--sunk` | `--rule` + **`2px --warn` on the left** | `--rad-2` | `8px 11px` | content |
| `.realm` (rail item) | none | none | — | `11px 4px` | `--tap` 44px |
| `.mark` (record diamond) | `--c` fallback `--ink3` | none | `--rad-1` | — | 13×13 rotated 45° |

### The three named rules this vocabulary already obeys

**The Ground Rule.** Two grounds and only two. `--raised` is a thing you act *on*; `--sunk` is a well you put something *into*. A control that inverts this reads as a different kind of object — which is precisely how `.btn` (raised) and `.chip` (sunk) stay distinguishable at 11.5px with the same border colour.

**The 44px Rule.** `--tap:44px` is the floor for anything a pointer lands on, and `.btn`, `input`, `select` and `.realm` all state it explicitly rather than reaching it by accident. ⚠️ **It is bypassed in exactly one place, deliberately and with a dated comment** (`portal/ui/app.css`, the 32px control) — a documented exception, not drift. `.chip`'s 32px is the second, and it is the pattern to check before adding a third.

**The Left-Edge Rule.** A `2px` coloured left border means *this row is telling you something*, and `.flag` is its only base-level use. ⚠️ **The impeccable detector calls this the single most recognisable tell of AI-generated UI** and counts **59 instances in the design package** against 29 in the portal. It is the design's own signature and predates the detector — but it is the one component decision in this file that an outside reviewer would challenge first, and it is recorded here so the challenge is answered from evidence rather than re-litigated from taste.

### What a new component must state

1. Which of the two grounds it sits on.
2. Which radius step, by name — never a literal `px`.
3. Whether it is a tap target, and therefore whether `--tap` applies.
4. If it carries a fill, **which ground that fill is for** — `--on-accent` is near-black and reads at 2.86:1 on a dark fill.

## Motion

The package carries **91 `transition` declarations**; `portal/ui/app.css` carries **91**. The previous version of this file said "exactly one", measured against the retired package, and filed the difference as a portal defect. It does not reproduce.

⚠️ **The conformance instrument still cannot see motion, and that is a real limit rather than a design position.** `portalDiff` zeroes transitions and animations so its pixel comparison is deterministic at a frozen clock — so it would score an *added* transition as a regression, and can never reward one. `portalAudit` does not zero them and now samples `transitionProperty` / `transitionDuration`, so a **declared** transition is comparable even though its motion is not. **Answered 2026-09-06 01:24 EDT** (build-out, `animate`): ONE page-load orchestration keyed on `--dur-3` (320ms) — the masthead figures rise in order 60ms apart, the rail items stagger once on mount, drawers scale in (they already did). It lives at the foot of `portal/ui/app.css` under the build-out banner, inside `prefers-reduced-motion:no-preference`, and the global reduced-motion kill zeroes it.

## Spacing — a six-step scale, from 2026-09-06 01:24 EDT

`--s1 4 · --s2 8 · --s3 12 · --s4 16 · --s5 24 · --s6 32` (`portal/ui/tokens.css`, build-out decision D6, `layout`). Structural gaps use s4–s6 — the masthead's padding, `.mh-stats` above the figures, `.panel + .panel` (the view layer and the Manifest sat flush), the record panel's margin, the identity panel's foot; inside a control s1–s3. A literal stays legal where it is optical (a hairline, an 11px diamond); a NEW structural gap on a literal is a defect. Pin 14 ("no breathing room in this entire design") is the finding it answers.

**Before 2026-09-06 01:24 EDT there was no spacing scale, in either the mockups or the portal, and none was invented.** Measured across the six mockups 2026-08-30: **28 CSS custom properties, zero of them spacing**, and 19 distinct off-4px-grid values in padding/margin/gap — `9px` used 41 times, `11px` 31 times, plus 13/15/17/22/26/34/90px.

Recording an invented scale would have been the wrong move twice over: it would make an arbitrary set of numbers look decided, and snapping the portal onto a grid would move pixels and **raise** the conformance diff. Per Harkirat's decision 2026-08-30 11:46 EDT: **no action now; revisit once the portal is conformed to the mockups, since that is when redesign work resumes anyway.** That revisit is the 2026-09-06 01:24 EDT scale above; the mockups keep their off-grid values because they are the approved design, not a live sheet.

## Known divergences — the build-out's deliberate ones

**From 2026-09-06 01:24 EDT the portal is AHEAD of the mockup package on purpose** (Harkirat, 2026-09-06 00:43 EDT: the conformance is done; build out, redesigns included; floors move). The package stays as approved. Each row is a divergence a future measurement will report, and the reason it should NOT be closed:

| Divergence | Portal | Package | Why |
|---|---|---|---|
| UI type scale | `--t-sm 12`, `--t-base 13`, `--t-micro 9.5` … (Typography above) | `11.5 / 12.5 / 9` | D6 `typeset`; the detector's top rule was undersized-ui-text |
| Spacing scale | `--s1…--s6`, structural gaps on s4–s6 | none | D6 `layout`; pin 14 |
| Realm accents | six distinct hues, Review = ink, Home = ink2 | four alias state colours | D4 `colorize`; the paragraph below records the old state |
| Masthead wash | radial realm-hue light, 10% at top-left, keyed on `.app[data-realm]` | none | `bolder` — the signature |
| Topic side-tab | 2px on cards (`.bcard`, tier cards, the composer preview) | 3px | `quieter`; the state callouts (`.flag`, `.callout`, `.failbox`) keep 3px because there the border IS the message |
| Drawer field label | sentence case, `--t-sm`, `--ui` | 9.5px tracked uppercase | a six-field form is read, not scanned |
| Manifest delete column | 52px, 12px in, ghost ring at rest, tip on hover | 40px / 8px / transparent ring | pin 22 |
| Record-panel CTA row | `align-items:center` | `baseline` | pin 8 — a 30px button hung 8px below a 10.5px eyebrow |
| Record spine | `.rec-mk{justify-self:center}` | left-aligned in its column | pin 9 — the marker sat 4.5px off the line it threads |

*(Rows for what the realm units built — drawers, the Armory rack, the Access grant flow, the Analytics lead — are in `docs/reference/portal-decision-ledger.md` § Superseded 2026-09-06.)*

**Before 2026-09-06 01:24 EDT this section read "none currently stand":**

The previous version listed two, both measured against the retired `2026-08-20-portal` package. **Both were re-measured on the current authority on 2026-08-30 and neither reproduces:** `--ink4:#5C6A75` is declared identically in both token files, and the transition counts hold.

🔴 **THE COUNTS IN THIS FILE WERE RE-DERIVED 2026-09-04 22:05 EDT AND TWO OF THEM WERE STALE.** Not by much, and that is the point — a number in prose rots quietly and then reads as measured. Current: **`box-shadow` portal 111 · package 103** (this file said "the package carries 98") and **`transition` 92 · 92** (it said 91/91). ⚠️ **They were stale before tonight's work and were inherited by an edit to this very section**, which is exactly the content-conservation failure the completeness sweep names: moved or edited text keeps asserting what it asserted, and the edit makes it look freshly checked. `rg -o 'box-shadow' portal/ui/app.css | wc -l` re-derives it in one command; prefer running that to trusting this sentence. Both are annotated in `docs/db-deferred-list.md` rather than deleted, so the next reader of the retired package finds the correction instead of repeating the hunt.

⚠️ **This section should not stay empty by neglect.** Where the portal genuinely differs from the design, the live record is the conformance measurement itself — `npm run portal:audit -- --realm <r>` and `portalDiff`.

🔴 **THE STAND-DOWN REGISTER THIS PARAGRAPH POINTED AT NO LONGER EXISTS — corrected 2026-09-04 21:52 EDT.** It said to read `rg -n 'conforming\(\)' portal/ui/*.js` as "the list of divergences that are deliberate". That grep returns **0** and has since 2026-08-31, when the two rendering modes collapsed: all 57 `conforming()` sites and the helper module were deleted, and there is ONE rendering now which is what ships. **A record that tells a reader to run a command whose empty output means "no divergences" is worse than one that says nothing** — the silence reads as a clean bill of health. The register that replaced it is `docs/reference/portal-decision-ledger.md`, where a deliberate divergence is a ROW with a falsifier; `npm run portal:ledger-rows` counts them per realm.

✅ **RESOLVED 2026-09-06 01:24 EDT — decision D4, distinct hue per realm** (`--r-broadcast:#E56FA6 · --r-access:#6B8AF7 · --r-analytics:#9CC85A · --r-review:var(--ink) · --r-home:var(--ink2)`; season and armory unchanged). Review is colourless on purpose: it is the one realm with no topic, because it is every topic; Home is the arrival surface, not a territory. The paragraph that follows is the finding as it stood. 🔴 **THE PALETTE'S OWN LAW WAS BROKEN AT THE TOKEN LEVEL — measured 2026-09-04 21:52 EDT.** This file states *"colour carries topic; shape carries state"* and calls it load-bearing rather than stylistic. `portal/ui/tokens.css:104-105` then defines four of the six realm accents as ALIASES OF STATE COLOURS: `--r-broadcast:var(--patch)` · `--r-access:var(--info)` · `--r-analytics:var(--ev)` · `--r-review:var(--staged)`. Topic and state are not merely both coloured — on four realms they are the **same hex**, so no reader can tell "this is the Review realm" from "this is staged" by hue alone, and the shape vocabulary degrades from *the* signature to a redundancy. ⚠️ **Whether that is a defect or a deliberate pun** (Review IS where staged work goes) **is a design decision nobody has recorded**, which is precisely why it belongs in this section rather than in a comment.
