---
kind: plan
status: live
scope: The portal's INTERACTIVE surface — what happens when a control is clicked, and what a form collects. NOT the resting-page conformance, which `2026-08-27-portal-conformance.md` governs and which is closed.
---

# PLAN — the interactive surface, from 21 pins

*Written 2026-09-05 23:58 EDT. Source: `local/portal-sync-notes.md`, twenty-one pins Harkirat placed with `npm run portal:sync` on 2026-09-05 between 23:26 and 23:47 EDT, after signing into `dev-portal.dioreo.app` for the first time.*

## 🔴 THE FINDING THAT REORDERS EVERYTHING, AND IT IS NOT ANY SINGLE PIN

**The conformance pass measured RESTING FRAMES. Harkirat lives in the INTERACTIVE surface. Those are different products and only the first was ever checked.**

`portal:diff` subtracts two resting pages at one viewport. `portal:audit` walks those same two DOMs. `portalConverge` compares node rhythm across one pair of loads. **Every close condition in §L looks at a page AS IT LOADS, on fixture data, at 1282×888.** Pins 10, 11, 12, 13, 17, 32 and 36 are all about what happens *after a click*, and pin 11 is about fields being **absent from a form the resting page never renders**.

So the honest statement is not *"the portal is conformed apart from a cited floor."* It is:

> **The resting frames match. Almost nothing about the interactive surface was ever compared, and that is where the product is used.**

The rate of discovery is itself the evidence. `portal:openkind` was written on 2026-09-05 22:51 EDT, asks ONE question — *does this control open the same KIND of surface on both sides* — and found **five disagreements across three realms on its first run**, before Harkirat had pinned anything. A brand-new lens that immediately finds things is a lens pointed somewhere nobody was looking.

⚠️ **This does not retract the conformance work.** The resting comparison was real, its findings were real, and the floors reproduce. It says the close conditions were **necessary and not sufficient**, exactly as §0.5's own machine-floor paragraph warns, and that the insufficiency was never measured.

---

## Phase 0 — measure the interactive surface before fixing any of it

**Nothing here is a fix. It is the missing instrument tier, and it comes first because the 21 pins are a SAMPLE of an unmeasured population and nobody knows its size.**

| # | Build | Answers |
|---|---|---|
| 0.1 | **`portal:openkind` across every view**, not just the default one | Does a control open the same KIND of surface? Already built; `--view` support is the gap |
| 0.2 | 🔴 **`portal:formfields` — NEW, and the most important thing in this plan** | Does a portal create/edit form collect the same INPUTS as the `/manage` flow for the same op? Pin 11 and 13 are this, and **nothing in the repo measures it**. `portalOpsReach` proves an op is REACHABLE and says nothing about whether its form gathers what the op needs |
| 0.3 | **`portal:openkind --real`** against the live dev server | Do the answers change when the data is real rather than fixtures? Pins 15/20/33/35 claim colour is missing on the live site and present in the harness |

⚠️ **0.2 is the one to build even if nothing else here is done.** A form that stages an op without the fields the op takes is not a styling difference — it is a feature that cannot do its job, and it passes every gate this repo has.

---

## The 21 pins, with a verdict each

**Verdict key:** ✅ confirmed by an instrument · 🔍 needs one named measurement · ⚖️ contradicts a recorded decision, goes to Harkirat · 💬 a design judgement that is his to make.

| Pin | What he said | Verdict |
|---|---|---|
| **10, 17** | Creation chips should open **pop-up modals**, not inline panels | ⚖️ **CONFLICT.** `portal:openkind` confirms mockup=modal, portal=inline. But the ledger's 2026-08-31 row says *"Armory's Add form and build editor render INLINE in `.bed`, not as drawers — **Portal keeps the inline panels.** Class (b)"*, reasoned as *the editor's Discord preview lives beside the fields that produce it, which is what `.bed-side` is for*. **His pin overturns it. Put the original reasoning to him and get the reversal on the record.** |
| **36** | `+ Grant access` — *"the portal literally does nothing"* | ✅ **CONFIRMED, and it is a dead control, not a style difference.** `openkind`: mockup **modal**, portal **none** |
| **11, 13** | Forms missing fields — *"where's the image? the items list? the rarity? was `/manage` not referenced?"* | 🔍 **Phase 0.2 measures it.** Suspected real and systemic; no gate covers it |
| **12** | *"why is draw window even a creation form?"* — it is derived from the calendar | 💬 **A data-model objection, not UI.** If he is right the form should not exist at all, which is a bigger change than restyling it |
| **37** | Analytics/boot page *"blatantly broken"* | 🔍 Screenshots captured at `local/portal-ab/analytics-{mockup,portal}.png`. **Diff them element by element before deciding** — Analytics carries 33 ledger rows and the most portal-only panels, several by his own pop-up rulings, so some of this is agreed and some is not |
| **14** | *"no breathing room between sections and elements in this entire design"* | 💬 A systemic spacing pass. ⚠️ **The design queue already carries a type-scale + line-height item with a one-realm trial** — same family, do them together |
| **15, 20, 33, 35** | Colour and underlines missing on the LIVE site, present in the harness | 🔍 **PARTLY FALSIFIED ALREADY.** Measured 2026-09-05 23:58 EDT: the real API DOES return the colour data — `/api/armory` carries 133 `accent` and 133 `category`, `/api/season` 23 `category`. But **`/api/access/matrix` returns no colour keys at all**, and pins 33/35 are on Access. So this is narrower than it looked and is an Access-specific question |
| **5** | Identity chip shows `…2283`, no avatar | ⚖️ **CONFLICT, and it needs a POLICY change not a code change.** Adjudicated four times on 2026-09-01 as a PRIVACY question: `GET /auth/csrf` returns `discordId`, `isOwner`, `visibleRealms`, and **nothing in the codebase stores a username or avatar hash**; rendering the design's markup would fetch `url(undefined)`. Storing them needs a `PRIVACY.md` amendment |
| **8** | `+ Publish` alignment, and *"what does publish even mean?"* | 💬 Alignment is a fix; the copy is a UX-copy decision |
| **9** | Record row's vertical line not centred with the diamonds | ✅ A straightforward alignment defect |
| **22** | Delete buttons tiny and at the extreme edge, **on every manifest** | ✅ Shared component, so one fix reaches every realm. ⚠️ **A shared-surface edit re-runs every closed realm in the same commit** |
| **32** | Grant access always open, no user lookup to verify an ID | 💬 A real safety gap: granting access by typing an ID with no way to confirm whose it is |
| **18** | Compare — cannot type a weapon name, cannot compare builds of one weapon | 💬 Feature request against the built Compare view |
| **21** | Armory list requires scrolling everything, no collapse | 💬 Composition decision |
| **6, 7** | The staged callout *"feels squeezed in"*; `Open a day…` appears unexplained | 💬 Both are affordance/placement questions |

---

## Order, once he has picked

1. **Phase 0.2** — the form-field audit. It is the only item that is both unmeasured and load-bearing.
2. **Pin 36** — a control that does nothing is the worst defect on the list.
3. **The modal conversion** (10, 12, 13, 17), *after* the ⚖️ conflict is resolved, since it reverses a recorded decision.
4. **Pin 37** — Analytics, from the captured screenshots.
5. Alignment and shared-component fixes (8, 9, 22) — cheap, and 22 reaches every realm.
6. The judgement calls, in a batched pop-up.

---

## Audit log

*The falsification pass `.claude/rules/plan-drafting.md` requires, asked as "where is this WRONG?" rather than "is it complete?".*

| # | Where a plan written straight from the pins would have been wrong | Fix |
|---|---|---|
| **1** | 🔴 **It would have listed 21 fixes in priority order and answered the wrong question.** The pins are a SAMPLE of an unmeasured population, and treating them as the work list assumes they are the whole of it. `portal:openkind` found five disagreements before Harkirat pinned anything, on its first run, asking one question | Phase 0 measures the surface before anything is fixed |
| **2** | 🔴 **It would have carried "the portal is conformed apart from a cited floor" as its premise.** That sentence is true about resting frames and false about the product | The framing section, stated first |
| **3** | **Pins 15/20/33/35 were about to be filed as "the live site renders differently", the most alarming reading available.** One measurement narrowed it: the colour data IS in the real API for Armory and Season, and is absent only from `/api/access/matrix` | Verdict corrected before the plan was written |
| **4** | **Two pins reverse decisions that had stated costs, and a plan that silently implemented them would have destroyed the reasoning.** Pin 5 needs a policy amendment; pins 10/17 overturn a 2026-08-31 class-(b) keep | Marked ⚖️, and Harkirat asked to be shown each conflict rather than have it reversed |
| **5** | **The tool that collected the pins was itself corrupting them** — `\s` inside the shell's template literal collapsed to a bare `s`, so every captured string lost the letter. "Season 7" was recorded as "Sea on 7" | Fixed 2026-09-05 23:58 EDT; the pins' MEANING was unaffected, but a plan quoting the captured text verbatim would have quoted damaged strings |
