---
version: 1
slug: "portal-ui-season-js"
primary_target: "portal/ui/season.js"
related_targets: []
---

## Scope and mode

**Season** — `portal/ui/season.js`. Mode: **Operate**. Views: Track · Board · Repairs.

Lay out and repair a season's timeline — the Track, the Board of dated records, and the Repairs panel that reports the six checks a season can fail.

## Audience and job

One admin today, a second one shortly: `models/AdminUser.js` and the per-page scopes already exist, so the realm is designed for a reader who did NOT specify it. Density is chosen, never maximal.

**The arriving state:** A dated record is wrong, missing, or contradicts another. He arrives knowing which one.

## The task, and what proves it done

Every mutation is a `core/ops` value — validate, preview, apply, invert. The realm's job is to make the preview truthful and the invert reachable; it is a driver of that algebra, never a second implementation of it.

## What must stay untouched

- **Conformance is measured, not judged.** The design authority is `docs/superpowers/mockups/2026-08-23-portal-interactive/`, and this realm closes on the ENUMERATION of cited differences, never on a percentage.
- Colour carries topic; shape carries state. A new state gets a new shape, never a new hue.
- ⚠️ Four realm accents are aliases of state colours in `tokens.css`. Whether that is a defect or a deliberate pun is recorded as undecided in DESIGN.md and must not be silently resolved here.

## Memorable moment

The Repairs count is the proof: it is the same `findingRows` Home's row reads, so a season that says zero findings on two surfaces is saying it once.

## Unresolved

Carried from `docs/superpowers/plans/2026-09-05-portal-interactive-surface.md`; do not re-derive these, and do not close them without Harkirat.

*Written 2026-09-06 00:28 EDT — the first surface briefs this project has had. Every impeccable command reads one to pick its standard; without them each run re-inferred the mode from code, which the docs name as the main source of generic advice.*
