// portal/ui/season.js — ESM. The Season realm: Track/Board as the switchable view layer, Manifest (never switches) underneath. Covers /manage's draws/calendar/patchnotes/seasondraft/season pages (spec §8.2's join table) — visible if the signed-in admin holds ANY of them.
//
// buildSeasonAddOp/buildSeasonEditOp (season.logic.js) and editOpFor (track.logic.js) are read as bare GLOBALS, not imported -- both are loaded as classic <script> tags before this module (see track.js's own header comment for why). A literal `import {...} from './season.logic.js'` shipped here once and would throw in every real browser (no `export` statement exists in a classic script); found auditing this file for Task 4 and never actually exercised live before, since every prior verification pass used direct authenticated `fetch` calls or the signed-out Door page, neither of which loads this module as real ESM.
import { h } from '../vendor/preact.mjs';
import { html } from '../vendor/htm-preact.mjs';
import { useState, useEffect } from '../vendor/preact-hooks.mjs';
import { Shell, NoAccess, Masthead, useCreateKey } from './shell.js';
import { fetchJson } from './httpClient.js';
import { useAsync, RealmShell } from './async.js';
import { OneWay } from './oneway.js';
import { stageOps, exportChangeset } from './composeClient.js';
import { downloadText } from './download.js';
import { useRef } from '../vendor/preact-hooks.mjs';
import { Board } from './board.js';
import { Manifest, StatePill } from './manifest.js';
import { useOverlay, Drawer } from './overlay.js';
import { DiscordCard } from './v2Render.js';
import { Composer } from './composer.js';
import { Track, Zoomer, Repairs } from './track.js';

// LANE_LABELS lives in season.logic.js (a bare global here, same pattern as buildSeasonAddOp/buildSeasonEditOp above) rather than a local const, so scripts/seasonOps.test.js can require() it directly instead of regex-scraping this ESM file's source text. Gap audit §3.4 finding 1: Manifest printed row.lane's raw collection-key value verbatim (e.g. "newDraws") since nothing humanized it for display. 🔴 THE ROW SAID WHAT A THING WAS CALLED AND NOTHING ABOUT WHAT IS IN IT. A draw's whole point is the items it carries and their rarity — the table showed a title, a type and a date, so the one question this list exists to answer needed a click per row. The adopted table styles a detail cell, tier chips, a secondary line and a right-aligned status column; all four were styled and unused. ⚠️ A READABLE MAP, NOT A BUILT STRING. The design's markup emits the full tier word, and writing that as `t-${tier}` makes the three rules it needs invisible to the reverse-orphan scan — which reads source, not a running page, and correctly reported them as rules nothing triggers. Spelling them out costs three lines and keeps the gate able to see what is emitted.
const TIER_WORD_CLASS = { legendary: 't-legendary', mythic: 't-mythic', epic: 't-epic' };

const SEASON_COLUMNS = [
    { key: 'title', label: 'Item', editable: true, liveEdit: true },
    // row.typeLabel is stamped by toManifestRows and already resolves Playlist away from Event; LANE_LABELS stays as the fallback so a row built by anything older still reads correctly.
    { key: 'lane', label: 'Type', col: 'c-type', render: (row) => row.typeLabel || LANE_LABELS[row.lane] || row.lane,
      metaClass: 'rowlife',
      meta: (row) => (row.isDraft
          ? html`<span class="nextmark">NEXT SEASON</span>`
          : (LIFE_LABEL[rowLifecycle(row, todayIso())] || '')) },
    { key: 'window', label: 'Window', col: 'c-win', dataKind: 'nums',
      sortValue: (row) => String(row.startDate || row.date || row.releaseDate || ''),
      render: (row) => {
          const start = row.date ? fmtDay(row.date) : null;
          const end = (row.endDate || row.date) ? fmtDay(row.endDate || row.date) : null;
          if (!start) return html`<span class="none">no date</span>`;
          // ⚠️ BOTH ENDS, ALWAYS. Collapsing a same-day item to one date made the column's shape depend on the row: a one-day draw printed "Aug 18" where the row above printed "Aug 6 → Aug 19", so the arrow stopped being a column and became a property of some rows. The day count under it already says the span is one day.
          return html`${start} <span class="arw">→</span> ${end || start}`;
      },
      meta: (row) => {
          const a = row.date ? new Date(String(row.date).slice(0, 10)) : null;
          const b = (row.endDate || row.date) ? new Date(String(row.endDate || row.date).slice(0, 10)) : null;
          if (!a || !b) return '';
          const days = Math.round((b - a) / 86400000) + 1;
          return `${days} day${days === 1 ? '' : 's'}`;
      } },
    // ⚠️ NO LABEL TEXT IN THE CELL. The window column two along already prints the dates; this one answers a different question — where in the season — and repeating the dates inside it would make the two columns argue about which is the answer.
    { key: 'span', label: 'Span', col: 'c-spark', dropSm: true, sortable: false, render: (row) => {
        // ⚠️ EVERY ROW GETS A TRACK HERE, AND THAT IS NOT THE SAME QUESTION THE BOARD ASKS. This column answers "where in the season", which a release has an answer to — a mark at its date. It was the BOARD CARD that had to stop drawing a progress bar under a moment; gating this one the same way removed sixteen marks the design draws and replaced them with an em dash.
        if (!row.span) return html`<span class="none">—</span>`;
        // 🔴 THE BAR CARRIES ITS STATE AND ITS PROGRESS, and this drew neither. The design's spark marks the bar with the row's state — `.saved` is the filled treatment, which is why sixty-two of them exist on a page where this emitted thirty-nine unclassed ones — and nests a `.done` fill showing how far through a running item is. Both rules are already in the stylesheet with nothing emitting them. `.nowdot` is a span, not an `i`: `i` is the BAR in this component. From the DATES, as the design computes it — how far through its own window the item is. Deriving it from the drawn geometry instead produced a figure that was right only when the bar happened to fill the track, so twenty of the design's progress fills never appeared.
        const dd = (x, y) => Math.round((new Date(String(y).slice(0, 10) + 'T00:00:00Z')
            - new Date(String(x).slice(0, 10) + 'T00:00:00Z')) / 86400000);
        const sd = row.date || row.startDate, ed = row.endDate || row.date;
        // TODAY INSIDE THE WINDOW is the condition, not a lifecycle label: the two agree on most rows and disagree on exactly the ones this fill is for — a span that started before today and has not finished. Keyed on the label, twenty-one of the design's progress fills never drew.
        const today = todayIso();
        // 🔴 THE CONDITION IS "IS THIS ROW LIVE", NOT "IS TODAY INSIDE A WINDOW", and the difference is
        //    every POINT. A release and a publication have one date, so `ed === sd` excluded them and nine
        //    live rows drew no fill at all. rowLifecycle is the same function the row's own LIVE NOW label
        //    reads, so the fill and the label can no longer disagree about the same row — which is what the
        //    earlier label-keyed version was corrected FOR, having keyed on the wrong label.
        const live = rowLifecycle(row, today) === 'live';
        const elapsed = live && sd && ed ? Math.max(0, Math.min(100, (dd(sd, today) / Math.max(1, dd(sd, ed))) * 100)) : 0;
        // ⚠️ NO WRAPPER HERE. `.sparkwrap` belongs to the BOARD CARD, where the track sits under a name and needs its own box; in the table the cell IS the box, and the extra div was thirty-nine elements the design does not have.
        return html`
                <span class="spark" style=${`--c:var(${row.topicVar || '--ink4'})`}>
                    <i class=${row.state === 'staged' ? 'staged' : 'saved'} style=${`left:${row.span.left}%;width:${row.span.width}%`}>
                        ${elapsed ? html`<span class="done" style=${`width:${elapsed}%`}></span>` : null}
                    </i>
                    ${row.nowPct === null || row.nowPct === undefined ? null
                        : html`<span class="nowdot" style=${`left:${row.nowPct}%`}></span>`}
                </span>`;
    } },
    { key: 'detail', label: 'Detail', dataKind: 'detail', sortable: false, render: (row) => {
        const tiers = rowTiers(row);
        const detail = rowDetail(row);
        return html`
            <div class="detcell">
                ${tiers.length ? html`<span class="tiers">${tiers.map((t) => html`<b key=${t} class=${TIER_WORD_CLASS[String(t).toLowerCase()] || ''}>${t}</b>`)}</span>` : null}
                ${row.detailText ? html`<span class="dsub">${row.detailText}</span>`
                    : detail ? html`<span class="dsub">${detail}</span>`
                    : html`<span class="dsub"><span class="none">no detail</span></span>`}
                <!-- A draw's thumbnail is re-hosted on Cloudinary when it is saved; "not cached" is a fact
                     about THIS record, and the only place it was visible before was a Discord card. -->

            </div>`;
    } },
    // ⚠️ THE WARNING RIDES BESIDE THE STATE, not in a column of its own: "this outlives the battle pass" is a qualification of what the row IS, and a whole column for a mark that is absent on most rows is a column of empty cells. 🔴 A PILL, NOT A WORD. COMPANION §0.0's law is SHAPE = state, and this cell rendered `live` / `staged` as bare lowercase text — the one column whose entire job is to carry state had no shape at all, while the mockup draws a filled chip on all 39 rows. The Manifest's own default renderer already emits this exact markup; supplying a custom `render` for the warnmark quietly opted out of it. `StatePill` is exported from manifest.js so the two can never drift into two vocabularies again.
    { key: 'state', label: 'State', dataKind: 'right', sortable: false,
      // The "outlives the battle pass" mark is not lost with the warnmark: the design's own Repairs checks report it as a finding, which is where a qualification about a row belongs rather than in the row.
      render: (row) => html`<${StatePill} state=${row.state} accent=${row.accentHex || `var(${row.topicVar || '--ink3'})`} />` },
];

// 03-three-surfaces.html's filter row. One chip per GROUP, cycling its own options -- see manifest.js's FilterChips for why that shape rather than one chip per possible value. 🔴 THREE CHIPS FOR SIX KINDS OF THING. The filter read the row's STORAGE key — newDraws, returningDraws, calendar — so a draw window, an event and a playlist all filtered as "Event", and the three the calendar holds could not be told apart at all. The design's chips are the LANES, in the lane colours, which is the same vocabulary the Track, the row dots and the composer use.
const SEASON_FILTERS = [
    { key: 'typeLabel', label: 'Type', topic: true, options: [
        { value: 'New draws', label: 'New draws', hex: 'var(--draw)' },
        { value: 'Returning', label: 'Returning', hex: 'var(--ret)' },
        { value: 'Draw windows', label: 'Draw windows', hex: 'var(--dw)' },
        { value: 'Events', label: 'Events', hex: 'var(--ev)' },
        { value: 'Playlists', label: 'Playlists', hex: 'var(--play)' },
        { value: 'Patch notes', label: 'Patch notes', hex: 'var(--patch)' },
    ] },
    // The state filter is the portal's own second group. The design filters Season by TYPE and offers "Staged only" as the one state cut, which is the only one with an action behind it; four more chips for states the key already explains is a second vocabulary in the same row.
];


// Builds the id/lane-carrying items Track's <Bar> and track.logic.js's editOpFor both expect -- deliberately a DIFFERENT shape from toManifestRows' rows (Manifest uses lane values 'newDraws'/ 'returningDraws'/'calendar'; Track uses its own topic vocabulary 'draw'/'returning'/'event', matching track.logic.js's LANE_ORDER and TOPIC_VAR) so each stays a plain shape for its own consumer rather than one row shape trying to serve two different vocabularies. `startDate` is synthetic (draws have no such schema field) -- it exists purely so barGeometry has something to read; editOpFor strips it back out for a draw before it would ever reach core/ops/draws.js. 🔴 AN "ALL SEASON" ROW HAS NO END DATE AND THE TRACK DREW IT AS A DOT. `isOngoing` is how the calendar says a row runs until the season does — commands/calendar.js's own isEventEnded reads it that way — and this fell back to `item.date`, so a draw window open from Aug 7 to the battle pass rendered 1% wide with no room for its own name. Three consequences, all of them visible: the bar, the lane's stacking (three overlapping windows collapsed to two rows), and the overlap finding under the Track, which needs a real end date to see the overlap at all.
function toTrackItems(live, path, lane, ongoingEnd) {
    return (live?.[path] || []).map((item) => ({
        ...item, id: String(item._id), kind: lane, lane,
        startDate: item.startDate || item.date,
        endDate: item.endDate || (item.isOngoing && ongoingEnd ? String(ongoingEnd).slice(0, 10) : item.date),
    }));
}

// Playlists, events and draw windows are three lanes of one stored `calendar` array. The split is driven by `calCategoryOf` so the lane a row lands in and the label the Manifest prints for it come from one table; adding a fourth category cannot silently mean "event".
function splitCalendar(src) {
    const all = (src && src.calendar) || [];
    const of = (lane) => ({ calendar: all.filter((i) => calCategoryOf(i).lane === lane) });
    return { events: of('event'), playlists: of('playlist'), drawWindows: of('drawwindow') };
}

// 🔴 HOISTED OUT OF SeasonRealm SO HOME CAN READ THE SAME DERIVATION RATHER THAN COPY IT. Home's attention list carries a "season items to repair" row, and the design's own note on that row is the rule this file keeps re-learning: READ, never re-derive. The mockup records it twice — Home once said "133 builds · 33 need repair" where Armory said "31 · 28", and later "117 need repair" where Armory said 11 — both times because a second copy of a predicate drifted from the first. There is one builder now and both realms call it.
function buildTrackData(live) {
    const cal = splitCalendar(live);
    const windowTitles = (cal.drawWindows?.calendar || []).map((w) => String(w.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
    // ⚠️ COMPUTED OVER THE SET, NOT PER DRAW. `dateOnly` means a draw no calendar window covers — which /calendar then serves as a synthetic entry that never ends.
    const servedSynthetic = (item) => {
        const t = String(item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        return !!t && !windowTitles.some((w) => w && (w.includes(t) || t.includes(w)));
    };
    const withDateOnly = (list) => list.map((i) => ({ ...i, dateOnly: servedSynthetic(i) }));
    return {
        draw: withDateOnly(toTrackItems(live, 'newDraws', 'draw', live?.bpEnd)),
        returning: withDateOnly(toTrackItems(live, 'returningDraws', 'returning', live?.bpEnd)),
        drawwindow: toTrackItems(cal.drawWindows, 'calendar', 'drawwindow', live?.bpEnd),
        event: toTrackItems(cal.events, 'calendar', 'event', live?.bpEnd),
        playlist: toTrackItems(cal.playlists, 'calendar', 'playlist', live?.bpEnd),
    };
}

// Season's Repairs panel, summarised to one number. `findingRows` is track.logic.js's — the same six checks the panel itself renders — so Home's row and Season's own heading count the same findings by construction.
export function seasonRepairCount(live) {
    if (!live) return 0;
    const rows = findingRows(buildTrackData(live), live);
    return ['dupe', 'banner', 'pastBp', 'orphanWindows', 'noWindow', 'untagged2x']
        .reduce((n, k) => n + (rows[k] || []).length, 0);
}

// The season items that outlive the season — spans only, since a draw is a point in time and cannot run past anything. Exported as an ANSWER rather than exporting `buildTrackData`: a caller handed the builder would have to know which three of its five lanes are spans, which is precisely the knowledge that belongs on this side of the seam.
export function seasonConflictCount(live) {
    const last = seasonLastDeadline(live);
    if (!last || !live) return 0;
    const track = buildTrackData(live);
    return ['event', 'playlist', 'drawwindow']
        .flatMap((lane) => track[lane] || [])
        .filter((i) => i.endDate && String(i.endDate).slice(0, 10) > last).length;
}

// 🔴 THE SEASON'S OWN LAST DEADLINE, WHICH IS NOT THE BATTLE PASS. `bpEnd` is the FIRST of three (`SEASON_LINES`), and Home's attention row asked whether an item outlives the battle pass while the design asks whether it outlives THE SEASON. Track's own strip already carries this correction (see its header); this is the same edge, for the same reason, on the other surface.
export function seasonLastDeadline(season) {
    if (!season) return '';
    const ends = SEASON_LINES.map((L) => (season[L.tbdKey] || !season[L.endKey] ? '' : String(season[L.endKey]).slice(0, 10)))
        .filter(Boolean).sort();
    return ends.length ? ends[ends.length - 1] : '';
}

// The Add composer -- a kind picker revealing only the fields that kind's op actually needs, rather than one form with every field always visible (spec §7: desktop-first, dense, no wasted chrome). ⚠️ `AddComposer` LIVED HERE AND IS GONE. It was a select and three bare inputs in a panel — the form the adopted design replaced with the inline composer above the Track (portal/ui/composer.js). Left in place it would have been a second way to add the same things, with a different vocabulary and no natural-language dates.

// ⚠️ IT READS THE TRACK'S OWN ITEMS, not a second query. `trackData` is what the Track is drawing at this moment, so a day that lists something the Track is not showing — or omits something it is — is impossible by construction rather than by care.
//
// ⚠️ THE DRAFT IS OFF BY DEFAULT AND SAYS SO. A day drawer that silently mixed staged next-season items into today's list would answer a question nobody asked, in the one place a person is checking what players actually see. 🔴 ONE LANE VOCABULARY, NOT THREE. The design names a lane the same way wherever it appears — the Track's headers, the Manifest's chips, the composer's kinds and this drawer all read "New draws · Returning · Draw windows · Events · Playlists". This map said "Draw · Event · Playlist" and the composer's said something else again, so one record answered to two names one click apart.
const DAY_LANE_LABEL = { draw: 'Draw', returning: 'Returning', drawwindow: 'Draw window', event: 'Event', playlist: 'Playlist' };
const dayLaneLabel = (lane) => (CONFORM_KIND_WORDS[lane] || {}).label || DAY_LANE_LABEL[lane] || lane;
// The drawer lists a day in LANE order, as the Track does above it, so the two agree about what comes first. The design's own order, from fixtures' seasonItems(): every new draw, then every returning draw, then the calendar in its stored order — which on the live document is ascending by start date. Splitting the calendar into three lane buckets, as trackData does for the Track, reorders a day's list against the list the same data produces one click away.
const DAY_RANK = { draw: 0, returning: 1 };

function dayItems(source, day) {
    const out = [];
    for (const [lane, list] of Object.entries(source || {})) {
        for (const i of list || []) {
            const a = String(i.startDate || i.date || '').slice(0, 10);
            const b = String(i.endDate || i.startDate || i.date || '').slice(0, 10);
            if (a && a <= day && (b || a) >= day) out.push({ lane, title: i.title, a, b });
        }
    }
    // ⚠️ ONE SORT. A date-only sort was already here and ran LAST, so the lane ranking above it changed nothing at all — two orderings in one function, the second silently winning. Worth stating because the symptom was indistinguishable from the first sort not being written.
    return out.sort((x, y) => ((DAY_RANK[x.lane] ?? 2) - (DAY_RANK[y.lane] ?? 2)) || (x.a < y.a ? -1 : x.a > y.a ? 1 : 0));
}

const shiftDay = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

function DayDrawer({ day, live, draft, withDraft, onWithDraft, onClose, onDay }) {
    const rows = dayItems(live, day);
    const draftRows = withDraft && draft ? dayItems(draft, day) : [];
    const all = [...rows, ...draftRows.map((r) => ({ ...r, isDraft: true }))];
    return html`
        <${Drawer} eyebrow="A single day"
                   title=${TL.fmtLong(day)} onClose=${onClose}
                   actions=${html`
                       <!-- 🔴 THE WAY IN WAS A CLICK ON A CROSSHAIR, WHICH IS NO WAY IN AT ALL FOR A KEYBOARD.
                            The drawer lists what runs on a date and nothing else in the portal does, so reaching
                            it had to stop depending on a pointer. These step the same drawer a day at a time,
                            which is also faster than re-aiming at a 3px column for anyone using a mouse. -->
                       ${html`
                       <button class="btn" onClick=${() => onDay(shiftDay(day, -1))}
                               aria-label=${`Previous day, ${fmtDay(shiftDay(day, -1))}`}>← Previous day</button>
                       <button class="btn" onClick=${() => onDay(shiftDay(day, 1))}
                               aria-label=${`Next day, ${fmtDay(shiftDay(day, 1))}`}>Next day →</button>`}
                       <button class="btn" onClick=${onClose}>Close</button>`}>
            <!-- 🔴 A WRAPPER THE DESIGN DOES NOT HAVE, AND IT CARRIED A FONT SIZE. dwbody sets 13px inside a
                 drawer body the design leaves at the page's 15, so every row in the day list came out 21px
                 against the design's 23 — two pixels a row, ten rows, and a drawer 20px short. The design's
                 drawer body holds the list directly. -->
            <div style="display:contents">
                ${all.length ? html`
                    <ul class="daylist">
                        ${all.map((i, n) => html`
                            <!-- The row is mark · name · TYPE · dates. The lane label carried the same class as
                                 the date range, so the two read as one column of grey and the type stopped being
                                 a distinct fact; the design gives it dt and leads the row with a topic dot. -->
                            <li key=${n} style=${`--c:var(${topicVarFor(i.lane) || '--ink4'})`}>
                                <i></i>
                                <span class="dn">${i.title}${i.isDraft ? html`${' '}<span class="nextmark">NEXT SEASON</span>` : null}</span>${' '}
                                <span class="dt">${dayLaneLabel(i.lane)}</span>${' '}
                                <span class="dd">${i.b && i.b !== i.a ? `${fmtDay(i.a)} → ${fmtDay(i.b)}` : fmtDay(i.a)}</span>
                            </li>`)}
                    </ul>`
                : html`<p class="dw-p">Nothing is scheduled on this day.</p>`}
                ${draft ? html`
                    <label class="dwcheck" style="margin-top:12px">
                        <input type="checkbox" checked=${withDraft} onChange=${(e) => onWithDraft(e.target.checked)} />
                        <span>Include the staged next-season draft. Players cannot see these.</span>
                    </label>` : null}
            </div>
        <//>`;
}

// 01-season-spine.html's Staged panel -- the mockup keeps pending changes visible and actionable right beside the Track instead of buried in the flat Manifest table below. describeOp/blockedReason are board.logic.js globals (every *.logic.js file loads on every page -- see track.js's header), the same functions Board's own cards already use, so the two views can never describe a change differently. Reads changesets Season already fetches; asks for nothing new. 🔴 A STRIP, NOT A PANEL, AND IT MOVED OUT OF THE TRACK TAB. Harkirat on the panel this replaces: it "feels squeezed in" — a 438px callout inset 22px from a page that is otherwise full-bleed, listing every staged change with its own tier chip and its own discard button, directly above the instrument it was pushing down. Two problems in one shape: it repeated the Board, which is the screen whose entire job is the changeset pipeline, and it was only on the Track, so staging from the Board or Repairs left the page silent. One line under the view bar says the same four things — how many, what the first one was, the way forward, and the way out — on every view, in the height of a sentence.
//
// ⚠️ IT NAMES A BLOCKED CHANGE RATHER THAN COUNTING IT. A blocked changeset cannot commit, so a strip that folded it into "4 staged" would send somebody to Review to find out why. `blockedReason` is board.logic.js's, the same function the Board's own cards read, so the two can never describe one change differently.
function StagedPanel({ changesets, onDiscardAll, onReview }) {
    const pending = (changesets || []).filter((c) => c.state === 'staged' || c.state === 'blocked');
    if (!pending.length) return null;
    const first = describeOp((pending[0].ops || [])[0]);
    const more = pending.length - 1;
    const blocked = pending.filter((c) => blockedReason(c));
    return html`
        <div class="stg-strip" role="status">
            <span class="ss-n"><b>${pending.length}</b> staged</span>
            <span class="ss-sep" aria-hidden="true">·</span>
            <span class="ss-d">${first}${more ? ` and ${more} more` : ''}</span>
            ${blocked.length ? html`<span class="ss-sep" aria-hidden="true">·</span>
                <span class="ss-w">${blocked.length === 1 ? blockedReason(blocked[0]) : `${blocked.length} blocked`}</span>` : null}
            <span class="ss-sp"></span>
            <button class="chip" onClick=${onReview} data-tip="Nothing is live until you commit it there">Review →</button>
            <button class="chip" onClick=${onDiscardAll}
                    data-tip="Discard every staged change — nothing live is undone">Discard all</button>
        </div>
    `;
}

export async function fetchSeasonState() {
    return fetchJson('/api/season');
}

async function fetchChangesets(realm) {
    const body = await fetchJson(`/api/changeset?realm=${realm}`);
    return body.changesets || [];
}

// 🔴 THE DESIGN'S READOUT, AND THIS COMPONENT IS THE ONLY COPY OF IT. Four segments, colon-separated, the seconds quieter than the rest.
//
// 🔴 IT USED TO BE THE HERO CLOCK, AND THAT IS THE BUG THIS FIXES. Attempt 13's one-big-figure face (COMPANION §16.31a) was deleted on 2026-08-30 — but only at SeasonClock's call site below, which is where the comment recording the deletion still sits. The component survived, exported and styled, with home.js as its ONLY consumer: so Season rendered the design while Home went on rendering the scrapped version, and the decision ledger recorded the clock as "DELETED" with no qualifier. A deletion applied to the instance and written down as applied to the class. Found on Home's first ever audit, 2026-09-03 20:24 EDT.
//
// ⚠️ HOME HAD ITS OWN TRANSCRIBED COPY OF THIS MARKUP ONCE, and that is why it must not get one again: two independent emitters of .sc-u/.sc-sep meant rebuilding one face left the other rendering against rules that no longer existed — a whole component reduced to unstyled inline text, silently, with every gate green. The face is the part the two clocks genuinely share; what surrounds it is not (Season states the deadline and its chips, Home states the season title and earns two item columns beside it), so only the face lives here.
export function ClockFace({ p }) {
    const units = [];
    if (p.d > 0) units.push(['d', p.d, p.d === 1 ? 'day' : 'days']);
    if (p.d > 0 || p.h > 0) units.push(['h', p.h, 'hrs']);
    units.push(['m', p.m, 'min']);
    units.push(['s', p.s, 'sec']);

    return html`
        <div class="sc-face">
            ${units.map((u, i) => html`
                ${i ? html`<span class="sc-sep">:</span>` : null}
                <span class=${'sc-u' + (u[0] === 's' ? ' sec' : '')}>
                    <b>${u[0] === 'd' ? u[1] : String(u[1]).padStart(2, '0')}</b><i>${u[2]}</i>
                </span>`)}
        </div>`;
}

// ── THE SEASON CLOCK ──────────────────────────────────────────────────────────────────────────
//
// The subject is THE TIME AND THE SEASON TITLE. Not a to-do list, not a count of pending work — Harkirat, after thirteen rejected designs: "IM NOT THE ONE CREATING THAT CONTENT, the content already exists… the countdown is an informative insight into when the season ends, what's live in the game, what still needs to release."
//
// 🔴 ONE HERO FIGURE, and the rest subordinate to it. Four equal segments is a digital readout, and a digital readout is what a phone lock screen does — it tells you the time without telling you anything about the time. The days are the number you act on; hours/minutes/seconds are the proof it is running.
//
// 🔴 FIVE PRESSURE TIERS, each REMOVING something. `data-tier` drives it from CSS so the component states the tier and the stylesheet decides what that looks like — a single orange "hot" state means the element says exactly one thing for twenty days and then another.
//
// ⚠️ TWO WALLS, NOT THREE DEADLINES. bpEnd and rankEnd are usually the same day; seasonMoments groups by date so one moment carrying two lines reads as one wall.
function SeasonClock({ season, today }) {
    const [, setTick] = useState(0);
    const moments = seasonMoments(season, today || new Date().toISOString().slice(0, 10));
    // One interval, started only when there is something to count. A clock with no deadline should wake nothing up.
    useEffect(() => {
        if (!moments.length) return undefined;
        const id = setInterval(() => setTick((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, [moments.length]);

    if (!moments.length) {
        return html`<div class="sclock"><span class="sc-none">No deadline set for this season.</span></div>`;
    }
    const next = moments[0];
    const rest = moments.slice(1);
    // 🔴 THE INSTANT, NOT THE START OF THE DAY. The design's clock is called with its fixture's own date, so it
    //    reads 23h 59m 59s at every hour of that day — which is what made two captures seconds apart comparable,
    //    and is not a clock for a console that is running. The READOUT below is the design's; this line is not,
    //    and the two sat in one paragraph of code pointing in opposite directions.
    const p = countdownParts(next.iso, Date.now());
    if (!p || p.past) return html`<div class="sclock" data-tier="today"><span class="sc-none">This season has ended.</span></div>`;

    // 🔴 THE HERO-FIGURE CLOCK WAS DELETED HERE, DELIBERATELY, AND ITS ONLY RECORD IS A PUBLISHED ARTIFACT.
    //    Harkirat, 2026-08-30: the ahead rendering is scrapped and redesigns get rebuilt fresh on the conformed
    //    base. This readout is the design's. What stood here was attempt 13 (COMPANION §16.31a), its own critique
    //    never addressed, and it is queued for redesign in docs/db-deferred-list.md — so what comes back is not
    //    this code. Photographed before deletion:
    //    https://claude.ai/code/artifact/48baf822-3a53-46d0-9fe9-93da8e00d104
    {

        return html`
            <div class="sclock mh-stats" data-tier=${seasonTier(p.d)} aria-live="off">
                <!-- The face is ClockFace's, not a second copy of it. Season and Home render the same four
                     segments from the same code; only what surrounds them differs. -->
                <${ClockFace} p=${p} />
                <div class="sc-when">until <b>${fmtDay(next.iso)}</b>${' · '}${next.lines.map((L) => L.label.toLowerCase()).join(' & ')}</div>
                ${rest.length ? html`<div class="sc-then">then <b>${rest[0].lines.map((L) => L.label).join(' ')}</b>${' '}${fmtDay(rest[0].iso)}${' · '}${daysUntil(rest[0].iso)} ${daysUntil(rest[0].iso) === 1 ? 'day' : 'days'}</div>` : null}
            </div>`;
    }
}

// A date alone does not answer "is that soon?". The mockup's THEN line reads "DMZ NOV 11 · 79 DAYS" and the portal's read "then DMZ Nov 11" — the same fact minus the only part that needs no arithmetic from the reader. Whole days, UTC on both ends, so it never disagrees with the hero figure by an hour of local offset.
const daysUntil = (iso) => Math.max(0, Math.round(
    (new Date(String(iso).slice(0, 10) + 'T00:00:00Z') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 86400000));

// The design's Discord-card subtitle is fmtLong — "Wed, Jul 22" — where the row above it is fmt. One weekday is the whole of one of the six regions this drawer had left.
const longDay = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00Z')
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');

const fmtDay = (iso) => new Date(String(iso).slice(0, 10) + 'T00:00:00Z')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// The eyebrow: three counts above the title, each a fact the page can act on. A zero is dimmed rather than hidden -- "no flags" is information, and a row that changes length as numbers reach zero makes the reader re-find every other number.
//
// 🔴 THIS WAS DELETED EARLIER ON 2026-08-27 AND RESTORED THE SAME AFTERNOON, and the mistake is worth more than the code. The duplication was real -- `14 LIVE NOW / 4 STAGED` above the title, `DRAWS LIVE 14 / STAGED 4` in the stats row on the far side of the same masthead -- but I resolved it by deleting the EYEBROW and keeping the stats row. COMPANION 16.31 point 3 says the opposite in as many words: the clock *"replaces the masthead's stat block, which he called useless. LIVE NOW / STAGED / FLAGS demote to an eyebrow above the page title."* The stat block is the half that should not exist; the eyebrow is where those counts were sent to live. **A redundancy has two ends, and which one to cut is a design decision somebody already made** -- read it before choosing, or a correct finding produces a confident rollback of approved work.
function Eyebrow({ live, staged, flags }) {
    const cell = (n, k, cls) => html`<span><i class=${n === 0 ? 'zero' : (cls || '')}>${n}</i>${k}</span>`;
    return html`<div class="mh-eyebrow">${cell(live, 'live now')}${cell(staged, 'staged', 'stg')}${cell(flags, 'flags', 'warn')}</div>`;
}

// Season is the ONLY realm with more than one kind of thing to add, so it is the only one that reveals its kinds. The others keep a single button, because a single button has nothing to reveal. Built from the lane table, so a kind cannot go missing here while existing on the Track. The composer's own type table: the label, the accent, and — the part the old select could not express — the SHAPE of the record behind it. A draw stores one date; an event stores a window. `hex` is a token rather than a literal because these are the season's own topic accents, which the Track and the Manifest already read from the same place. 🔴 THE DESIGN NAMES THE KINDS AFTER THE LANES, NOT AFTER ONE ITEM. Its chips read "New draws · Returning · Draw windows · Events · Playlists · Patch notes" — the same six words the Track's lane headers and the Manifest's filter chips use — while this said "Draw · Returning draw · Draw window · Event". Two vocabularies for one set of things, on two controls a thumb's width apart. The stage verb is the SINGULAR of the same word ("Stage event"), which is why the design carries both forms.
const CONFORM_KIND_WORDS = {
    draw: { label: 'New draws', single: 'draw' },
    returning: { label: 'Returning', single: 'returning draw' },
    drawwindow: { label: 'Draw windows', single: 'draw window' },
    event: { label: 'Events', single: 'event' },
    playlist: { label: 'Playlists', single: 'playlist' },
    patchnote: { label: 'Patch notes', single: 'patch note' },
};
const composeTypes = () => (COMPOSE_TYPES.map((t) => ({
    ...t, ...(CONFORM_KIND_WORDS[t.key] || {}),
    // Every field is "Name" in the design — the kind is already stated by the pressed chip directly above it, so repeating it in the label is the form saying the same thing twice.
    nameLabel: t.key === 'patchnote' ? 'Patch note title' : 'Name',
})));

const COMPOSE_TYPES = [
    // `windowable` is what makes the form ask for a second, OPTIONAL date and then stage two ops. It is not `shape`: the draw's own record still stores exactly one date (models/SeasonalData.js), and a shape of 'span' would put a start date on a subdocument that has no field for one.
    { key: 'draw', label: 'Draw', hex: 'var(--draw)', shape: 'point', windowable: true, nameLabel: 'Draw name',
      opName: 'draw.add',
      placeholder: 'Crimson Moonlight', dateLabel: 'Releases',
      pointNote: 'A draw has no end date — the record stores the day it releases.' },
    { key: 'returning', label: 'Returning draw', hex: 'var(--ret)', shape: 'point', windowable: true, nameLabel: 'Draw name',
      opName: 'draw.add',
      placeholder: 'Havoc rerun', dateLabel: 'Returns',
      pointNote: 'A returning draw stores one date, the same as a new one.' },
    // 🔴 THE DRAW WINDOW WAS A SIXTH KIND HERE AND IS NOT ANY MORE — Harkirat, 2026-09-06 01:25 EDT. A window is when a draw can be BOUGHT, which is a fact about a draw you are already describing, so offering it as its own chip made you compose the same thing twice and hope the two titles matched. Nothing checked that they did; the Track's own "orphan window" repair finding exists because they often did not. The draw form takes an optional closing date instead, and buildSeasonAddOps stages the `calendar.add` behind it. ⚠️ `drawwindow` IS STILL A LANE, A FILTER CHIP AND A CALENDAR CATEGORY. Only the creation kind is gone.
    { key: 'event', label: 'Event', hex: 'var(--ev)', shape: 'span', nameLabel: 'Event name',
      opName: 'calendar.add',
      placeholder: 'Clan Wars' },
    { key: 'playlist', label: 'Playlist', hex: 'var(--play)', shape: 'span', nameLabel: 'Playlist name',
      opName: 'calendar.add',
      placeholder: 'Hardpoint 24/7' },
    // A patch note is not released, it is PUBLISHED, and the design says so — `dateLabel` was falling through to the shared 'Releases' default written for draws. The note is the design's too: it answers the question the composer actually provokes, which is why this record has no lane on the Track, and it is one line longer, which is the whole of the 19.56px that made this overlay the worst-matching of the six at 8.4%.
    //
    // ⚠️ THE SENTENCE THIS REPLACED IS NOT WORTHLESS AND IS NOT STOOD DOWN. It said the description and the images are written in /manage — operational fact the design's copy does not carry. But §0.1b's default is that the mockup wins unless a COMPANION section or a dated decision postdates it, and there is no citation for the portal's wording, so it was not a portal-ahead advance to keep. Filed in the post-conformance queue instead, where the two can be merged deliberately rather than one silently outliving the other.
    { key: 'patchnote', label: 'Patch note', hex: 'var(--pn)', shape: 'point', nameLabel: 'Season title',
      opName: 'patchnote.addSeason',
      placeholder: 'Season 8 — Codename', dateLabel: 'Published',
      pointNote: 'A patch note is published once. The record stores one date and no end — which is why it is not a lane on the Track.' },
];

// 🔴 FOUR CHIPS, AND TWO WERE REMOVED FOR DIFFERENT REASONS. `drawwindow` is no longer a kind at all (see COMPOSE_TYPES above). `patchnote` still is — but it had TWO entry points, this one and the Season Record panel's own CTA, and the record panel's is the one that sits beside the list it adds to. A control that creates a publication belongs next to the publications, not in a row of season-schedule chips it shares nothing with. The masthead keeps the four kinds that land on the Track.
const ADD_CHIPS = [
    { key: 'draw', label: 'Draw', accent: 'var(--draw)' },
    { key: 'returning', label: 'Returning draw', accent: 'var(--ret)' },
    { key: 'event', label: 'Event', accent: 'var(--ev)' },
    { key: 'playlist', label: 'Playlist', accent: 'var(--play)' },
];

// ⚠️ THE ACCESS KEY IS ANNOUNCED, NOT MERELY BOUND -- the same rule MastheadNew follows, and the mockup draws the `N` badge for exactly this reason. `n` opens the composer with no type chosen, which is the right default for a group of six: picking the type is the composer's first field, so a shortcut per chip would be six shortcuts for one act. useCreateKey already refuses to fire while somebody is typing, so the letter cannot be swallowed mid-title.
function AddChips({ onAdd }) {
    useCreateKey('n', () => onAdd(true));
    return html`
        <div class="mh-add" role="group" aria-label="Add to this season">
            <span class="mh-add-k">Add</span>
            ${ADD_CHIPS.map((c) => html`
                <button class="pill mh-t" style=${`--c:${c.accent}`} onClick=${() => onAdd(c.key)}>
                    <span class="dot"></span>${c.label}
                </button>`)}
            <kbd class="mh-k" aria-label="Keyboard shortcut: N">N</kbd>
        </div>`;
}


// ── THE SEASON RECORD / IDENTITY STRIP ────────────────────────────────────────────────────────
//
// Harkirat on what the collapsed strip used to be: "Nothing about it suggests that it also encompasses the calendar page banner urls. The dates and titles inside of collapsed strip are not informative or sized correctly considering the level of information they hold. they feel like 3rd tier support information."
//
// Three complaints, one defect: it was written as a CAPTION for a thing that is a RECORD. So it names every kind of thing it holds — including the banners, which it never admitted to — sets the titles and dates at the scale of their content rather than as 10px chips, and says what opening it does instead of a bare "Live season" label.
//
// 🔴 IT DOES NOT SAY "17 DAYS LEFT". That belongs to the clock in the masthead. This shows the dates AS STORED, because this is the record you EDIT — and that split is what stops the two elements repeating each other, which is what made both feel redundant. 🔴 TWO VOCABULARIES FOR ONE THING, AND THE SAVE HAD NEVER ONCE WORKED. `k` is the STORAGE field on the season document, which is what the form reads its value from — but `calendar.setBanners` validates its payload against `core/ops/calendar.js`'s `BANNER_FIELDS`, whose keys are the SHORT names (`draws`, `events`, `playlists`). The editor sent `drawsBannerUrl`, the op answered `Unknown banner page: drawsBannerUrl`, and the changeset was born BLOCKED — so every banner edit ever made through this panel staged something that could never commit. Measured live against the real server 2026-08-28 10:5x EDT, on the first sign-in the portal has ever had; nothing could have caught it earlier, because staging succeeds and only the re-validation on the Review screen reports the block. ⚠️ `op` is carried in this table rather than derived by stripping "BannerUrl" — a derivation is a second implementation of the mapping, and it would keep agreeing with itself while disagreeing with `core`. The test in scripts/portalRealms.test.js compares this list against the op's own accepted keys.
const BANNERS = [
    { k: 'drawsBannerUrl', op: 'draws', label: 'Draws', hex: 'var(--draw)' },
    { k: 'eventsBannerUrl', op: 'events', label: 'Events', hex: 'var(--ev)' },
    { k: 'playlistsBannerUrl', op: 'playlists', label: 'Playlists', hex: 'var(--play)' },
];

const IDENTITY_KEY = 'dioreo-identity-open';

function SeasonRecord({ season, editingDraft, draftStaged, today }) {
    // A banner URL that is STORED but will not load is its own state, and the record could not say so — every set banner read the same regardless. It matters here specifically: two of the three fixture banners are media.discordapp.net links carrying an `ex=` expiry, and an expired Discord CDN link is a real, known failure mode in this project. Tracked per key rather than as one flag so one dead banner does not describe the other two.
    const [brokenBanner, setBrokenBanner] = useState({});
    const titled = (season?.currentSeasonTitle || '').trim();
    // Silent unless it is genuinely late AND nothing is staged. One line, never repeated, gone the moment a draft exists — "make it smart and suggest things to prep/stage for the next season. but dont make it naggy."
    const near = seasonMoments(season, today)[0];
    const daysOut = near ? Math.ceil((new Date(near.iso + 'T23:59:59Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000) : null;

    // 🔴 ONE GRID, NOT SIX. Every cell used to arrange itself from its own content, so six titles began at six different x positions and the dates were not even right-aligned to each other. `.srec-c` is display:contents, which dissolves each cell so all eighteen parts land in ONE grid whose label column is sized by the widest label ACROSS ALL SIX.
    return html`
        <div class="srec">
            <div class="srec-top">
                <span class="srec-kind">Titles, dates and calendar banners</span>
                <span class=${'srec-state' + (editingDraft ? ' staged' : '')}>${editingDraft ? 'staged draft' : 'live'}</span>
            </div>
            <p class=${'srec-title' + (titled ? '' : ' untitled')}>${titled || 'No season title set'}</p>
            <div class="srec-grid">
                ${SEASON_LINES.map((L) => {
                    const t = (season?.[L.titleKey] || '').trim();
                    const tbd = season?.[L.tbdKey], iso = season?.[L.endKey];
                    return html`
                        <div class="srec-c" key=${L.key} style=${`--c:${L.hex}`}>
                            <span class="k">${L.label}</span>
                            <span class=${'t' + (t ? '' : ' unset')}>${t || 'no title set'}</span>
                            <span class=${'d' + (tbd || !iso ? ' tbd' : '')}>${tbd ? 'TBD' : (iso ? fmtDay(iso) : 'no date')}</span>
                        </div>`;
                })}
                <!-- 🔴 A DOT, NOT THE WORD "set". A short word at the end of a row reads as a BUTTON —
                     "set", "open", "edit" and "clear" are all things you do. This column holds a DATE
                     in the rows above, so a verb here also broke the peerage the shared treatment
                     establishes. The ABSENT state is the one that matters, so it is the one marked. -->
                <!-- 🔴 THE BANNER ROWS SAID "image cached and serving" AND SHOWED THE IMAGE TO NOBODY.
                     Three of the six cells in this record are pictures, and they were rendering as a
                     sentence about a picture — which makes them read as three more deadlines with
                     unusually wordy values. The thumbnail is what distinguishes a banner from a
                     deadline BY KIND rather than by reading the label, and it answers the question the
                     status sentence only asserted: this is the image the bot is serving, look at it.
                     ⚠️ The picture replaces the SENTENCE, not the row — same grid, same three parts,
                     same column widths, so the six cells stay peers rather than splitting into two
                     designs. -->
                ${BANNERS.map((b) => {
                    const on = (season?.[b.k] || '').trim();
                    const shows = on && !brokenBanner[b.k];
                    return html`
                        <div class=${'srec-c' + (on ? '' : ' off') + (on && !shows ? ' dead' : '') + (shows ? ' has-img' : '')} key=${b.k} style=${`--c:${b.hex}`}>
                            <span class="k">${b.label}</span>
                            <span class=${'t' + (on ? '' : ' unset')}>
                                <!-- 🔴 THE WHOLE MECHANISM IS KEPT, AND THE CLASSIFICATION THAT SPLIT IT WAS WRONG. The design
                                     draws no thumbnail and states "image cached and serving" for any banner that is set.
                                     But THIS IMG IS THE DETECTOR: brokenBanner is written by its onError, and the dead
                                     class, the status words and the d aria-label all read that state. Adopt the design's
                                     no-image version and nothing ever fires the error, so a broken banner asserts its own
                                     health — a falsehood about live data. The three sites are ONE decision and it is (b). -->
                                ${shows
                                    ? html`<img class="srec-thumb" src=${on} alt="" loading="lazy" decoding="async"
                                                onError=${() => setBrokenBanner((m) => ({ ...m, [b.k]: true }))} />`
                                    : (on ? 'set, but the image will not load' : 'no image set')}
                            </span>
                            <span class="d" role="img" aria-label=${on ? (shows ? 'set' : 'set but not loading') : 'not set'}><em></em></span>
                        </div>`;
                })}
            </div>
            <!-- 🔴 THE LATENESS NUDGE MOVED ONTO THE LINE THAT CARRIES THE CONTROL, and the first attempt at
                 this got it wrong in a way worth recording: it deleted the nudge as a duplicate of the
                 nodraft line 60px below. They were NOT the same fact. That line says a draft does not exist; the nudge
                 said it does not exist AND the season ends within seven days — an urgency the other line
                 never carried. Deleting it would have removed the only late warning on the page while
                 looking like tidying. What was actually wrong is that ONE absence was drawn as TWO objects
                 in one fold, only one of which could be acted on. So the urgency now rides on the nodraft
                 line, which is where the title field and the Start a draft button already are. -->
        </div>`;
}

// `editingDraft` is WHICH season you are editing; `draftStaged` is whether one exists at all. They were one flag, and the record read "staged draft" on the live season purely because a draft existed — the chip states the thing you are looking at, not the thing that exists elsewhere. 🔴 `editingDraft` WAS A PROP THE CALLER HARDCODED TO FALSE. It reached SeasonRecord, which styles the summary strip for it, and nothing could ever set it — so the whole draft half of this component was built, styled and unreachable. The switch is what the mockup specifies: one editor, two seasons, and which one you are editing said out loud rather than inferred from what the fields happen to contain.
export function SeasonIdentity({ season, editingDraft, draftStaged, today, onSave, onScope, draftSlot }) {
    const [open, setOpen] = useState(() => { try { return sessionStorage.getItem(IDENTITY_KEY) === '1'; } catch { return false; } });
    const [edits, setEdits] = useState({});
    const value = (k) => (k in edits ? edits[k] : (season?.[k] ?? ''));
    const dirty = Object.keys(edits).length;

    function toggle() {
        setOpen((o) => { try { sessionStorage.setItem(IDENTITY_KEY, o ? '0' : '1'); } catch (e) {} return !o; });
    }
    function set(k, v) { setEdits((e) => ({ ...e, [k]: v })); }

    const titled = (season?.currentSeasonTitle || '').trim();
    return html`
        <section class=${'identity' + (open ? '' : ' collapsed') + (editingDraft ? ' editing-draft' : '')} aria-label="Season identity">
            <!-- The strip IS the button — role, tabindex, cursor, hover and aria-expanded all live on
                 it. A floating "Open to edit" label was an apology for an affordance that already
                 existed, and it sat wherever margin-left:auto dropped it. The words move into the
                 accessible name, where a keyboard user actually needs them. -->
            <div class="idsum" role="button" tabindex="0" aria-expanded=${open}
                 aria-label=${`Season record: ${titled || 'no title set'}. Open to edit titles, dates and calendar banners.`}
                 onClick=${toggle}
                 onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}>
                <${SeasonRecord} season=${season} editingDraft=${editingDraft} draftStaged=${draftStaged} today=${today} />
            </div>
            <div class="idbody">
                <!-- 🔴 THE TARGET COLLAPSED FROM 147px TO 52px THE MOMENT IT OPENED. Measured 2026-08-27:
                     the collapsed record is click-anywhere across the whole strip, and the open panel's
                     only way back was the Done button — same y-position, a fraction of the area. Harkirat
                     chose the header's empty space as the close affordance: the row keeps its own controls
                     and everything between them closes the panel.
                     ⚠️ NOT role="button" ON THE HEADER. It contains the Live/Next switch and Done, and an
                     interactive element wrapping other interactive elements is invalid ARIA and unusable
                     from a keyboard. The keyboard path is the Done button, which was always focusable and
                     still is; this adds a pointer target for the mouse, which is what was missing.
                     ⚠️ THE HANDLER CHECKS ITS TARGET rather than relying on stopPropagation at each child:
                     a new control added to this row later would otherwise silently start closing the panel,
                     and nothing would say so. -->
                <div class="ph idhead"
                     onClick=${(e) => { if (!e.target.closest('button, input, select, a, [role="group"]')) toggle(); }}>
                    <span class="t">Season identity</span>
                    ${onScope ? html`
                        <!-- ⚠️ SWITCHING SCOPE DROPS THE UNSAVED EDITS, and that is the honest behaviour rather than a shortcut. The edits are keyed by field name and both seasons carry the same field names, so carrying them across would apply the live season's half-typed title to the draft with nothing on screen saying it had moved. -->
                        <div class="lnsw" role="group" aria-label="Which season">
                            <button aria-pressed=${!editingDraft} onClick=${() => { setEdits({}); onScope('live'); }}>
                                <span class="pip"></span>Live</button>
                            <button aria-pressed=${editingDraft} onClick=${() => { setEdits({}); onScope('draft'); }}>
                                <span class=${'pip ' + (draftStaged ? 'draft' : 'none')}></span>Next</button>
                        </div>` : null}
                    <span class="sp">${dirty ? `${dirty} unsaved edit${dirty > 1 ? 's' : ''}` : 'no unsaved edits'}</span>
                    <button class="idclose" onClick=${() => { if (dirty) onSave(edits); setEdits({}); toggle(); }}>Done</button>
                </div>
                ${editingDraft ? html`
                    <div class="draftnote">
                        <b>Editing the next season.</b> Nothing here is visible to players. Promoting it is in the
                        one-way strip at the foot of this page.
                    </div>` : null}
                <div class="f-main">
                    <label for="f-title">Season title</label>
                    <input id="f-title" autocomplete="off" spellcheck="false" placeholder="Season title"
                           value=${value('currentSeasonTitle')} onInput=${(e) => set('currentSeasonTitle', e.target.value)} />
                </div>
                <div class="dlines">
                    ${SEASON_LINES.map((L) => {
                        const tbd = Boolean(value(L.tbdKey));
                        return html`
                            <div class=${'dline' + ((L.titleKey in edits || L.endKey in edits || L.tbdKey in edits) ? ' dirty' : '')}
                                 key=${L.key} style=${`--c:${L.hex}`}>
                                <span class="trk">${L.label}</span>
                                <input type="text" aria-label=${`${L.label} title`} spellcheck="false"
                                       value=${value(L.titleKey)} onInput=${(e) => set(L.titleKey, e.target.value)} />
                                <input type="date" aria-label=${`${L.label} end date`} disabled=${tbd}
                                       value=${String(value(L.endKey) || '').slice(0, 10)} onInput=${(e) => set(L.endKey, e.target.value)} />
                                <!-- A date and "TBD" are two different ANSWERS to one question, not a
                                     field and a checkbox — so they are one control with two states. -->
                                <!-- 🔴 A DATE FIELD ANSWERS "WHEN", AND NOBODY OPENS THIS PANEL TO ASK "WHEN". They open it to find out whether there is time — and every reader was subtracting today's date from an ISO string in their head, three times, once per line. TBD says so rather than showing a number it does not have; a date already past says so rather than counting up. -->
                                <!-- 🔴 TBD SWITCH FIRST, DAYS-LEFT LAST — the grid was always written that way and
                                     the markup was not. the dline rule is a five-column grid ending 84px 104px, with
                                     justify-self:start on .tbdsw for the 84px slot and text-align:right on .dl-left
                                     for the 104px one; both stylesheets agree, byte for byte. Emitting them in the
                                     other order squeezed the days-left text into 84px and left the 72px switch
                                     start-aligned in a 104px column, so every row stopped 45px short of its own right
                                     edge against the mockup's 13px. Nothing was wrong with the CSS. -->
                                <span class="tbdsw" role="group" aria-label=${`${L.label} end is`}>
                                    <button aria-pressed=${!tbd} onClick=${() => set(L.tbdKey, false)}>DATE</button>
                                    <button aria-pressed=${tbd} onClick=${() => set(L.tbdKey, true)}>TBD</button>
                                </span>
                                ${(() => {
                                    const raw = String(value(L.endKey) || '').slice(0, 10);
                                    // ⚠️ `d` IS COMPUTED BEFORE EITHER BRANCH READS IT. The conform branch was first written above the `const d`, which is a temporal-dead-zone ReferenceError that does not fail the build, does not fail `node --check`, and blanks the whole identity section at runtime — the third TDZ of this shape on this branch.
                                    const d = raw
                                        ? Math.round((Date.parse(raw + 'T00:00:00Z') - Date.parse(todayIso() + 'T00:00:00Z')) / 86400000)
                                        : NaN;
                                    // The design puts the NUMBER in its own bold element and spells the unit out — "17 days left", not "17d left" — and pluralises it, having been caught rendering "1 days left" live. Its shapes are reproduced exactly under the flag; the portal's terser line is what a dense grid wants, and it comes back with the rest of the re-apply queue.
                                    {
                                        if (tbd) return html`<span class="dl-left is-tbd">TBD</span>`;
                                        if (!raw) return html`<span class="dl-left"><span style="color:var(--ink3)">not set</span></span>`;
                                        if (!Number.isFinite(d)) return html`<span class="dl-left is-tbd">unreadable</span>`;
                                        if (d < 0) return html`<span class="dl-left is-over">ended <b>${-d}d</b> ago</span>`;
                                        if (d === 0) return html`<span class="dl-left">ends <b>today</b></span>`;
                                        return html`<span class="dl-left"><b>${d}</b> ${d === 1 ? 'day' : 'days'} left</span>`;
                                    }
                                    if (tbd) return html`<span class="dl-left is-tbd">no date yet</span>`;
                                    if (!raw) return html`<span class="dl-left is-tbd">not set</span>`;
                                    if (!Number.isFinite(d)) return html`<span class="dl-left is-tbd">unreadable</span>`;
                                    if (d < 0) return html`<span class="dl-left is-over">${-d}d ago</span>`;
                                    return html`<span class="dl-left">${d === 0 ? 'today' : `${d}d left`}</span>`;
                                })()}
                            </div>`;
                    })}
                </div>
                <!-- Three independent banners, one per /calendar page. Blank means "show nothing" —
                     NOT a placeholder — so an empty field is a real, meaningful value and says so.
                     🔴 ABSENT ON THE DRAFT, AND THE SAVE GUARD WAS NOT ENOUGH. calendar.setBanners writes the LIVE
                     document; there is no draft equivalent. Guarding only the save left three inputs on screen that
                     accepted a URL and dropped it — the same class of silent no-op this editor was just fixed for,
                     re-introduced two lines away from the fix. A field that cannot be saved must not be offered. -->
                ${editingDraft ? null : html`
                <div class="bansec">
                    <div class="bansec-h"><span>Calendar banners</span><span class="bansec-n">one per /calendar page · re-hosted through Cloudinary</span></div>
                    <div class="bans">
                        ${BANNERS.map((b) => {
                            const v = String(value(b.k) || '');
                            return html`
                                <div class="ban" key=${b.k} style=${`--c:${b.hex}`}>
                                    <span class="bl">${b.label}</span>
                                    <span class=${'bthumb' + (v ? ' has' : '')}
                                          style=${v ? `background-image:url("${v}")` : null}>${v ? '' : 'none'}</span>
                                    <input type="url" spellcheck="false" aria-label=${`${b.label} page banner URL`}
                                           placeholder="Paste an image URL — blank shows no banner"
                                           value=${v} onInput=${(e) => set(b.k, e.target.value.trim())} />
                                    <span class="bst">${b.k in edits ? 'will re-host on save' : (v ? 'cached' : 'no banner')}</span>
                                </div>`;
                        })}
                    </div>
                </div>`}
                <!-- 🔴 THE DESIGN PUTS THE DRAFT ZONE INSIDE THE EDITOR, AND THAT PLACEMENT IS THE WHOLE
                     FINDING. season.html mounts #draftZone as the last child of .idbody, so it is on
                     screen only while the editor is expanded. The portal mounts its own DraftZone in the
                     context strip above the view layer — a deliberate advance, because a staged draft is
                     context the Track is read against — and stood the whole component down under the flag.
                     Standing it down was right for the RESTING page and wrong for the OPENED one: the
                     expanded editor then had a 111px hole where the design has a paragraph and a button,
                     and no amount of styling could close it. Measured both ways: mounting it unconditionally
                     took the three resting views from 0.2/0.1/0.1% to 13.1/10.2/9.8%, because at rest the
                     design shows nothing here at all. -->
                ${draftSlot}
            </div>
        </section>`;
}


// `?today=` travels the clock in the harness; in production this is simply today.
const todayIso = () => (typeof document !== 'undefined' && document.documentElement.dataset.today)
    || new Date().toISOString().slice(0, 10);

// ── THE NEXT SEASON, STAGED AND INVISIBLE ─────────────────────────────────────────────────────
//
// A draft is the whole next season — titles, deadlines, draws, calendar — built where players cannot see it. It sits directly under the identity editor because that is what a draft IS: a second copy of those same fields, and putting it anywhere else would make the relationship a thing you have to be told rather than a thing you can see.
//
// ⚠️ PROMOTE IS NOT HERE. It is the one draft operation that cannot be taken back, so it lives in the one-way strip at the foot of the realm with the other six — and this bar says so, because a reader who has staged a draft and cannot find the button will conclude the feature is unfinished rather than that it is somewhere safer. 🔴 PROMOTE IS THE ONE IRREVERSIBLE OPERATION IN THIS REALM AND ITS EFFECT COULD NOT BE INSPECTED. The scope switch let you EDIT the draft; nothing showed the difference between it and what is live. Compare answers the only question worth asking before a one-way replace: what actually changes. It sits in the draft bar rather than in the strip below, because you read it while deciding, not while confirming.
function DraftCompare({ live, draft }) {
    const { rows, identical } = draftDiff(live, draft, (iso) => fmtDay(iso));
    if (identical) return html`<div class="diff"><div class="diff-none">The draft is identical to what is live.</div></div>`;
    return html`
        <div class="diff">
            <div class="diff-h"><span>FIELD</span><span>LIVE NOW</span><span>AFTER PROMOTE</span></div>
            ${rows.map((r) => html`
                <div class="diff-r" key=${r.key}>
                    <span class="dk">${r.key}</span>
                    <span class="dwas">${r.was || '—'}</span>
                    <span class=${'dnow' + (r.add ? ' add' : '')}>${r.now || '—'}</span>
                </div>`)}
        </div>`;
}

function DraftZone({ draft, live, onStart, onDiscard }) {
    const [title, setTitle] = useState('');
    // Silent unless it is genuinely late: seven days or fewer, and nothing staged. Same threshold the record's own nudge used before it moved here, so the warning did not change — only where it lives.
    const endsIn = live?.bpEnd ? daysUntil(live.bpEnd) : null;
    const late = endsIn !== null && endsIn <= 7;
    const [comparing, setComparing] = useState(false);
    if (!draft || !draft.active) {
        // 🔴 THE STAND-DOWN RENDERS THE DESIGN'S VERSION — IT DOES NOT DELETE THE SURFACE. This component was once switched off wholesale by a null at its mount site, so the portal rendered NOTHING where the design renders a paragraph and a button. §0.6a's rule is that a portal-ahead surface renders the MOCKUP'S version for the duration of the comparison; a stand-down that renders nothing removes the surface from the comparison instead, which is a different thing and it cannot be closed. It cost 111px of page height and left the expanded identity editor at 12.6% with no reachable fix.
        return html`
            <div class="nodraft">
                <p>No next season staged. A draft lets you build the whole next season — titles, deadlines,
                   draws and calendar — without any of it going live.</p>
                <button class="chip" onClick=${() => onStart('')}>Start a draft</button>
            </div>`;
    }
    const n = (draft.newDraws || []).length + (draft.returningDraws || []).length + (draft.calendar || []).length;
    return html`
        <div class="draftbar">
            <span class="dt">Next season staged</span>
            <span class="dsub">${draft.currentSeasonTitle || 'untitled'} · ${n} item${n === 1 ? '' : 's'} ·
                not visible to players</span>
            <span class="sp"></span>
            <span class="dsub">Promote is in the one-way strip below.</span>
            <button class="chip" aria-pressed=${comparing ? 'true' : 'false'} onClick=${() => setComparing(!comparing)}>Compare</button>
            <button class="chip danger" onClick=${onDiscard}>Discard draft</button>
        </div>
        ${comparing ? html`<${DraftCompare} live=${live} draft=${draft} />` : null}`;
}

// ── THE PATCH-NOTE RECORD ─────────────────────────────────────────────────────────────────────
//
// ⚠️ NOT `SeasonRecord` — that name is already taken, by the identity strip's own summary line, and the collision was caught by the build's ES-module parse rather than by `node --check`, which accepts a duplicate top-level declaration in CommonJS. This one lists what has been PUBLISHED; that one summarises what the season IS.
//
// 🔴 THE PORTAL COULD PUBLISH A PATCH NOTE AND PURGE EVERY ONE, AND NOTHING IN BETWEEN. patchnote.setDateInfo, setUrls1, setUrls2 and editSeason are all declared, tiered and permissioned in core/ops, and none of them had an affordance — so a typo in a published season title was fixable only from Discord. Found by counting what the registry declares against what the surface offers, which is the one check shape that can see a thing that is not there.
//
// 🔴 THE PANEL IS A SPINE, NOT A TABLE, and the mockup's own note says why: the record is a sequence, the newest entry is the one Discord is currently serving, and a list that renders them all alike hides which one that is. The marker on the current row is filled; the others are outlines on the same thread.
//
// ⚠️ IT SITS ABOVE THE ONE-WAY STRIP, which is deliberate: the strip's patch-notes purge destroys exactly what this panel lists, so the count you are about to lose is on screen directly above the control that loses it. 🔴 THE DESIGN OPENS A DRAWER WHERE THE PORTAL EXPANDS AN EDITOR IN PLACE, and that is an interaction difference rather than a style one — 18.8% on this overlay, the largest number left on Season. Measured on both pages rather than inferred: clicking the same li.rec-row.cur adds a `drawer open` element reading "PATCH NOTES · SAVED · LIVE NOW" on the design and adds nothing but inline text on the portal.
//
// Harkirat chose to build it, 2026-08-30 21:1x EDT, over citing the divergence: §0.6a's rule is that the portal always moves and closure stays mechanical. The inline editor is untouched and returns the moment the flag comes off — this is a stand-down that RENDERS THE DESIGN'S VERSION, which is the distinction the DraftZone hole was about.
function RecordPreview({ note, onClose }) {
    const day = note.releaseDate ? fmtDay(note.releaseDate) : (note.releaseDateText || '—');
    return html`
        <${Drawer} eyebrow=${`Patch notes · saved · ${note.current ? 'live now' : 'ended'}`}
                   title=${note.title} onClose=${onClose}
                   actions=${html`<button class="btn" onClick=${onClose}>Cancel</button>
                                  <button class="btn go" onClick=${onClose}>Stage these dates</button>`}>
            <p class="dw-p">This is the card <b>as Discord renders it</b> — the same builder the
               bot calls, so the preview cannot drift from what ships.</p>
            <${DiscordCard} accent="var(--patch)" title=${note.title}
                            sub=${`Patch notes · ${longDay(note.releaseDate) || day}`}
                            rows=${[['Window', `${day} → ${day}`], ['Duration', '1 day'],
                                    ['Detail', note.images.length ? `${note.images.length} image${note.images.length === 1 ? '' : 's'}` : '—'],
                                    ['Thumbnail', note.thumb || '—']]} />
            <div class="dwfield" style="margin-top:16px"><label for="p-start">Starts</label>
                <input id="p-start" type="date" value=${String(note.releaseDate || '').slice(0, 10)} /></div>
            <div class="dwfield"><label for="p-end">Ends</label>
                <input id="p-end" type="date" value=${String(note.releaseDate || '').slice(0, 10)} /></div>
        <//>`;
}

function PatchEditor({ entry, onStage, onClose }) {
    const [draft, setDraft] = useState({
        titleOverride: entry.titleOverride, description: entry.description,
        releaseDateText: entry.releaseDateText, urls: entry.images.join('\n'),
    });
    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
    const urlList = draft.urls.split('\n').map((u) => u.trim()).filter(Boolean);
    const { ops, blocked } = patchEditOps(entry, { ...draft, urls: urlList });
    const over = urlList.length > MAX_PATCH_IMAGES;

    return html`
        <div class="bed-sec" style="margin:12px 4px 0">
            <h5>${entry.current ? 'Editing the current entry' : 'Editing a past season'}${' '}
                <em>${entry.current ? 'date/info and each image slot stage separately, as they do in Discord' : 'one edit, carrying every field'}</em></h5>
            <div class="bed-g2">
                <label class="dwfield"><span>Title override <i>blank keeps the season title it was published under</i></span>
                    <input value=${draft.titleOverride} placeholder=${entry.title}
                           onInput=${(e) => set({ titleOverride: e.target.value })} /></label>
                <label class="dwfield"><span>Release date <i>read by the same parser the bot uses</i></span>
                    <input value=${draft.releaseDateText} spellcheck="false" placeholder="July 22, 2026 7:20 AM"
                           onInput=${(e) => set({ releaseDateText: e.target.value })} /></label>
            </div>
            <label class="dwfield"><span>Additional info <i>rendered under the images; b:, n: and f: become the buff, nerf and fix marks</i></span>
                <textarea rows="4" value=${draft.description} onInput=${(e) => set({ description: e.target.value })}></textarea></label>
            <label class="dwfield">
                <span>Images <i>one URL per line — the first five are slot 1, the next five slot 2</i></span>
                <textarea rows="5" spellcheck="false" value=${draft.urls} onInput=${(e) => set({ urls: e.target.value })}></textarea></label>
            <!-- Each URL is re-hosted through Cloudinary on commit, keyed by this entry's own id, which is
                 why an untouched slot is never restaged: resubmitting five unchanged URLs re-uploads five
                 images to say nothing at all. -->
            <p class="attnote">${urlList.length} of ${MAX_PATCH_IMAGES} used.${' '}
                ${over ? html`<b>Only the first ${MAX_PATCH_IMAGES} would be kept.</b>` : ''}${' '}
                Every URL is re-hosted on Cloudinary when this commits, so a link that dies later does not take the patch note with it.</p>
            <div class="attfoot">
                <!-- ⚠️ A DISABLED BUTTON HAS TO SAY WHICH KIND OF NOTHING IT MEANS. Blanking the release date
                     read as "Nothing changed yet" — the same words as an untouched form — while the real
                     reason was a refusal, and the refusal itself sat in a paragraph below. Measured on the
                     page, not reasoned about: the two states were indistinguishable at the control. -->
                <button class="pill lead" disabled=${!ops.length} onClick=${() => onStage(ops)}>
                    ${ops.length ? `Stage ${ops.length} change${ops.length === 1 ? '' : 's'}`
                        : (blocked ? 'Fix the release date first' : 'Nothing changed yet')}</button>
                <button class="pill" onClick=${onClose}>Close</button>
                ${blocked ? html`<span class="attnote" style="color:var(--warn)">${blocked}</span>` : null}
            </div>
        </div>
    `;
}

function PatchRecord({ live, openId, onOpen, onPublish, onStage, onPreview }) {
    const rows = patchRecordRows(live);
    const open = rows.find((r) => r.id === openId) || null;
    return html`
        <section class="rec rec-b" aria-label="Season record">
            <header class="rec-h">
                <span class="rec-t">Season record</span>
                <span class="rec-n">${rows.length} published · newest first</span>
                <!-- "+ Publish" named the verb and not the thing, on the one control that creates a patch
                     note — and it is now the ONLY way in, since the masthead's chip was dropped. -->
                <button type="button" class="rec-cta" onClick=${onPublish}>+ New patch note</button>
            </header>
            <ol class="rec-list">
                ${rows.length ? rows.map((n) => html`
                    <li key=${n.id} class=${'rec-row' + (n.current ? ' cur' : '')} tabindex="0" role="button"
                        aria-expanded=${openId === n.id ? 'true' : 'false'}
                        onClick=${() => (onPreview ? onPreview(n) : onOpen(openId === n.id ? null : n.id))}
                        onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (onPreview) onPreview(n); else onOpen(openId === n.id ? null : n.id); } }}>
                        <span class="rec-mk"></span>
                        <!-- htm collapses the whitespace between adjacent inline spans, which ran the
                             accessible name together as "Season 7 — TerminatedJul 226 imgcurrent" — the
                             same class of bug the lane header (lnh-n) was already fixed for. -->
                        <span class="rec-ttl">${n.title}</span>${' '}
                        <span class="rec-d">${n.releaseDate ? fmtDay(n.releaseDate) : (n.releaseDateText || '—')}</span>${' '}
                        <span class="rec-meta">${n.images.length} img</span>${' '}
                        <span class="rec-tag">${n.current ? 'current' : 'history'}</span>
                    </li>`)
                : html`<li class="rec-empty">Nothing published this season yet.${' '}
                    <button type="button" class="chip" onClick=${onPublish}>+ New patch note</button></li>`}
            </ol>
            ${open ? html`<${PatchEditor} entry=${open} onStage=${(ops) => onStage(open, ops)} onClose=${() => onOpen(null)} />` : null}
        </section>
    `;
}

// 🔴 THE DESIGN HAS A QUICK-ADD ROW AT THE FOOT OF THE TABLE AND THE PORTAL HAD ONLY THE COMPOSER. They are not the same affordance: the composer above the Track is for a considered addition with the kind's own fields; this is one line under the list you are already reading, for the case where you know the name and the dates and want the row to exist. The design's own hint says the third way — clicking an empty lane on the Track — which this repeats rather than replaces.
//
// ⚠️ IT STAGES, like everything else here. Nothing in this portal writes without passing Review.
function AddRow({ onStage }) {
    const [name, setName] = useState('');
    const [kind, setKind] = useState('draw');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const ready = name.trim() && start;
    function stage() {
        if (!ready) return;
        onStage(buildSeasonAddOp(kind, { title: name.trim(), date: start, startDate: start, endDate: end || start }));
        setName(''); setStart(''); setEnd('');
    }
    return html`
        <div class="addrow">
            <label class="sr" for="a-name">New item name</label>
            <input id="a-name" type="text" placeholder="New item name…" style="flex:1 1 200px"
                   value=${name} onInput=${(e) => setName(e.target.value)} />
            <label class="sr" for="a-type">Type</label>
            <select id="a-type" value=${kind} onChange=${(e) => setKind(e.target.value)}>
                <option value="draw">Draw</option>
                <option value="returning">Returning</option>
                <option value="event">Event</option>
                <option value="playlist">Playlist</option>
                <option value="patchnote">Patch note</option>
            </select>
            <label class="sr" for="a-start">Start</label>
            <input id="a-start" type="date" value=${start} onInput=${(e) => setStart(e.target.value)} />
            <label class="sr" for="a-end">End</label>
            <input id="a-end" type="date" value=${end} onInput=${(e) => setEnd(e.target.value)} />
            <button class="go" disabled=${!ready} onClick=${stage}>Stage item</button>
            <span style="font-size:11.5px;color:var(--ink3)">or click any empty lane on the Track</span>
        </div>`;
}

export function SeasonRealm({ session }) {
    const [view, setView] = useState('Track');
    // useAsync replaces the useState/useEffect pair AND the two lines that used to stand in for six states. Its `reload` is what a refresh calls, which is also what makes the is-refreshing hairline work without any realm knowing the class exists.
    const load = useAsync(() => fetchSeasonState(), []);
    const state = load.data;
    const [changesets, setChangesets] = useState([]);
    const overlay = useOverlay();
    // 🔴 THE FIVE ADD CHIPS ALL DID THE SAME THING. Each passed its own key to `onAdd` and every call site threw it away with `() => setShowAdd(true)`, so clicking Playlist and clicking Draw opened an identical form defaulted to Draw — five controls, one behaviour, and the only way to notice was to click two of them. The state IS the type now, so the chip you press is the type the composer opens on.
    const [showAdd, setShowAdd] = useState(null);   // the chip's own key, or null
    const [stagedOnly, setStagedOnly] = useState(false);
    const [pageError, setPageError] = useState('');
    // 🔴 THE TRACK ANSWERED "WHAT IS IN THIS SEASON" AND NEVER "WHAT IS ON THIS DAY". Reading a single date off it meant sighting down a vertical from the ruler across five lanes and hoping nothing was clipped — the one question a calendar is for. The crosshair already knows the date under the pointer; this is what clicking it is worth.
    const [dayOpen, setDayOpen] = useState(null);
    const [recPreview, setRecPreview] = useState(null);
    const [dayWithDraft, setDayWithDraft] = useState(false);
    const [zoomedWindow, setZoomedWindow] = useState(null);   // null = fitted to the whole season
    const [idScope, setIdScope] = useState('live');
    const [openPatchId, setOpenPatchId] = useState(null);
    const [composeGhost, setComposeGhost] = useState(null);           // which season the identity editor is editing

    // Board has nothing to show without this — a review pass found the list endpoint and this fetch were both missing entirely, so the Board column stayed permanently empty regardless of what was actually staged.
    useEffect(() => { fetchChangesets('season').then(setChangesets); }, [view]);

    if (!state) return html`<${RealmShell} realm="season" session=${session} error=${load.error} slow=${load.slow}
                                           onRetry=${load.reload} skeleton=${{ rows: 9, lines: [26, 34, 16, 12] }} />`;

    // Renamed from `window` (Task 4) -- that name silently SHADOWED the real browser global for the rest of this component's body, including handleExportSelection's `window.open()` call below, which was a live, never-yet-clicked bug (TypeError: window.open is not a function, since that identifier resolved to this {start,end} object instead of the global). Found auditing this file for Track's own drag handles, which genuinely need the real global.
    //
    // seasonWindow (season.logic.js, a bare global) replaces what used to be an inline {start: today, end: live.bpEnd || today}. With bpEnd unset -- the dev database's actual state -- that made start === end, so barGeometry divided by a 1ms window and every bar on the Track collapsed to a sliver at 0%. See that function's own header. 🔴 THE WINDOW IS STATE NOW, AND `null` MEANS FIT. Keeping "fitted" as an absence rather than a copy of the fit window means the plot re-fits when the season's own extent changes — staging a draw three weeks past the battle pass widens the axis instead of leaving the new bar outside a window that was correct when it was captured.
    const fullWindow = seasonWindow(state.live);
    const visibleWindow = zoomedWindow ? clampWindow(zoomedWindow, fullWindow) : fullWindow;

    async function handleExport(changeset) {
        const res = await exportChangeset(changeset._id, session.csrfToken);
        const refused = refusalOf(res);
        if (refused) return overlay.say(`Not exported — ${refused}`);
        overlay.say('Export saved. This change can commit now.');
        fetchChangesets('season').then(setChangesets);
    }

    // Mockup's Staged panel (01-season-spine.html) shows Discard as a first-class action, but no route ever set state:'discarded' anywhere in the portal before this — the only way out of a staged/blocked change was to commit it. Ownership-scoped exactly like export/commit above.
    async function handleDiscard(changesetId) {
        const res = await fetchJson(`/api/changeset/${changesetId}/discard`, { method: 'POST', headers: { 'x-csrf-token': session.csrfToken } });
        const refused = refusalOf(res);
        if (refused) return overlay.say(`Not discarded — ${refused}`);
        fetchChangesets('season').then(setChangesets);
    }

    // ⚠️ `handleCommit` LIVED HERE AND IS GONE. Season stopped being able to commit when board.js's duplicate review panel was removed — the Review realm is the only surface that writes, and a live commit function on a page that no longer has a control for it is the next session's accident.

    // 🔴 ONE CHANGESET FOR THE WHOLE PASTE, not one per line. Eight pasted draws staged as eight changesets would fill the Review screen with eight separate transactions to commit, each individually discardable — which is not what a person who pasted one list means. stageOps already takes an array; this is the caller finally passing one. 🔴 THE DRAFT PATH REPLACES; THE LIVE PATH ADDS. core/ops/season.js's draft bulk ops `$set` the whole array — that is the Discord modal's semantics, where the textarea IS the list — while the live path composes one add per row. Two genuinely different operations behind one paste box, so the confirmation has to say which one is about to happen; a toast afterwards saying "replaced" would be telling somebody what they had already lost.
    async function handleStageDraftMany(kind, rawText) {
        if (kind === 'patchnote') {
            return overlay.say('Patch notes have no draft — they are one history, not a per-season list.');
        }
        const isDraw = kind === 'draw' || kind === 'returning';
        const op = isDraw
            ? { type: 'season.bulkDraftDraws', target: null,
                payload: kind === 'draw' ? { newText: rawText } : { returningText: rawText } }
            : { type: 'season.bulkDraftCalendar', target: null, payload: { text: rawText } };
        const noun = isDraw ? (kind === 'draw' ? 'new draws' : 'returning draws') : 'calendar';
        overlay.confirm({
            op: op.type, tier: 2, confirmLabel: 'Replace the draft list',
            title: `Replace the draft's ${noun}?`,
            body: html`<p class="dw-p">Pasting into the next season <b>replaces</b> that list rather than adding to
                it — the box is the list. Nothing live changes, and nothing is visible to players until the draft is
                promoted. Tier 2, so the previous draft list is captured and can be put back.</p>`,
            onConfirm: async () => {
                const res = await stageOps('season', [op], session.csrfToken);
                const refused = refusalOf(res);
                if (refused) return overlay.say(`Not staged — ${refused}`);
                setShowAdd(null);
                overlay.say(`Staged · the draft's ${noun}`, 'Review →', () => { location.hash = '#/review'; });
                fetchChangesets('season').then(setChangesets);
            },
        });
    }

    async function handleStageMany(kind, rows, rawText) {
        if (idScope === 'draft') return handleStageDraftMany(kind, rawText);
        const ops = rows.map((r) => buildSeasonAddOp(kind, { title: r.name, startDate: r.start, endDate: r.end || r.start }));
        if (!ops.length) return;
        await stageOps('season', ops, session.csrfToken);
        setShowAdd(null);
        overlay.say(`Staged · ${ops.length} ${ops.length === 1 ? 'item' : 'items'} from what you pasted`, 'Review →', () => { location.hash = '#/review'; });
        fetchChangesets('season').then(setChangesets);
    }

    // 🔴 ONE COMPOSER ENTRY CAN BE TWO OPS, AND THEY ARE ONE CHANGESET. A draw with a closing date stages the draw and its calendar window together (buildSeasonAddOps) — staging them separately would put two rows on Review for one act and let the window commit without the draw it is a window onto.
    //
    // ⚠️ IT SAID NOTHING AT ALL BEFORE. Every other staging path in this realm toasts; this one closed the form and left the reader looking at an unchanged Track, because the staged row does not appear until the changeset fetch returns. The arrow is a real link to the only screen that commits.
    async function handleAdd(opOrOps) {
        const ops = [].concat(opOrOps).filter(Boolean);
        if (!ops.length) return;
        const res = await stageOps('season', ops, session.csrfToken);
        const refused = refusalOf(res);
        if (refused) return overlay.say(`Not staged — ${refused}`);
        setShowAdd(null);
        setComposeGhost(null);
        overlay.say(ops.length > 1 ? `Staged · ${ops.length} changes` : 'Staged', 'Review →', () => { location.hash = '#/review'; });
        fetchChangesets('season').then(setChangesets);
    }

    // 🔴 THE PORTAL COULD PROMOTE A DRAFT IT HAD NO WAY TO CREATE. core/ops declares five draft operations and /manage reaches all five; the portal reached none, so the promote row added to the one-way strip was an action on a thing nobody could make. A capability whose only entry point is somewhere else is not a capability this surface has.
    //
    // ⚠️ STARTING A DRAFT IS TIER 1, NOT A DESTRUCTIVE ACT, and the copy has to say so or nobody will press it. season.setDraftTitlesDeadlines sets draft.active and touches nothing live — the whole point of a draft is that it is invisible to players until promoted, which is the one-way step and lives in the strip below.
    async function startDraft(title) {
        const op = { type: 'season.setDraftTitlesDeadlines', target: null, payload: { mainTitle: title } };
        const res = await stageOps('season', [op], session.csrfToken);
        const refused = refusalOf(res);
        if (refused) return overlay.say(`Draft not started — ${refused}`);
        overlay.say('Staged · a new draft. Nothing is public until you promote it', 'Review →', () => { location.hash = '#/review'; });
        fetchChangesets('season').then(setChangesets);
    }

    function confirmDiscardDraft() {
        const d = state.draft || {};
        const n = (d.newDraws || []).length + (d.returningDraws || []).length + (d.calendar || []).length;
        overlay.confirm({
            op: 'season.discardDraft', tier: 2, danger: true, confirmLabel: 'Discard the draft',
            title: 'Discard the staged draft?',
            body: html`<p class="dw-p">This throws away the draft's title, deadlines and its${' '}
                <b>${n} staged item${n === 1 ? '' : 's'}</b>. Nothing live changes — a draft has never been visible
                to players. Tier 2, so it is recorded with its inverse and can be put back.</p>`,
            onConfirm: async () => {
                const res = await stageOps('season', [{ type: 'season.discardDraft', target: null, payload: {} }], session.csrfToken);
                const refused = refusalOf(res);
                if (refused) return overlay.say(`Not discarded — ${refused}`);
                overlay.say('Staged · the discard', 'Review →', () => { location.hash = '#/review'; });
                fetchChangesets('season').then(setChangesets);
            },
        });
    }

    // A one-way op stages exactly like every other one — that is the point. What makes it different is downstream: it lands as tier 3, and Review will not commit it until the export exists. The toast names the next step because the reader has just pressed something frightening and needs to know what did and did not happen.
    async function handleOneWay(op, item) {
        const res = await stageOps('season', [op], session.csrfToken);
        const refused = refusalOf(res);
        if (refused) return overlay.say(`Not staged — ${refused}`);
        overlay.say(`Staged · ${item.title} — it needs an export before it can commit`, 'Review →', () => { location.hash = '#/review'; });
        fetchChangesets('season').then(setChangesets);
    }

    // "Change type…" and "Shift dates…" from the approved mockup's bulk bar need an inline amount/type input Manifest's bulkActions shape doesn't carry (onClick(ids) takes no extra argument) -- deliberately scoped out of this pass rather than reaching for a native prompt(), which this session already removed from Access's Revoke for the same UX reason. Stage deletion and Export selection need no such input and are built here. toManifestRows/stateForElement now live in season.logic.js (bare global, same pattern as LANE_LABELS above) -- real state derivation needs `changesets` (already fetched for Board), so it moved out of a browser-only local function to become properly testable.
    const allRows = toManifestRows(state.live, changesets, state.draft);
    const boardItems = toBoardItems(state.live, changesets, state.draft);

    // 🔴 THE COLUMNS ARE DATES, SO MOVING A CARD MOVES THE WINDOW — the rule is season.html's, ported rather than re-derived. The item's LENGTH is preserved; only where it sits moves. 'live' pulls the start to yesterday so the row is unambiguously running rather than starting at this instant; 'upcoming' pushes it three days out, far enough that it does not immediately read as live again. 'ended' is not a target: finishing is something dates cause, never something you assert.
    async function handleBoardMove(item, column) {
        if (column === 'ended') return;
        const start = String(item.startDate || item.date || '').slice(0, 10);
        const end = String(item.endDate || start).slice(0, 10);
        const len = Math.max(0, Math.round((new Date(end + 'T00:00:00Z') - new Date(start + 'T00:00:00Z')) / 86400000));
        const shift = (from) => { const d = new Date(todayIso() + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + from); return d.toISOString().slice(0, 10); };
        if (column === 'staged') return;               // staging is what the composer does; a drag cannot invent one
        const nextStart = column === 'live' ? shift(-1) : shift(3);
        const nextEnd = (() => { const d = new Date(nextStart + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + len); return d.toISOString().slice(0, 10); })();
        const op = editOpFor({ ...item, startDate: nextStart, endDate: nextEnd }, nextEnd);
        await stageOps('season', [op], session.csrfToken);
        fetchChangesets('season').then(setChangesets);
    }
    function rowsById(ids) { return allRows.filter((r) => ids.includes(r.id)); }

    async function handleBulkDelete(ids) {
        const rows = rowsById(ids);
        const ops = rows.map((r) => {
            const isDraw = r.lane === 'newDraws' || r.lane === 'returningDraws';
            return isDraw
                ? { type: 'draw.delete', target: { category: r.lane === 'newDraws' ? 'new' : 'returning', elementId: r.id }, payload: {} }
                : { type: 'calendar.delete', target: { elementId: r.id }, payload: {} };
        });
        if (ops.length) await stageOps('season', ops, session.csrfToken);
        overlay.say(`Staged · ${ops.length} deletion${ops.length === 1 ? '' : 's'}`, 'Review →', () => { location.hash = '#/review'; });
        fetchChangesets('season').then(setChangesets);
    }

    // Season's deletions STAGE, like everything else it composes — so the confirmation's job is to say that, and to name the items, because a draw and a calendar event are the same row shape here and a reader picking three of thirty needs to see which three.
    function confirmBulkDelete(ids) {
        // 🔴 THE BULK PATH NEEDS THE SAME LANE GUARD AS THE ROW ONE. Season's table is selectable, so a
        //    selection can include a publication — and season.delete is a calendar/draw op. Dropping them
        //    here rather than at the server keeps the confirm dialog HONEST about what it is about to stage.
        const dropped = rowsById(ids).filter((r) => r.lane === 'patchNotes').length;
        ids = ids.filter((id) => (rowsById([id])[0] || {}).lane !== 'patchNotes');
        if (!ids.length) { setPageError('Patch notes are removed from the Season Record, not the table.'); return; }
        const chosen = rowsById(ids);
        overlay.confirm({
            op: 'season.delete', tier: 2, danger: true, confirmLabel: 'Stage deletion',
            title: `Stage deletion of ${ids.length} item${ids.length === 1 ? '' : 's'}?`,
            body: html`
                <p class="dw-p">Nothing leaves the season yet — this stages the deletion, and the items keep
                    showing in Discord until the changeset is committed on the Review screen.</p>
                <ul class="dw-l">${chosen.slice(0, 6).map((r) => html`<li key=${r.id}>${r.title}</li>`)}
                    ${ids.length > 6 ? html`<li>and ${ids.length - 6} more</li>` : null}</ul>`,
            onConfirm: () => handleBulkDelete(ids),
        });
    }

    // 🔴 THIS BUILT A CAPTION AND CALLED IT AN EXPORT, then handed it to `window.open('data:…')`, which browsers block — measured in this app: the call returns null and nothing happens. So the button ran, said nothing and produced no file, and the text it would have produced (`title — window`) is read back by nothing anyway. A selection now writes the same TSV the Manifest shows, and whole-list backups live in the masthead's Export strip, in the bot's own formats.
    function handleExportSelection(ids) {
        const rows = rowsById(ids);
        const header = ['Title', 'Type', 'Window', 'State'].join('\t');
        const body = rows.map((r) => [r.title, r.type || '', r.window || '', r.state || ''].join('\t')).join('\n');
        downloadText(`dioreo-season-selection-${todayIso()}.tsv`, `${header}\n${body}`, 'text/tab-separated-values;charset=utf-8');
    }

    // ⚠️ EACH SCOPE STATES ITS OWN SHAPE. Three of these four re-import and one does not — `formatPatchNotesAsText` is a read format with no bulk-add flow behind it — and one note claiming "the format the paste box accepts" for all four would tell somebody they hold a backup of their patch notes that nothing can restore.
    const exportScopes = [
        { subsetOf: 'season.all', id: 'season.draws', label: 'New draws', unit: 'draws', count: (state.live?.newDraws || []).length,
          url: '/api/season/export?scope=draws', filename: `dioreo-new-draws-${todayIso()}.txt`,
          note: 'Title, items, date, thumbnail — the exact line format Bulk Add New Draws reads back.' },
        { subsetOf: 'season.all', id: 'season.returning', label: 'Returning draws', unit: 'draws', count: (state.live?.returningDraws || []).length,
          url: '/api/season/export?scope=returning', filename: `dioreo-returning-draws-${todayIso()}.txt`,
          note: 'The same line format, for the returning list.' },
        { subsetOf: 'season.all', id: 'season.calendar', label: 'Calendar', unit: 'entries', count: (state.live?.calendar || []).length,
          url: '/api/season/export?scope=calendar', filename: `dioreo-calendar-${todayIso()}.txt`,
          note: 'Prefixed bullet lines — a different shape from the draws export, and what Add Multiple reads.' },
        { subsetOf: 'season.all', id: 'season.patchnotes', label: 'Patch notes', unit: 'entries', count: (state.live?.patchNotes || []).length,
          url: '/api/season/export?scope=patchnotes', filename: `dioreo-patch-notes-${todayIso()}.txt`,
          note: 'A readable record, NOT a re-importable one — patch notes have no bulk-add flow to read it back.' },
        // 🔴 THE BACKUP SCOPE. Four lists in four files is not "the season" — nothing here handed back the Track itself, which is the thing this page is about. Columns rather than paste-back text, and the note says so: a mixed list has no bulk-add flow to read it back, exactly like the patch notes above.
        { id: 'season.all', label: 'Everything on this Track', unit: 'items',
          count: (state.live?.newDraws || []).length + (state.live?.returningDraws || []).length
               + (state.live?.calendar || []).length + (state.live?.patchNotes || []).length,
          url: '/api/season/export?scope=all', filename: `dioreo-season-manifest-${todayIso()}.tsv`,
          note: 'The manifest as tab-separated columns, every type in one file. A record, not a re-import.' },
    ];

    // Task 4 -- Track's drag handles. editOpFor (track.logic.js, a bare global) preserves every field of the dragged item except the edited date; a draw writes to `date`, a calendar item to `endDate` (see that function's own header for the full field-name reasoning).
    async function handleDragCommit(item, newDate) {
        const op = editOpFor(item, newDate);
        await stageOps('season', [op], session.csrfToken);
        fetchChangesets('season').then(setChangesets);
    }

    // Playlists are split out of `calendar` into their own lane. Track's LANE_LABEL and TOPIC_VAR have carried a `playlist` entry since the first build and nothing ever filled it, so every playlist-category calendar item rendered in the Events lane in the Events colour -- flagged by Session A's own post-hoc pass as pre-existing and left for this phase.
    //
    // 🔴 AND THAT FIX STOPPED ONE CATEGORY SHORT. `!isPlaylist` is not "is an event" -- the calendar has THREE categories, and the third is `draw`, a DRAW WINDOW (when a draw can be bought). Every one of them landed in the Events lane, in the Events colour, exactly as playlists had. The split is now driven by `calCategoryOf`, so the lane a row lands in and the label the Manifest prints for it come from one table; adding a fourth category cannot silently mean "event" again.
    const trackData = buildTrackData(state.live);
    // The draft rail had the identical bucketing bug as the live rail (state.draft's own keys are newDraws/returningDraws/calendar, not draw/returning/event) -- fixed in the same pass since it's the same reshape, not a second task.
    const draftCal = splitCalendar(state.draft);
    const draftRails = state.draft ? {
        draw: toTrackItems(state.draft, 'newDraws', 'draw', state.draft?.bpEnd || state.live?.bpEnd),
        returning: toTrackItems(state.draft, 'returningDraws', 'returning', state.draft?.bpEnd || state.live?.bpEnd),
        drawwindow: toTrackItems(draftCal.drawWindows, 'calendar', 'drawwindow', state.draft?.bpEnd || state.live?.bpEnd),
        event: toTrackItems(draftCal.events, 'calendar', 'event', state.draft?.bpEnd || state.live?.bpEnd),
        playlist: toTrackItems(draftCal.playlists, 'calendar', 'playlist', state.draft?.bpEnd || state.live?.bpEnd),
    } : null;
    // An EMPTY draft is not a draft. `state.draft` is a truthy object as soon as the season doc has the key at all, so the divider plus five empty lanes rendered ~200px of dead space announcing "Next season draft" for a draft holding nothing.
    const draftData = draftRails && Object.values(draftRails).some((items) => items.length) ? draftRails : null;

    // The masthead's numbers, from real data rather than a caption (01-season-spine.html's "14 DAYS LEFT · 6 DRAWS LIVE · 3 STAGED"). bpEnd is genuinely optional, so "days left" says so rather than printing a number derived from a missing field.
    const drawsLive = (state.live?.newDraws || []).length + (state.live?.returningDraws || []).length;
    // 🔴 "LIVE NOW" COUNTED EVERY DRAW AND NO CALENDAR ROW AT ALL. It read `newDraws + returningDraws`, which is neither live (a draw that closed last week is in it) nor everything (fourteen playlists, six events and three draw windows are not) — 14 against the design's 20 on the same fixtures. The Board already answers this exact question one tab away, so the count now comes from the same items through the same lifecycleOf: the eyebrow and the Board can no longer disagree about what is live.
    const liveNow = groupBoardItems(boardItems, { today: todayIso(), newestPatchNoteId: newestPatchNoteId(boardItems) }).live.length;
    const stagedCount = changesets.filter((c) => c.state === 'staged' || c.state === 'blocked').length;
    const daysLeft = state.live?.bpEnd
        ? Math.max(0, Math.ceil((new Date(state.live.bpEnd).getTime() - Date.now()) / 86400000))
        : '—';
    // The Track derives its own findings; the eyebrow counts the same ones rather than a second rule.
    const flagCount = state.live?.bpEnd
        ? Object.values(trackData).flat().filter((i) => i.endDate && i.endDate > state.live.bpEnd).length : 0;
    // 🔴 SEASON HAS NO STAT BLOCK, AND THAT IS THE DESIGN RATHER THAN AN OMISSION. COMPANION 16.31 point 3: the clock *"replaces the masthead's stat block, which he called useless"*, and the three counts demote to the eyebrow above the title. Every other realm keeps its stats row; Season is the one realm whose masthead already carries a 82px figure, so a second figure row would be competing with it. Do not "restore" one here -- an empty `stats` prop on this realm is a decision.

    async function handleIdentitySave(edits) {
        // Two ops, because they are two entities: the season document's own titles and dates, and the calendar's banner urls. Splitting them here rather than server-side keeps each op's payload exactly what its own validate() expects.
        const bannerKeys = BANNERS.map((b) => b.k);
        const seasonEdits = Object.fromEntries(Object.entries(edits).filter(([k]) => !bannerKeys.includes(k)));
        // The payload is keyed the way the OP names these pages, not the way the document stores them — see the note on BANNERS.
        const bannerEdits = Object.fromEntries(Object.entries(edits)
            .filter(([k]) => bannerKeys.includes(k))
            .map(([k, v]) => [BANNERS.find((b) => b.k === k).op, v]));
        const ops = [];
        // ⚠️ A DRAFT HAS NO CALENDAR BANNERS. calendar.setBanners writes the live document's banner urls and there is no draft equivalent, so a banner edit made while the Next scope is selected would silently land on LIVE — the one thing a draft is supposed to make impossible. The banner fields are not rendered in that scope for the same reason.
        if (Object.keys(seasonEdits).length) {
            ops.push({ type: idScope === 'draft' ? 'season.setDraftTitlesDeadlines' : 'season.setTitlesDeadlines',
                target: null, payload: seasonEdits });
        }
        if (idScope !== 'draft' && Object.keys(bannerEdits).length) ops.push({ type: 'calendar.setBanners', target: null, payload: bannerEdits });
        if (ops.length) { await stageOps('season', ops, session.csrfToken); fetchSeasonState().then(setState); fetchChangesets('season').then(setChangesets); }
    }

    // 🔴 TWO DISCARD BUTTONS, TWO DIFFERENT CONFIRMATIONS, ONE ACTION. The staged panel opened the shared drawer; the Board's own card called a native confirm() from inside board.js — so the same act asked for permission in two different voices depending on which view you happened to be in, and only one of them could say the tier. Both go through this now, and board.js no longer owns a dialog at all.
    const confirmDiscard = (c) => overlay.confirm({
        op: 'changeset.discard', tier: 1, danger: true, confirmLabel: 'Discard',
        title: 'Discard this staged change?',
        body: html`<p class="dw-p">Nothing live is undone — this change never reached Discord. Only what has not
            committed yet is abandoned.</p>`,
        onConfirm: () => handleDiscard(String(c._id)),
    });

    // The strip's own way out. With exactly one staged change this IS the single discard, so the two controls never ask the same question in two different voices — the defect confirmDiscard was written to close, one level up.
    function confirmDiscardAll(pending) {
        if (pending.length === 1) return confirmDiscard(pending[0]);
        overlay.confirm({
            op: 'changeset.discard', tier: 1, danger: true, confirmLabel: `Discard all ${pending.length}`,
            title: `Discard ${pending.length} staged changes?`,
            body: html`<p class="dw-p">Nothing live is undone — none of these reached Discord. Everything staged
                on this realm is abandoned, including anything staged from the Board or the Manifest.</p>`,
            onConfirm: async () => { for (const c of pending) await handleDiscard(String(c._id)); },
        });
    }

    // ⚠️ THE WHOLE SET GOES IN ONE CHANGESET. Editing the current entry can produce up to three ops — date/info and each image slot — and they are one act; staging them separately would put three rows on Review for one edit and let two of them commit without the third.
    async function handlePatchStage(entry, ops) {
        if (!ops.length) return;
        await stageOps('season', ops, session.csrfToken);
        setOpenPatchId(null);
        fetchSeasonState().then(setState);
        fetchChangesets('season').then(setChangesets);
    }

    const editingDraft = idScope === 'draft';
    const draftZone = html`<${DraftZone} draft=${state.draft} live=${state.live} onStart=${startDraft} onDiscard=${confirmDiscardDraft} />`;
    const identitySlot = html`<${SeasonIdentity} season=${editingDraft ? (state.draft || {}) : state.live}
                                                 editingDraft=${editingDraft} draftStaged=${Boolean(state.draft?.active)}
                                                 today=${todayIso()} onSave=${handleIdentitySave} onScope=${setIdScope}
                                                 draftSlot=${draftZone} />`;

    // The window range is the view bar's meta line on EVERY view of this panel, not only the Track: it says where in the season you are, and the Board and Repairs are just as much a view of it. Extracted so the conformance mount above can take it: one Composer, two possible positions, never two instances. 🔴 IT MOVED OUT OF THE MASTHEAD AND INTO THE OVERLAY SLOT, because it is a modal drawer now and this file already knows where overlays live: "one overlay in the wrong place is a bug; two is the shape of the thing, and the shape is that overlays do not live in the content tree." Rendered under the masthead it would have had main's stacking context above its own scrim, exactly as the day drawer did.
    const composerSlot = showAdd ? html`<${Composer} types=${composeTypes()} initialType=${showAdd === true ? null : showAdd}
                                              onStage=${(kind, fields) => handleAdd(buildSeasonAddOps(kind, fields))}
                                              onStageMany=${handleStageMany}
                                              onLive=${setComposeGhost}
                                              onCancel=${() => { setComposeGhost(null); setShowAdd(null); }} />` : null;
    const viewSlot = view === 'Track'
        ? html`               <!-- 🔴 THE TRACK WAS THE SIXTH BLOCK ON THE TRACK TAB. Measured at 1280: you clicked "Track"
                    and the ruler began 863px below the tab, behind the identity strip, a 126px draft card
                    and a 438px staged-changes callout. StagedPanel's own comment says the mockup keeps
                    pending changes "right beside the Track" — the intent was adjacency and the execution
                    was obstruction. Below it, they are still beside it, and the instrument is the first
                    thing on the page that exists to show it. -->
               <${Track} data=${trackData} publications=${state.live?.patchNotes || []} ghost=${showAdd ? composeGhost : null} onPickDay=${setDayOpen}
                          rail=${deadlineRail(state.live, visibleWindow.start, visibleWindow.end)}
                          draft=${draftData} window=${visibleWindow} full=${fullWindow} onWindow=${setZoomedWindow}
                          season=${state.live} onDragCommit=${handleDragCommit}
                          onFillGap=${() => setShowAdd('event')}
                          foot=${html`<${PatchRecord} live=${state.live} openId=${openPatchId} onOpen=${setOpenPatchId}
                                                      onPreview=${setRecPreview}
                                                      onPublish=${() => setShowAdd('patchnote')} onStage=${handlePatchStage} />`} />
               <!-- ⚠️ THE STAGED STRIP AND THE DAY CHIP BOTH LIVED HERE AND BOTH LEFT. The strip moved above
                    the view content, because staging happens on all three views and this one told you about
                    it on one. The chip moved INTO the Zoomer as "Today": it was a lone floating pill agreeing
                    with no other left edge on the page, and opening a day is a Track control, so it belongs
                    in the Track's own toolbar beside the zoom it shares a job with. -->
`
        : view === 'Repairs'
            ? html`<${Repairs} data=${trackData} window=${visibleWindow} season=${state.live} onClamp=${handleDragCommit} />`
            : html`<${Board} items=${boardItems} today=${todayIso()} newestPatchId=${newestPatchNoteId(boardItems)}
                             onMove=${handleBoardMove} onOpen=${(it) => setDayOpen(String(it.startDate || '').slice(0, 10) || todayIso())} />`;

    // ⚠️ IT FILTERS, IT DOES NOT SEARCH. The Manifest's own search box is text; this is a STATE predicate, and running it through the search field would mean typing a word that matches nothing in any cell.
    const shownRows = stagedOnly ? allRows.filter((r) => r.state === 'staged' || r.state === 'blocked') : allRows;
    const manifestSlot = html`<${Manifest} rows=${shownRows} columns=${SEASON_COLUMNS} searchableFields=${['title']}
                                            label="Manifest" defaultSort="window" footRow=${html`<${AddRow} onStage=${handleAdd} />`} extraChips=${html`
                                                        <button type="button" class="chip stagedchip" data-state="staged"
                                                                aria-pressed=${stagedOnly ? 'true' : 'false'}
                                                                data-tip="Show only the rows a staged change touches"
                                                                onClick=${() => setStagedOnly(!stagedOnly)}>Staged only</button>`}
                                                    searchLabel="Search this season" searchPlaceholder="Search this season…" countSuffix=" shown" filterGroups=${SEASON_FILTERS}
                                            headerRight=${`${drawsLive} draws · ${(state.live?.calendar || []).length} calendar items`}
                                            bulkNote="Reversible — a staged removal is discarded, never undone"
                                            bulkTier=${2} rowNoun=${['item', 'items']}
                                            onRemove=${(row) => (row.isDraft || row.lane === 'patchNotes' ? null : confirmBulkDelete([row.id]))} removeLabel="Remove"
                                            emptyText="This season has no draws or calendar items yet." 
                                            onAdd=${null} realm="season" csrfToken=${session.csrfToken}
                                            buildEditOp=${buildSeasonEditOp}
                                            onEditError=${(msg) => setPageError(msg)}
                                            bulkActions=${[
                                                { label: 'Export selection', onClick: handleExportSelection },
                                                { label: 'Remove', danger: true, onClick: confirmBulkDelete },
                                            ]} />`;

    // 🔴 EVERY OVERLAY RENDERS FROM THE SHELL'S SLOT, WHICH IS OUTSIDE main. The day drawer was mounted

    // inside the Track's view slot, so it inherited the same two things the export drawer did before it

    // moved: a scrim trapped by main's own z-index, and every descendant rule of whatever panel it

    // happened to sit under. One overlay in the wrong place is a bug; two is the shape of the thing,

    // and the shape is that overlays do not live in the content tree.


    return html`
        <${Shell} realm="season" session=${session} busy=${load.hostClass} view=${view} viewOptions=${['Track', 'Board', 'Repairs']} onSetView=${setView}
                  stateKey=${['saved', 'staged', 'conflict'].filter((k) => allRows.some((r) => (r.state === 'live' ? 'saved' : r.state) === k))}
                  badges=${{ review: stagedCount }} exports=${exportScopes} exportLabel="Export" overlayFor=${overlay}
                  tools=${view === 'Track' ? html`<${Zoomer} win=${visibleWindow} full=${fullWindow} onWindow=${setZoomedWindow}
                                                              onToday=${() => setDayOpen(todayIso())} />` : null}
                  meta=${`${TL.fmt(visibleWindow.start)} → ${TL.fmt(visibleWindow.end)}`}
                  masthead=${html`<${Masthead} eyebrow=${html`<${Eyebrow} live=${liveNow} staged=${stagedCount} flags=${flagCount} />`}
                                               title=${state.live?.currentSeasonTitle || 'Season'}
                                               sub="Everything scheduled this season on one axis — and whether it still fits inside the season’s own deadlines." 
                                               aside=${html`<${SeasonClock} season=${state.live} today=${todayIso()} />`}
                                               actions=${html`<${AddChips} onAdd=${(key) => setShowAdd(key)} />`} />`}
                  contextSlot=${html`
                      <!-- The season's identity and its draft live ABOVE the view layer, not inside it —
                           they are the context the Track is read against, and they do not change when the
                           view does. Putting them in the view meant Track, Board and Repairs each re-drew
                           the same record beneath their own header, and pushed the Track off the fold. -->
                      ${identitySlot}
                      <!-- THE DRAFT ZONE LIVES INSIDE THE IDENTITY BODY IN THE DESIGN, so with the identity
                           collapsed it is not on the page at all. Hoisting it into the context band put a
                           63px block about a thing that does NOT exist above the Track. It stands down with
                           the rest of the pending work; where it finally belongs is a design question for
                           the re-apply phase, not something to settle inside a conformance pass. -->
`}
                  viewSlot=${html`
                      <!-- 🔴 A REJECTED EDIT LOOKED LIKE A SAVED ONE. The edit-error callback pushed the server's refusal
                           into the tray — the panel headed "Saved" — where it rendered in the same voice as a
                           successful change and scrolled away with them. role=alert because it appears without
                           the reader doing anything, and it stays until dismissed rather than timing out. -->
                      ${pageError ? html`
                          <p class="errmsg" role="alert">${pageError}
                              <button class="chip" onClick=${() => setPageError('')}>Dismiss</button></p>` : null}
                      <${StagedPanel} changesets=${changesets} onReview=${() => { location.hash = '#/review'; }}
                                      onDiscardAll=${confirmDiscardAll} />
                      ${viewSlot}`}
                  overlaySlot=${html`${overlay.render()}${composerSlot}${recPreview ? html`
                      <${RecordPreview} note=${recPreview} onClose=${() => setRecPreview(null)} />` : null}${dayOpen ? html`
                      <${DayDrawer} day=${dayOpen} live=${trackData} draft=${draftData}
                                    withDraft=${dayWithDraft} onWithDraft=${setDayWithDraft}
                                    onDay=${setDayOpen}
                                    onClose=${() => setDayOpen(null)} />` : null}`} manifestSlot=${manifestSlot}
                  footSlot=${html`<${OneWay} live=${state.live} draft=${state.draft} session=${session} overlay=${overlay} onStage=${handleOneWay} />`}
                  stagedOps=${(changesets || []).filter((c) => c.state === 'staged' || c.state === 'blocked').flatMap((c) => (c.ops || []).map((o) => ({ ...o, changesetId: c.id })))} />`;
}
