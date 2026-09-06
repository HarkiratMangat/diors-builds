// portal/ui/season.logic.js — CommonJS, imports nothing. Pure op-builders for the Season realm's compose actions, tested directly by scripts/portalRealms.test.js.
//
// 🔴 THE MANIFEST ROW'S `lane` ('newDraws'/'returningDraws'/'calendar' — the SeasonalData ARRAY PATH name, see toManifestRows below) is NOT the vocabulary core/ops/draws.js's validate() accepts for payload.category/target.category ('new'/'returning' — see LANE_TO_CATEGORY below). Passing the lane straight through fails validation silently differently than expected; this mapping is the fix, found by reading core/ops/draws.js's validateOne() before writing this file.
const LANE_TO_CATEGORY = { newDraws: 'new', returningDraws: 'returning' };
// The Manifest column's own humanized label for a row's lane -- gap audit §3.4 finding 1. Season.js references this as a bare global (loaded before it, same as everything else here). ⚠️ PLURAL, because these name a LANE rather than one row — the design's own table, its filter chips and the Track's lane headers all read "New draws / Returning / Draw windows / Events / Playlists / Patch notes", and the singular here made the Type column disagree with the chip that filters it.
const LANE_LABELS = { newDraws: 'New draws', returningDraws: 'Returning', calendar: 'Events' };
// The Manifest row's COLOUR DOT. manifest.js:61 has always read `row.topicVar` -- and nothing in the repo has ever SET it, so every row's dot in every realm rendered the --ink3 grey fallback. The gap audit's §2.2 asserted toManifestRows was the source of it; `rg topicVar portal/` returns the read, a `delete` in buildSeasonEditOp below, and nothing else. Phase 2's token fix therefore reached Track's bars (track.js computes its own --topic-accent) and never reached the Manifest.
//
// Playlist gets its own accent here rather than being folded into Event. --play and TOPIC_VAR.playlist have both existed since the first build with nothing ever assigning them: a playlist-category calendar item was indistinguishable from an event on every Season surface.
const LANE_TOPIC_VAR = { newDraws: '--draw', returningDraws: '--ret', calendar: '--ev' };
function isPlaylist(item) { return String((item && item.category) || '').toLowerCase() === 'playlist'; }
// 🔴 THE CALENDAR HOLDS THREE CATEGORIES AND THE CODE KNEW ABOUT TWO. `normalizeCalendarCategory` (utils/adminParser.js) accepts draw, event and playlist; every surface here special-cased `playlist` and let everything else fall through to Event -- so a calendar row with category 'draw', which is a DRAW WINDOW, rendered as an Event, in the Event colour, in the Events lane. That is the same defect the playlist split was written to fix, one category short of done. A table forces the next category to be answered instead of defaulted.
const CAL_CATEGORY = {
    playlist: { label: 'Playlists', topic: '--play', lane: 'playlist' },
    draw:     { label: 'Draw windows', topic: '--dw', lane: 'drawwindow' },
    event:    { label: 'Events', topic: '--ev', lane: 'event' },
};
function calCategoryOf(item) { return CAL_CATEGORY[String((item && item.category) || '').toLowerCase()] || CAL_CATEGORY.event; }
function topicVarFor(laneKey, item) { return laneKey === 'calendar' ? calCategoryOf(item).topic : (LANE_TOPIC_VAR[laneKey] || '--ink3'); }
function typeLabelFor(laneKey, item) { return laneKey === 'calendar' ? calCategoryOf(item).label : (LANE_LABELS[laneKey] || laneKey); }

// The Track's visible date range. It used to be {start: today, end: live.bpEnd || today} inline in season.js -- so when bpEnd is unset (its state in the dev database right now, and the state of any season nobody has typed a battle-pass end into) start EQUALLED end, barGeometry divided by a 1ms window, every bar collapsed to a sliver at 0% and the ruler printed today twice. Derived from the data's own extent instead, with today always inside it so the NOW line has somewhere to land and a 14-day floor so a season holding one item is still a readable axis rather than a point. ⚠️ TL IS A BROWSER GLOBAL AND THIS FILE ALSO RUNS UNDER NODE — AND IT IS RESOLVED LAZILY ON PURPOSE. Every *.logic.js loads as a classic script in the page, in readdir order, and `season.logic.js` sorts BEFORE `timeline.logic.js` — so a top-level `const TLib = TL` captured `undefined`, fell through to a require() that does not exist in a browser, and pinned null for the life of the page. Season then threw "Cannot read properties of null (reading 'days')" on first render and the realm was blank, in ordinary mode, while the conformance overlay looked fine. Resolve at CALL time. Same shape as TLib and for the same reason: `lifecycleOf` is board.logic.js's global in the browser and nothing at all under Node, where the tests require this file on its own. Resolved at CALL time — a top-level capture would read undefined, since board.logic.js sorts AFTER this file.
function lifecycleFn() {
    if (typeof lifecycleOf !== 'undefined') return lifecycleOf;
    if (typeof require !== 'undefined') return require('./board.logic.js').lifecycleOf;
    throw new Error('season.logic.js needs board.logic.js and neither runtime provided it');
}

function TLib() {
    if (typeof TL !== 'undefined') return TL;
    if (typeof require !== 'undefined') return require('./timeline.logic.js');
    throw new Error('season.logic.js needs timeline.logic.js and neither runtime provided it');
}

// 🔴 THE INK ON A FILLED SURFACE IS A PROPERTY OF THAT SURFACE, not one global value. --on-accent is near-black, which is right on Playlists' bright teal and 2.86:1 on a draw window's plum — so every filled bar, label and state pill on a dark topic rendered unreadable ink the design does not use. The design derives it from the accent's own luminance once and hands it over as --ci; this is that function, and the hexes are the lane accents the tokens resolve to.
const TOPIC_HEX = { '--draw': '#AE72E0', '--ret': '#E8639B', '--dw': '#6B4E7D', '--ev': '#4A90D9', '--play': '#2CC4C4', '--patch': '#F2C230' };
function inkOn(hex) {
    if (!hex || hex[0] !== '#') return '#07090A';
    const full = hex.length === 4 ? '#' + hex.slice(1).replace(/./g, (c) => c + c) : hex;
    const chan = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
        .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    const L = 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
    return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#07090A' : '#FFFFFF';
}
const inkOnTopic = (topicVar) => inkOn(TOPIC_HEX[topicVar] || '');

function seasonWindow(live, now = Date.now()) {
    const iso = (v) => (v ? String(v).slice(0, 10) : '');
    const ds = [new Date(now).toISOString().slice(0, 10)];
    for (const key of ['newDraws', 'returningDraws', 'calendar']) {
        for (const item of (live && live[key]) || []) {
            for (const value of [item.date, item.startDate, item.endDate]) if (iso(value)) ds.push(iso(value));
        }
    }
    const sorted = ds.filter(Boolean).sort();
    let lo = sorted[0], hi = sorted[sorted.length - 1];

    // ⚠️ A DEADLINE EARNS SPACE BY PROXIMITY, NOT BY EXISTING. bpEnd was pushed into the extent unconditionally, so a battle pass ending well past the last calendar row stretched the axis over empty weeks and every bar shrank to pay for it. The design's rule is proportional: a deadline within a quarter of the content's own span joins the window; one further out is pinned at the edge instead. On the live season that is the difference between a 44-day axis and the design's 48.
    const span = Math.max(1, TLib().days(lo, hi));
    const REACH = Math.max(7, Math.round(span * 0.25));
    for (const key of ['bpEnd', 'rankEnd', 'dmzEnd']) {
        const d = iso(live && live[key]);
        if (!d) continue;
        if (d > hi && TLib().days(hi, d) <= REACH) hi = d;
        if (d < lo && TLib().days(d, lo) <= REACH) lo = d;
    }

    const MIN_SPAN_DAYS = 14;
    if (TLib().days(lo, hi) < MIN_SPAN_DAYS) hi = TLib().addDays(lo, MIN_SPAN_DAYS);
    // Breathing room at both ends, so the first and last bar are not flush against the frame.
    const pad = Math.max(2, Math.round(TLib().days(lo, hi) * 0.04));
    return { start: TLib().addDays(lo, -pad), end: TLib().addDays(hi, pad) };
}

const KIND_TO_ENTITY = { draw: 'draw', returning: 'draw', event: 'calendar', playlist: 'calendar' };
const KIND_TO_DRAW_CATEGORY = { draw: 'new', returning: 'returning' };

// Gap audit §3.4 finding 2: this used to hardcode state:'live' on every row unconditionally, regardless of whether the SIGNED-IN admin's own open Changesets (season.js already fetches these for Board's use via GET /api/changeset?realm=season, scoped to session.discordId per H7) had a pending op against that exact item. Derives the real state instead: an id targeted by a 'blocked' changeset's op reads as a conflict, a 'staged' one reads as staged, otherwise live. Moved here (was a local function in season.js) so it's a real testable pure function rather than browser-only ESM -- same reasoning as LANE_LABELS above.
function elementIdsFor(changeset) {
    const ids = new Set();
    for (const op of changeset.ops || []) {
        if (op.target && op.target.elementId) ids.add(String(op.target.elementId));
        // draw.bulkDelete/calendar.bulkDelete carry payload.ids rather than target.elementId -- season.js's own UI doesn't issue these today (its bulk actions map to per-row .delete ops instead), but core/ops itself supports them, so this stays correct if that changes.
        if (Array.isArray(op.payload && op.payload.ids)) op.payload.ids.forEach((id) => ids.add(String(id)));
    }
    return ids;
}

function stateForElement(elementId, changesets) {
    for (const c of changesets || []) {
        if (c.state !== 'staged' && c.state !== 'blocked') continue;
        if (elementIdsFor(c).has(String(elementId))) return c.state === 'blocked' ? 'conflict' : 'staged';
    }
    return 'live';
}

// 🔴 THE TABLE CALLED ITSELF "EVERYTHING IN THE SEASON" AND OMITTED THE DRAFT ENTIRELY. A draft can hold twenty items — the harness fixture's does — and none of them appeared in the one place that claims to list everything, so the only way to see what was staged for next season was to read it off the Track. The draft rows come through marked, because a staged item and a live one are not the same fact and a table that renders them alike is worse than one that omits them.
//
// ⚠️ Found because the `.nextmark` branch in SEASON_COLUMNS could never be reached: the condition was `row.isDraft` and nothing ever set it. A branch that cannot be true is the same defect as a button with no handler, one layer down. 🔴 THE MANIFEST SAID *WHEN* AND NEVER *WHERE IN THE SEASON*. "Sep 3 → Sep 12" is a fact you have to hold three of at once to compare; the Track answers it visually and the table sitting under the Track did not, so scanning for "what is running late in the season" meant reading 39 date pairs. This is the same window the Track draws, so a row's bar and its lane bar cannot disagree.
//
// ⚠️ AND IT IS COMPUTED HERE, NOT IN THE COLUMN. A Manifest column receives a row and nothing else — no season, no window — so a column that scaled its own bar would need a second copy of the season bounds passed in beside it. Stamping it on the row keeps one derivation. ⚠️ `now` IS A PARAMETER, NOT A READ OF THE CLOCK. seasonWindow includes today in its extent — the design's dataBounds does the same — so routing through it made this geometry drift with the wall clock: the same season produced different bars in August and in September, and a test asserting the midpoint of a Sep 1 → Oct 1 season passed or failed depending on the day it ran. Callers pass the day they are rendering.
function seasonSpanGeometry(live, now = Date.now()) {
    // 🔴 THIS IS THE DESIGN'S *PAN* BOUNDS, NOT THE DATA'S EXTENT, and the difference was a factor of 1.8 on every bar the Manifest and the Board draw. This used to push bpEnd/rankEnd/dmzEnd into the extent unconditionally, so a DMZ season ending 2026-11-11 stretched a 54-day axis to 97 and every span shrank to 56% of the width the design gives it — thirty findings a view, on three views. The design's spark() measures against `BOUND` = panBounds() = the windowed bounds plus 6% room, deliberately wider than the data so the bar reads as a position on a map rather than a bar that always fills its track. seasonWindow() is already that window (it applies the proportional REACH rule, so a far-off deadline earns a pin rather than an axis), so the room is all that is left. 🔴 DEGENERACY IS A FACT ABOUT THE DATA, AND seasonWindow HIDES IT. That function floors a window at MIN_SPAN_DAYS so the Track always has something readable to draw — which means a season whose every dated thing lands on one day comes back as a fourteen-day window, and this function could no longer return null. The protection it was written for is real: with no extent, every row divides by zero and paints a full-width bar. So the raw extent is checked HERE, before any flooring.
    const days = [];
    for (const key of ['newDraws', 'returningDraws', 'calendar']) {
        for (const i of (live && live[key]) || []) {
            for (const v of [i.date, i.endDate]) if (v) days.push(String(v).slice(0, 10));
        }
    }
    for (const k of ['bpEnd', 'rankEnd', 'dmzEnd']) if (live && live[k] && !live[`${k}TBD`]) days.push(String(live[k]).slice(0, 10));
    days.sort();
    if (!days.length || days[0] === days[days.length - 1]) return null;

    const w = seasonWindow(live, now);
    if (!w) return null;
    const room = Math.max(3, Math.round(TLib().days(w.start, w.end) * 0.06));
    const lo = Date.parse(`${TLib().addDays(w.start, -room)}T00:00:00Z`);
    const hi = Date.parse(`${TLib().addDays(w.end, room)}T00:00:00Z`);
    // A season whose every dated thing lands on one day has no span to draw against; returning null makes the column render nothing rather than divide by zero and paint a full-width bar on every row.
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return null;
    return { lo, hi, span: hi - lo };
}

function spanBarFor(item, geo) {
    if (!geo || !item || !item.date) return null;
    const a = Date.parse(`${String(item.date).slice(0, 10)}T00:00:00Z`);
    const b = Date.parse(`${String(item.endDate || item.date).slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const left = ((a - geo.lo) / geo.span) * 100;
    // A point-in-time release has zero width and would draw nothing at all; 1.5% is the floor that keeps a release visible without letting it read as a window. The design's floor is 2%, not 1.5 — a quarter of the width on all sixteen single-day bars.
    const width = Math.max(2, ((b - a) / geo.span) * 100);
    return { left: Math.max(0, Math.min(100, left)), width: Math.min(100 - Math.max(0, Math.min(100, left)), width) };
}

function nowPctIn(geo, nowMs) {
    if (!geo) return null;
    const p = ((nowMs - geo.lo) / geo.span) * 100;
    return p >= 0 && p <= 100 ? p : null;
}

// The Board's own item list. It is the MANIFEST'S rows plus patch notes plus two derived fields, rather than a second walk of the same document -- one source, so a row cannot appear on one surface and not the other for a reason nobody can find.
//   `kind`     a draw is a POINT (one date, no duration); a calendar row is a SPAN. lifecycleOf reads this.
//   `dateOnly` a draw with NO calendar draw-window carrying its name. Such a draw genuinely never ends -- that
//              is deliberate bot behaviour, it is true of 11 of the 14 real draws, and it is the difference
//              between a release that is still live and one that is history. Matched on the NORMALIZED title
//              because a window is named after its draw and never with the same punctuation.
// ⚠️ UPDATED 2026-08-31 — THE MANIFEST LISTS PATCH NOTES NOW TOO, so this function passes `patchNotes:false` to keep from counting them twice. The old note read: the Manifest's home for a patch note is the Season Record panel, and the Board's own lifecycle rule has a dedicated patch-note branch precisely because they belong on this axis.
function toBoardItems(live, changesets, draft) {
    // ⚠️ WITHOUT PATCH NOTES: this function appends them itself, just below. Once toManifestRows started adding them too (under the conformance flag) the Board counted 41 items against the design's 39 and every column pill was one too high — a duplicate that reads as a data error rather than a wiring one.
    const rows = toManifestRows(live, changesets, draft, { patchNotes: false });
    const windows = (live?.calendar || [])
        .filter((c) => String(c.category || '').toLowerCase().startsWith('draw'))
        .map((c) => normalizeTitle(c.title));
    // An 'all season' row ends when the season does — the same rule the Track needed, and the Board is the other reader of it. Without it a draw window's card printed "Aug 7 → —" and its meta went NaN.
    const ongoingEnd = live && live.bpEnd ? String(live.bpEnd).slice(0, 10) : null;
    const out = rows.map((r) => {
        const point = r.lane === 'newDraws' || r.lane === 'returningDraws';
        const start = r.startDate || r.date || null;
        return { ...r, kind: point ? 'point' : 'span',
            startDate: start,
            endDate: r.endDate || (r.isOngoing && ongoingEnd ? ongoingEnd : (point ? start : null)),
            // The row already carries it — toManifestRows computes it from the same windows. Recomputing here is how the Board and the Manifest got the chance to disagree in the first place.
            dateOnly: r.dateOnly !== undefined ? r.dateOnly
                : (point && !windows.some((w) => w && normalizeTitle(r.title) && (w.includes(normalizeTitle(r.title)) || normalizeTitle(r.title).includes(w)))) };
    });
    for (const n of (live?.patchNotes || [])) {
        out.push({ ...n, id: String(n._id), title: n.title || 'Patch note', lane: 'patchNotes',
            kind: 'point', dateOnly: true, typeLabel: 'Patch notes',
            topicVar: '--patch', state: stateForElement(n._id, changesets),
            // `releaseDate` is the schema's own field; reading only `date`/`publishedAt` left every publication card on the Board reading "— → —" and sorting as though it had no date at all.
            startDate: n.releaseDate || n.date || n.publishedAt || null,
            endDate: n.releaseDate || n.date || n.publishedAt || null });
    }
    return out;
}

// Which patch note is the current one. The newest by date is live and every other is history — a rule the Board needs and nothing else does, so it travels with the items rather than being recomputed per render.
function newestPatchNoteId(items) {
    let best = null;
    for (const i of items || []) {
        if (i.lane !== 'patchNotes') continue;
        if (!best || String(i.startDate) > String(best.startDate)) best = i;
    }
    return best ? best.id : null;
}

function toManifestRows(live, changesets, draft, opts) {
    if (!live) return [];
    // Forwarded so a caller that knows which day it is rendering gets a geometry that does not move.
    const geo = seasonSpanGeometry(live, (opts && opts.now) || undefined);
    const nowP = nowPctIn(geo, Date.now());
    // 🔴 `dateOnly` IS COMPUTED HERE NOW, NOT ONLY IN toBoardItems. rowLifecycleByDate's own comment says a
    //    manifest row "has to be told" — and it never was, so it fell back to treating every draw as
    //    windowless, which means permanent. Measured against the design 2026-08-31: "Judgment Day - It Goes
    //    Two" read LIVE NOW in the table and ENDED in the design, because it HAS a calendar window and its
    //    release is history. A fact about the SET cannot be derived from one row, which is why it is here
    //    rather than in rowLifecycle.
    // ⚠️ DUAL RUNTIME. normalizeTitle lives in track.logic.js, which is a sibling plain script: in the
    //    browser both are globals and this resolves, in Node this file is required alone and it does not.
    //    toBoardItems got away with the same call because nothing in Node reaches it; toManifestRows IS
    //    tested, and the suite caught it in one run. Same rule as the plan's R6 — a dual-runtime file needs
    //    to work in BOTH, not in the one that happens to be exercised.
    const normTitle = (t) => (typeof normalizeTitle === 'function' ? normalizeTitle(t)
        : String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
    const drawWindows = (live?.calendar || [])
        .filter((c) => String(c.category || '').toLowerCase().startsWith('draw'))
        .map((c) => normTitle(c.title));
    const noWindowFor = (title) => {
        const t = normTitle(title);
        return !t || !drawWindows.some((w) => w && (w.includes(t) || t.includes(w)));
    };
    const rows = [];
    for (const key of ['newDraws', 'returningDraws', 'calendar']) {
        for (const item of live[key] || []) {
            rows.push({
                // The full item ships on the row (not just the display fields below) so buildSeasonEditOp has every field draw.edit/calendar.edit's validate() needs -- an edit op built from a display-only row would silently drop items/startDate/category on every commit.
                ...item,
                id: item._id, title: item.title, lane: key,
                dateOnly: (key === 'newDraws' || key === 'returningDraws') ? noWindowFor(item.title) : false,
                // 🔴 THE ONGOING END DATE BELONGS ON THE ROW, NOT ONLY ON THE TRACK AND THE BOARD. All three read the same records and only two knew that an "all season" calendar row ends when the season does — so the table's Window column printed one date, its Span column drew a point, and its progress fill never appeared, on the same row the Board showed running.
                endDate: item.endDate || (item.isOngoing && live.bpEnd ? String(live.bpEnd).slice(0, 10) : item.endDate),
                state: stateForElement(item._id, changesets),
                // Display-only, both stripped again by buildSeasonEditOp before an op is built.
                topicVar: topicVarFor(key, item), typeLabel: typeLabelFor(key, item),
                span: spanBarFor(item, geo), nowPct: nowP,
                // ⚠️ ONLY A SPAN CAN OUTLIVE THE SEASON. A draw carries one date and no end at all, so asking whether it "ends after" a deadline compares a release to a deadline and calls every late release a conflict — the same reading error Home's own predicate had to be corrected for.
                outlivesSeason: Boolean(item.endDate && live.bpEnd && String(item.endDate).slice(0, 10) > String(live.bpEnd).slice(0, 10)),
                // A draw's real schema field is `date` (no separate start/end); calendar events have both `date`(start) and `endDate`. This pre-existing display line always fell to '—' for every draw before this fix, since item.endDate is never set on a draw record.
                window: (item.endDate || item.date) ? `→ ${new Date(item.endDate || item.date).toDateString()}` : '—',
            });
        }
    }
    // 🔴 THE MANIFEST LISTS PATCH NOTES. This was deferred behind the conformance flag with the note that
    //    keeping them out was "the portal's own call"; the mode collapse is where that argument had to be
    //    settled, and it settles for including them — not only because the design lists them, but because
    //    excluding them made the portal CONTRADICT ITSELF: 37 rows under a count reading "37 of 37", beside
    //    an export strip saying 39. A manifest that disagrees with its own export about how many things
    //    exist is a defect regardless of which side the design takes.
    //    `window` is the release date, which is the only date a publication has.
    if (!opts || opts.patchNotes !== false) {
        for (const n of live.patchNotes || []) {
            rows.push({
                ...n, id: n._id, title: n.titleOverride || n.title, lane: 'patchNotes',
                state: stateForElement(n._id, changesets),
                topicVar: '--patch', typeLabel: 'Patch notes',
                // The Window and Detail columns read `date` and the item's own shape; a publication's only date is its release, and what it carries is its images. ⚠️ START AND END BOTH SET, TO THE SAME DAY. spanBarFor reads startDate/endDate; with endDate null it had nothing to plot and the Season column printed an em dash on every publication row — a moment still HAS a place on the season's axis, which is the one thing that column is for.
                date: n.releaseDate ? String(n.releaseDate).slice(0, 10) : null,
                startDate: n.releaseDate ? String(n.releaseDate).slice(0, 10) : null,
                endDate: n.releaseDate ? String(n.releaseDate).slice(0, 10) : null,
                images: n.images || [],
                span: spanBarFor({ date: n.releaseDate, startDate: n.releaseDate, endDate: n.releaseDate }, geo),
                // The detail column asks what a row CARRIES. For a publication that is its images — "no detail" is what the generic path produced, which is true of nothing here.
                isNewestPatchNote: false,
                detailText: `${(n.images || []).length} image${(n.images || []).length === 1 ? '' : 's'}`,
                nowPct: nowP, outlivesSeason: false,
                window: n.releaseDate ? `→ ${new Date(n.releaseDate).toDateString()}` : '—',
            });
        }
    }
    // The newest publication is the live one; marked after the whole set is built, because "newest" is a property of the SET rather than of any row.
    const notes = rows.filter((r) => r.lane === 'patchNotes');
    if (notes.length) {
        notes.reduce((best, r) => (!best || String(r.date) > String(best.date) ? r : best), null).isNewestPatchNote = true;
    }
    // ⚠️ THE ID IS PREFIXED. A draft subdocument carries its own _id and a live one carries a different one, but nothing guarantees they never collide across the two arrays — and the Manifest keys rows, selections and the edit target on `id`. A prefix makes a draft row impossible to mistake for the live record it was copied from, and buildSeasonEditOp would refuse it anyway.
    if (draft && draft.active) {
        for (const key of ['newDraws', 'returningDraws', 'calendar']) {
            for (const item of draft[key] || []) {
                rows.push({
                    ...item,
                    id: `draft:${item._id}`, title: item.title, lane: key, isDraft: true,
                    state: 'staged',
                    topicVar: topicVarFor(key, item), typeLabel: typeLabelFor(key, item),
                    span: spanBarFor(item, geo), nowPct: nowP,
                    window: (item.endDate || item.date) ? `→ ${new Date(item.endDate || item.date).toDateString()}` : '—',
                });
            }
        }
    }
    return rows;
}

// The three calendar categories utils/adminParser.js's normalizeCalendarCategory accepts, keyed by the composer's own kind. `drawwindow` is the one the portal never offered a control for.
const KIND_TO_CALENDAR_CATEGORY = { event: 'Event', playlist: 'Playlist', drawwindow: 'Draw' };

function buildSeasonAddOp(kind, fields) {
    // 🔴 THE PATCH-NOTE CHIP STAGED A CALENDAR EVENT. `patchnote` is one of the five chips on Season's masthead and was not in KIND_TO_ENTITY, so it fell past the draw branch into the calendar one and produced `calendar.add` with `category:'Event'` — a patch note quietly filed as an event, under a control labelled "Patch note". Found rebuilding the composer, not by any check: nothing is wrong with the code's shape, only with what it does.
    //
    // ⚠️ The op is `patchnote.addSeason`, whose payload keys are its OWN (`titleOverride`, `releaseDate`) and not the calendar's — `resolveReleaseDate()` in core/ops/patchnotes.js reads `releaseDate`, so sending `endDate` here would parse an empty string. Description and image URLs are genuinely absent rather than defaulted: the composer collects a name and a date, and /manage is where the rest of a patch note is written.
    if (kind === 'patchnote') {
        // 🔴 THE DESCRIPTION AND THE IMAGE SLOTS ARE COLLECTED NOW, AND THEY USED TO BE HARDCODED EMPTY. /manage's own Add New Season modal takes all four (commands/manage.js's buildPatchAddSeasonModal: season title override, release date, additional info, and two URL paragraphs), so the portal's control created a publication with no content in it and sent the reader to Discord to finish the job. The keys are the op's own — resolveReleaseDate() in core/ops/patchnotes.js reads `releaseDate`.
        return { type: 'patchnote.addSeason', target: null,
                 payload: { titleOverride: fields.title, releaseDate: fields.endDate,
                            description: fields.description || '', urls1: fields.urls1 || [], urls2: fields.urls2 || [] } };
    }
    const entity = KIND_TO_ENTITY[kind];
    if (entity === 'draw') {
        // core/ops/draws.js validates payload.date (matching the SeasonalData schema's newDraws/ returningDraws[].date field, and utils/adminParser.js's parseBulkDrawList -- draws have no separate start/end, unlike calendar events, whose schema genuinely has both). ⚠️ `windowEnd` IS DELIBERATELY NOT SPREAD IN. A draw's record has one date and no window (see buildSeasonAddOps below), so the payload is written key by key rather than from `...fields` — a spread would put a field the schema does not declare onto the subdocument, which Mongoose silently drops on the next fetch and nothing would report.
        const payload = { title: fields.title, category: KIND_TO_DRAW_CATEGORY[kind], date: fields.endDate, items: fields.items || [] };
        if (fields.thumbnailUrl) payload.thumbnailUrl = fields.thumbnailUrl;
        return { type: 'draw.add', target: null, payload };
    }
    // 🔴 THE CATEGORY IS LOOKED UP, NEVER DEFAULTED. The line above used to read `category: fields.category || (kind === 'playlist' ? 'Playlist' : 'Event')`, so ANY kind that reached here and was not `playlist` was filed as an Event -- which is exactly how the patch-note chip staged a calendar event (see the comment at the top of this function). Adding a third calendar kind would have repeated it silently, under a control labelled "Draw window". An unknown kind now throws by name instead.
    const category = fields.category || KIND_TO_CALENDAR_CATEGORY[kind];
    if (!category) throw new Error(`buildSeasonAddOp: no calendar category for kind "${kind}"`);
    return { type: 'calendar.add', target: null, payload: { title: fields.title, startDate: fields.startDate, endDate: fields.endDate, category, isOngoing: !!fields.isOngoing, isDoubleCP: !!fields.isDoubleCP } };
}

// 🔴 ONE COMPOSER ENTRY, TWO OPS — AND THAT IS WHY "DRAW WINDOW" IS NO LONGER A KIND YOU PICK. A draw window is not a thing anybody sets out to create: it is the answer to "how long can this draw be bought for", which is a property of the draw you are already describing. Offering it as a seventh chip made the reader compose the same draw twice, in two controls, and hope the two titles matched — and nothing checked that they did, which is exactly what the Track's own "orphan window" repair finding is for. So the draw form takes an optional closing date, and when it is set this stages the draw AND the `calendar.add` row that is its window, in one changeset, under one title, by construction.
//
// ⚠️ THE WINDOW OPENS ON THE RELEASE DATE, never on today: a draw window that starts before the draw exists is a row the Track would draw running past its own subject.
//
// ⚠️ It reuses KIND_TO_CALENDAR_CATEGORY's `drawwindow` entry rather than writing 'Draw' here. The mapping is still the one table that says what each kind stores, and a literal at this call site would be a second copy of it that could drift while agreeing with itself.
function buildSeasonAddOps(kind, fields) {
    const ops = [buildSeasonAddOp(kind, fields)];
    if (fields && fields.windowEnd) {
        ops.push(buildSeasonAddOp('drawwindow', { title: fields.title, startDate: fields.endDate, endDate: fields.windowEnd }));
    }
    return ops;
}

// Edits one field of an existing row, preserving the rest -- draw.edit/calendar.edit's validate() needs the full record, not a partial patch (core/ops/draws.js, core/ops/calendar.js). Dates are passed as bare ISO date strings (YYYY-MM-DD) rather than a full ISO datetime, since validate() re-parses them through chrono-node's parseAdminDate() (an op arriving as JSON over HTTP never satisfies the "already a real Date instance" fast path those functions also support) and a bare date is the form that parser is built for.
function toChronoDateString(value) {
    if (!value) return value;
    return new Date(value).toISOString().slice(0, 10);
}

function buildSeasonEditOp(row, columnKey, newValue) {
    // 🔴 A PUBLICATION IS NOT A CALENDAR ENTRY, AND THIS FUNCTION ONLY KNOWS TWO SHAPES. It branches on
    //    isDraw and everything else falls to calendar.edit — so once patch notes joined the Manifest
    //    (2026-08-31, when the conformance collapse removed the flag that had kept them out) a row edit
    //    on a publication built a calendar op carrying a patch-note document. Refuse it here rather than
    //    rely on core/ to reject it: "probably refused by a layer I did not check" is not a guard.
    //    Patch notes are edited in the Season Record panel, which is their home.
    if (row.lane === 'patchNotes') return null;
    const isDraw = row.lane === 'newDraws' || row.lane === 'returningDraws';
    const type = isDraw ? 'draw.edit' : 'calendar.edit';
    const target = isDraw ? { category: LANE_TO_CATEGORY[row.lane], elementId: row.id } : { elementId: row.id };
    // The Manifest row's own display field is called `window`/`endDate` regardless of entity (see toManifestRows above), but a draw's real schema/op field is `date`, not `endDate` -- a row edit on the Manifest's synthetic `endDate` display key must be routed onto the correct real payload key per entity before it reaches core/ops.
    const rawPayload = { ...row, [columnKey]: newValue };
    delete rawPayload.id; delete rawPayload.lane; delete rawPayload.state; delete rawPayload.window; delete rawPayload.topicVar; delete rawPayload.typeLabel;
    if (isDraw) {
        rawPayload.date = rawPayload.endDate ?? rawPayload.date; delete rawPayload.endDate;
    } else {
        // core/ops/calendar.js's validateEvent reads the START date as raw payload.startDate, even though the STORED field is `date` -- a real field-name mismatch (matching the class of bug already fixed for draws) found auditing Task 4's editOpFor, which shares this exact contract. A Manifest row's own field is `date` (the raw SeasonalData subdocument's real name), so it must be renamed before it reaches validateEvent, or a calendar edit fails validation outright ("Could not read the start date").
        rawPayload.startDate = rawPayload.date; delete rawPayload.date;
    }
    const payload = { ...rawPayload };
    if (payload.startDate) payload.startDate = toChronoDateString(payload.startDate);
    if (payload.endDate) payload.endDate = toChronoDateString(payload.endDate);
    if (isDraw && payload.date) payload.date = toChronoDateString(payload.date);
    return { type, target, payload };
}

// ── THE VISIBLE WINDOW: ZOOM AND PAN ──────────────────────────────────────────────────────────
//
// 🔴 THE TRACK HAD ONE WINDOW AND NO WAY TO CHANGE IT. `seasonWindow()` spans everything the season holds, which for a real CODM season is six to ten weeks — so fourteen draws and twenty calendar items shared one axis and the single-day ones (eleven of the fourteen) computed to under two pixels each. The plot was complete and unreadable, which is the failure mode a fixed window always has: it cannot be wrong, only useless.
//
// ⚠️ EVERY WINDOW IS CLAMPED TO THE FULL ONE. Panning past the ends would show empty axis on a plot whose own subject is "what is in this season", and zooming past a day would divide by a window barGeometry cannot use. Both bounds are enforced here rather than in the handlers, so the three ways to move the window (buttons, scrubber drag, keyboard) cannot disagree about where the edges are.
const DAY_MS = 86400000;
const MIN_DAYS = 3;

function windowDays(win) {
    return Math.max(1, Math.round((Date.parse(win.end) - Date.parse(win.start)) / DAY_MS));
}

function isoDay(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}

function clampWindow(win, full) {
    const fullLo = Date.parse(full.start), fullHi = Date.parse(full.end);
    let lo = Date.parse(win.start), hi = Date.parse(win.end);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { ...full };
    if (hi - lo < MIN_DAYS * DAY_MS) hi = lo + MIN_DAYS * DAY_MS;
    // Width first, then position: a window wider than the season becomes the season, and one that fits gets slid back inside rather than squashed.
    if (hi - lo > fullHi - fullLo) return { ...full };
    if (lo < fullLo) { hi += fullLo - lo; lo = fullLo; }
    if (hi > fullHi) { lo -= hi - fullHi; hi = fullHi; }
    return { start: isoDay(lo), end: isoDay(hi) };
}

// `anchor` is 0..1 across the current window — zooming with the pointer over a bar keeps that bar under the pointer, which is what makes repeated zooming feel like moving rather than jumping. Defaults to the middle.
function zoomWindow(win, factor, full, anchor = 0.5) {
    const lo = Date.parse(win.start), hi = Date.parse(win.end);
    const span = hi - lo;
    const next = span * factor;
    const at = lo + span * anchor;
    return clampWindow({ start: isoDay(at - next * anchor), end: isoDay(at + next * (1 - anchor)) }, full);
}

function panWindow(win, days, full) {
    const shift = days * DAY_MS;
    return clampWindow({ start: isoDay(Date.parse(win.start) + shift), end: isoDay(Date.parse(win.end) + shift) }, full);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { inkOn, inkOnTopic, TOPIC_HEX, seasonSpanGeometry, spanBarFor, nowPctIn, buildSeasonAddOp, buildSeasonAddOps, buildSeasonEditOp, LANE_TO_CATEGORY, KIND_TO_ENTITY, KIND_TO_CALENDAR_CATEGORY, LANE_LABELS, CAL_CATEGORY, calCategoryOf, toManifestRows, stateForElement, seasonWindow, topicVarFor, typeLabelFor, isPlaylist, toBoardItems, newestPatchNoteId };
}

// ── THE SEASON'S DEADLINE LINES ───────────────────────────────────────────────────────────────
//
// Three lines end a season and they do not end together: the battle pass, the ranked series and DMZ. models/SeasonalData.js stores each as a title/end/TBD triple, and every surface that counts down to "the end of the season" has to say WHICH end it means — a single number is a lie whenever two of the three differ, which is most seasons.
//
// 🔴 THE LINES ARE READ FROM THE SEASON DOCUMENT, NEVER FROM A FIELD SOMEBODY INVENTED. The mockup's first version of this read `Shell._LINES`, which nothing anywhere set — so it returned an empty array and the clock rendered "No deadline set for this season" on a season with three of them. It did not throw and it did not look broken; it looked like a season with no dates. A well-formed answer to a question nobody asked is the failure mode this whole file guards against.
const SEASON_LINES = [
    { key: 'bp', label: 'BATTLE PASS', titleKey: 'bpTitle', endKey: 'bpEnd', tbdKey: 'bpEndTBD', hex: '#F2994A' },
    { key: 'rank', label: 'RANKED', titleKey: 'rankTitle', endKey: 'rankEnd', tbdKey: 'rankEndTBD', hex: '#FF3430' },
    { key: 'dmz', label: 'DMZ', titleKey: 'dmzTitle', endKey: 'dmzEnd', tbdKey: 'dmzEndTBD', hex: '#337BA6' },
];

// The still-future deadlines, GROUPED BY DATE and soonest first. Grouping is the point: a season whose battle pass and ranked series end on the same day has ONE wall, not two, and a clock that counts the same moment twice is telling you there is more time than there is.
function seasonMoments(season, today) {
    if (!season) return [];
    const out = [], by = {};
    for (const L of SEASON_LINES) {
        const iso = season[L.endKey];
        if (season[L.tbdKey] || !iso) continue;
        const day = String(iso).slice(0, 10);
        if (!by[day]) { by[day] = { iso: day, lines: [] }; out.push(by[day]); }
        by[day].lines.push(L);
    }
    const t = new Date(String(today).slice(0, 10) + 'T00:00:00Z').getTime();
    return out.filter((m) => new Date(m.iso + 'T23:59:59Z').getTime() >= t).sort((a, b) => (a.iso < b.iso ? -1 : 1));
}

// A deadline lands at the END of its day — a season ending "Sep 10" is live all through Sep 10. Counting to midnight AT THE START of that day loses a full day, which on a two-day warning is half the warning.
function countdownParts(iso, nowMs) {
    if (!iso) return null;
    const end = new Date(String(iso).slice(0, 10) + 'T23:59:59Z').getTime();
    let ms = end - nowMs;
    if (ms <= 0) return { past: true, d: 0, h: 0, m: 0, s: 0 };
    const d = Math.floor(ms / 86400000); ms -= d * 86400000;
    const h = Math.floor(ms / 3600000); ms -= h * 3600000;
    const m = Math.floor(ms / 60000); ms -= m * 60000;
    return { past: false, d, h, m, s: Math.floor(ms / 1000) };
}

// 🔴 FIVE TIERS, NOT ONE ORANGE. Time pressure is continuous, and a single "hot" state means the element says exactly one thing for the twenty days before it says another. Each tier REMOVES something rather than adding a colour: further out, the seconds stop mattering; closer in, the days do.
function seasonTier(days) {
    if (days === null || days === undefined) return 'none';
    if (days <= 0) return 'today';
    if (days <= 2) return 'final';
    if (days <= 7) return 'closing';
    if (days <= 21) return 'running';
    return 'open';
}

// ── THE SEASON RECORD ─────────────────────────────────────────────────────────────────────────
//
// 🔴 FOUR PATCH-NOTE OPERATIONS WERE DECLARED AND UNREACHABLE — setDateInfo, setUrls1, setUrls2 and editSeason. The portal could publish a patch note season and purge every one of them, and could not so much as fix a typo in between. Found by conservation (scripts/portalOpsReach.test.js) rather than by looking, which is the only way an absence is ever found.
//
// 🔴 THE CURRENT ENTRY AND A PAST ONE TAKE DIFFERENT OPS, and that is the bot's own split rather than a simplification. /manage edits the newest entry through three separate actions — date/info, images 1-5, images 6-10 — and edits a past one through a single editSeason. Following that means a change made here reads on the Review screen exactly as the same change made in Discord would, and each inverts the way the bot's own undo does.
const MAX_PATCH_IMAGES = 10;
const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function patchRecordRows(live) {
    return ((live && live.patchNotes) || [])
        .map((n) => ({
            id: String(n._id),
            title: (n.titleOverride || n.title || 'Untitled season').trim(),
            titleOverride: n.titleOverride || '',
            description: n.description || '',
            images: n.images || [],
            releaseDate: n.releaseDate || null,
            // Sent by portal/api/season.js, formatted by the bot's own formatReleaseDateTime so the field starts life holding a value its parser reads back. Absent only in a fixture that predates that route change, where an empty prefill is the honest answer rather than a guessed format.
            releaseDateText: n.releaseDateText || '',
        }))
        .sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')))
        .map((n, i) => ({ ...n, current: i === 0 }));
}

// 🔴 AN UNTOUCHED DATE FIELD SENDS THE STORED ISO, NOT THE TEXT, and that is a measurement rather than a preference. formatReleaseDateTime renders to the MINUTE, so a stored 16:27:56.919 comes back as "July 6, 2026 12:27 PM" and re-parses to 16:27:00.000 — editing only a description would have quietly moved the record by 57 seconds. chrono parses a raw ISO string back to the identical instant (verified against the real parser in scripts/portalPatchNotes.test.js), so the untouched case round-trips exactly and only a date somebody actually typed is re-read as prose.
//
// ⚠️ AN EMPTY DATE IS REFUSED, because parseReleaseDateTime('') returns `new Date()` rather than null — a blank field would not clear the release date, it would silently set it to the moment you pressed the button.
function patchEditOps(entry, draft) {
    const dateText = String(draft.releaseDateText ?? entry.releaseDateText ?? '').trim();
    if (!dateText) {
        return { ops: [], blocked: 'A release date is required — leaving it blank would set this entry to right now, not clear it.' };
    }
    const urls = (draft.urls || []).map((u) => String(u).trim()).filter(Boolean).slice(0, MAX_PATCH_IMAGES);
    const titleOverride = String(draft.titleOverride ?? entry.titleOverride ?? '').trim();
    const description = String(draft.description ?? entry.description ?? '');
    const was = entry.images || [];
    const dateTouched = dateText !== String(entry.releaseDateText || '').trim();
    const releaseDate = dateTouched ? dateText : String(entry.releaseDate || '');
    const infoChanged = dateTouched
        || titleOverride !== String(entry.titleOverride || '').trim()
        || description !== String(entry.description || '');
    const urlsChanged = !sameList(urls, was);
    if (!infoChanged && !urlsChanged) return { ops: [], blocked: '' };

    if (!entry.current) {
        // editSeason carries every field at once, which is what the bot's past-season modal sends and why it needs both URL slots even when only one changed.
        return { ops: [{ type: 'patchnote.editSeason', target: { elementId: entry.id },
            payload: { titleOverride, description, releaseDate, urls1: urls.slice(0, 5), urls2: urls.slice(5, 10) } }], blocked: '' };
    }
    const ops = [];
    if (infoChanged) ops.push({ type: 'patchnote.setDateInfo', target: { elementId: entry.id }, payload: { titleOverride, description, releaseDate } });
    // Each slot is its own op with its own inverse, so a slot nobody touched is never resubmitted — cachePatchImage re-hosts every URL it is handed, and re-sending an unchanged slot would re-upload five images to say nothing.
    if (!sameList(urls.slice(0, 5), was.slice(0, 5))) ops.push({ type: 'patchnote.setUrls1', target: { elementId: entry.id }, payload: { urls: urls.slice(0, 5) } });
    if (!sameList(urls.slice(5, 10), was.slice(5, 10))) ops.push({ type: 'patchnote.setUrls2', target: { elementId: entry.id }, payload: { urls: urls.slice(5, 10) } });
    return { ops, blocked: '' };
}

// ── LIVE vs DRAFT ─────────────────────────────────────────────────────────────────────────────
//
// 🔴 PROMOTE IS ONE-WAY AND THERE WAS NO WAY TO SEE WHAT IT WOULD DO. A draft can be built for weeks — titles, three deadlines, draws, a whole calendar — and the only irreversible operation in the realm replaces the live season with it. The scope switch let you EDIT the draft; nothing anywhere would show you the difference. An irreversible action whose effect cannot be inspected beforehand is the exact shape the staging model exists to remove, one level up.
//
// ⚠️ COMPARED ON NORMALISED VALUES, DISPLAYED WITH A FORMATTER. A date is compared as its stored ISO day and rendered by the caller's own `fmt`, so "same day, different string" cannot show up as a change — which is what a comparison of formatted text would do the moment one side carried a time and the other did not.
//
// ⚠️ TBD IS A VALUE, NOT AN ABSENCE. A deadline moving from a real date to TBD is a change worth seeing, and comparing the date fields alone would call that pair identical whenever both happened to be empty.
function draftDiff(live, draft, fmt) {
    const show = typeof fmt === 'function' ? fmt : ((v) => v);
    const day = (v) => (v ? String(v).slice(0, 10) : '');
    const rows = [];
    const push = (key, a, b, add) => { if (a !== b) rows.push({ key, was: a, now: b, add: Boolean(add) }); };
    const L = live || {};
    const D = draft || {};

    push('title', L.currentSeasonTitle || '', D.currentSeasonTitle || '');
    for (const line of SEASON_LINES) {
        const label = line.label.toLowerCase();
        push(label, L[line.titleKey] || '', D[line.titleKey] || '');
        const endOf = (o) => (o[line.tbdKey] ? 'TBD' : day(o[line.endKey]));
        const a = endOf(L), b = endOf(D);
        if (a !== b) rows.push({ key: `${label} ends`, was: a === 'TBD' ? 'TBD' : (a ? show(a) : ''), now: b === 'TBD' ? 'TBD' : (b ? show(b) : ''), add: false });
    }

    // Content is one row rather than a list, because the draft's items are visible on the Track and this column answers a different question: how much of the season is about to be replaced.
    const count = (o) => (o.newDraws || []).length + (o.returningDraws || []).length + (o.calendar || []).length;
    const liveN = count(L), draftN = count(D);
    if (liveN !== draftN) {
        rows.push({ key: 'content', was: `${liveN} live item${liveN === 1 ? '' : 's'}`,
            now: `${draftN} item${draftN === 1 ? '' : 's'} after promote`, add: draftN > liveN });
    }
    return { rows, identical: rows.length === 0 };
}

// ── THE DEADLINE RAIL ─────────────────────────────────────────────────────────────────────────
//
// 🔴 THE TRACK DREW THE DEADLINES AND NEVER NAMED THEM. Three vertical lines crossed the lanes in three colours and nothing on the axis said which was which — so "the thing that ends on the 10th" was a colour you had to remember, and TWO of them end on the same day in the live season. The rail is the flag row those lines were always missing.
//
// ⚠️ THE FLAGS ARE NOT DRAGGABLE HERE, and that is a decision rather than a reduced version of one. The adopted stylesheet gives `.dflag` an `ew-resize` cursor because the page it was drawn for had no other way to change a deadline; this portal has the identity editor directly above, where a date is typed and parsed by the bot's own chrono. A season deadline has to be exact, and a coarse gesture over a 44-day axis is the wrong instrument for a value that must land on one day. The cursor is overridden so the chip does not promise a gesture it does not have.
//
// ⚠️ STACKING IS BY PROXIMITY IN THE WINDOW, not by measured pixel width. The mockup measures each chip's rendered width and stacks on overlap; that needs the DOM, cannot be tested, and re-runs on every zoom. Proximity as a FRACTION OF THE VISIBLE SPAN is the same question asked of the data: two deadlines close enough together to collide at this zoom get different rows. It is approximate at the edges and it is deterministic, which is the trade this file exists to make.
const RAIL_LABEL = { bp: 'battle pass', rank: 'ranked', dmz: 'DMZ' };
const RAIL_GAP = 0.14;      // of the visible span — two flags nearer than this share a column
const RAIL_LEVELS = 3;      // the stylesheet defines lvl1 and lvl2 on top of the base row
// ⚠️ A PIN DOES NOT SHARE THE FLAGS' LADDER, and trying to make it was a wrong turn worth recording: a flag is TOP-anchored and a pin is BOTTOM-anchored, so a "level" moves them toward each other. Giving the pin a flag level lifted it INTO the flag row it was meant to clear — measured, worse than the collision it was fixing. Pins stack among themselves, upward from the floor; the flags' rows are reserved by the rail's own height instead.

function deadlineRail(season, from, to) {
    const dayOf = (v) => (v ? String(v).slice(0, 10) : null);
    const span = (new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000 || 1;
    const all = SEASON_LINES
        .map((L) => ({ key: L.key, label: RAIL_LABEL[L.key] || L.key, hex: L.hex,
            title: (season || {})[L.titleKey] || '', tbd: Boolean((season || {})[L.tbdKey]), date: dayOf((season || {})[L.endKey]) }))
        .filter((d) => d.date && !d.tbd)
        .sort((a, b) => (a.date < b.date ? -1 : 1));

    // 🔴 TWO DEADLINES ON ONE DATE ARE ONE MOMENT, NOT TWO CHIPS. Battle Pass and Ranked both end Sep 10, and drawing a chip each put two boxes over one line with two stems to the same x — then a `.dnotch` underneath asserted, a THIRD time, that the date was shared. Two labels for one moment is a modelling error, and the season clock in the masthead had already modelled it correctly ("UNTIL SEP 10 · BATTLE PASS · RANKED"), so one page disagreed with itself one screen apart. Grouping by date BEFORE the rows are packed also fixes the alignment by construction: one date, one chip, one stem, and a `.dfk` key dot per deadline in the group.
    const byDate = new Map();
    for (const d of all) {
        if (!byDate.has(d.date)) byDate.set(d.date, []);
        byDate.get(d.date).push(d);
    }
    const merge = (members) => ({ ...members[0], members,
        key: members.map((m) => m.key).join('+'),
        label: members.map((m) => m.label).join(' + ') });

    const flags = []; const pins = [];
    const lastAt = new Array(RAIL_LEVELS).fill(-Infinity);
    for (const [date, members] of byDate) {
        const at = (new Date(date + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000;
        if (at < 0 || at > span) {
            const side = at < 0 ? 'l' : 'r';
            pins.push({ ...merge(members), side, away: Math.round(side === 'l' ? -at : at - span) });
            continue;
        }
        const frac = at / span;
        // The lowest row whose previous flag is far enough away. Past the last row a flag shares row 2 rather than vanishing — an overlapping chip is readable, an absent deadline is not.
        let level = lastAt.findIndex((prev) => frac - prev > RAIL_GAP);
        if (level === -1) level = RAIL_LEVELS - 1;
        lastAt[level] = frac;
        flags.push({ ...merge(members), level, pct: frac * 100 });
    }
    // 🔴 A PIN TOOK NO ROW ON THE RAIL AT ALL and welded to the edge on top of whatever sat there — measured live, "DMZ NOV 11 · 53d beyond this view" overlapping the Ranked flag. Two pins on one edge would have done the same to each other. They stack by ARRIVAL ORDER on their own side, and the rail reserves the height (see railBox in track.logic.js), which is what actually keeps them clear of the flags.
    const perSide = { l: 0, r: 0 };
    for (const p of pins) p.level = perSide[p.side]++;
    // ⚠️ ONLY THE ONES THAT FALL INSIDE THE VIEW. A patch note outside the window has no x on this axis, and pinning it to an edge — which the DEADLINES do — would be wrong here: a deadline beyond the edge is a fact about the boundary, a patch note beyond it is simply not in this picture.
    const patches = (((season || {}).patchNotes) || [])
        .map((n) => ({ id: String(n._id), title: (n.titleOverride || n.title || 'Untitled').trim(), date: dayOf(n.releaseDate) }))
        .filter((p) => p.date && p.date >= from && p.date <= to);
    return { flags, pins, patches };
}

// ── WHAT A MANIFEST ROW IS, BEYOND ITS NAME ───────────────────────────────────────────────────
//
// 🔴 THE TABLE SAID WHAT EVERY ITEM WAS CALLED AND NOTHING ABOUT WHAT WAS IN IT. A draw's whole point is the items it carries and their rarity; the row showed a title, a type and a date. These three derive the rest from the record the row already carries — `toManifestRows` spreads the full item onto it precisely so nothing downstream has to go back for more.
//
// ⚠️ ONLY THE THREE TIERS THE STYLESHEET DEFINES GET A CLASS. `resolveTier` also returns `legacy` and a title-cased fallback for anything it does not know, and inventing `t-legacy` would emit a class with no rule — an orphan. An unclassed chip still reads, because `.tiers b` carries the shape.
const TIER_CLASS = { legendary: 't-leg', mythic: 't-myth', epic: 't-epic' };

function rowTiers(row) {
    const seen = [];
    for (const item of (row && row.items) || []) {
        // A `-# comment` line is a note attached to the draw, not an item with a rarity — counting it as a tier would put a chip on the row for a sentence.
        const t = String(item.tier || '').toLowerCase();
        if (!t || t === 'comment') continue;
        if (!seen.includes(t)) seen.push(t);
    }
    return seen;
}

function rowDetail(row) {
    if (!row) return '';
    // ⚠️ EVERY LINE COUNTS. A comment line is not a RARITY — which is why rowTiers excludes it — but it is still an item in the draw, and the design's own detail says "5 items" where filtering it says 4.
    const items = (row.items) || [];
    // ⚠️ A COUNT, NOT A LIST. Spelling out every item name filled the widest column with a comma string that wraps to three lines and still truncates — the tier chips beside it already say WHAT is in the draw, and the number says how much. The design's own detail is "5 items", and the names live one click away where there is room for them.
    if (items.length) return `${items.length} item${items.length === 1 ? '' : 's'}`;
    // ⚠️ NOT THE CATEGORY. The column asks what a row CARRIES, and the Type column two along already says it is a playlist — printing it again here made 26 rows answer a question nobody asked and hid the design's own "no detail", which is the honest answer for a calendar entry. The one thing a calendar row does carry is the fact that it never ends, which no other column states.
    if (row.isOngoing) return 'runs all season';
    return '';
}

// ⚠️ COMPARED ON THE DAY, and both ends are INCLUSIVE. An entry whose last day is today is still running — treating `end < now` as ended retires it at midnight of the morning it is still live, which is the whole span of a one-day event. ⚠️ A PUBLICATION'S LIFECYCLE IS NOT A DATE COMPARISON. The newest patch note is the current one and every older one is history — the Board already derives it that way (newestPatchNoteId) and the Manifest did not, so every note including the newest read ENDED.
function rowLifecycle(row, today) {
    if (row && row.lane === 'patchNotes') {
        const start = String(row.date || row.startDate || '').slice(0, 10);
        if (start && start > String(today).slice(0, 10)) return 'upcoming';
        return row.isNewestPatchNote ? 'live' : 'ended';
    }
    return rowLifecycleByDate(row, today);
}

// 🔴 ONE LIFECYCLE, NOT TWO. This file had its own date comparison and board.logic.js has `lifecycleOf`, ported from the design — and they disagreed on nine of thirty-nine rows, so the Manifest said ENDED beside a Board card in Live now. The rule that matters is the one this copy did not have: a draw with no calendar window of its own (`dateOnly`) never ends, which is the exact bug that shipped in the bot and was fixed on 2026-08-07. Delegating means they cannot drift apart again.
function rowLifecycleByDate(row, today) {
    if (!row) return '';
    const start = String(row.date || row.startDate || '').slice(0, 10);
    if (!start) return '';
    // 🔴 `dateOnly` IS WHAT MAKES A WINDOWLESS DRAW PERMANENT, and this row never carried it — so nine rows the Board calls LIVE NOW the table called ENDED, from the same data, one tab apart. It is computed in toBoardItems from the calendar's draw windows; a manifest row has to be told.
    const point = row.lane === 'newDraws' || row.lane === 'returningDraws';
    return lifecycleFn()({ ...row, kind: row.kind || (point ? 'point' : 'span'),
        dateOnly: row.dateOnly !== undefined ? row.dateOnly : point,
        startDate: start, endDate: row.endDate || null, state: 'live' }, { today });
}

// The design's own words. "finished" and "not yet" were this file's invention; the row's second line is a STATE label in the same register as SAVED and NOT LIVE beside it, not a sentence fragment.
const LIFE_LABEL = { live: 'LIVE NOW', running: 'LIVE NOW', upcoming: 'UPCOMING', staged: 'NOT LIVE', ended: 'ENDED' };

if (typeof module !== 'undefined' && module.exports) {
    Object.assign(module.exports, { patchRecordRows, patchEditOps, MAX_PATCH_IMAGES, draftDiff, deadlineRail, RAIL_LABEL,
        rowTiers, rowDetail, rowLifecycle, TIER_CLASS, LIFE_LABEL });
}

if (typeof module !== 'undefined' && module.exports) {
    Object.assign(module.exports, { SEASON_LINES, seasonMoments, countdownParts, seasonTier,
                                    windowDays, clampWindow, zoomWindow, panWindow });
}
