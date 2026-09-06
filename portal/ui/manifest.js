// portal/ui/manifest.js — ESM. The Manifest: search, filter chips, sortable table, multi-select, bulk bar, and an opt-in Add button + click-to-edit cell + click-to-preview row. Reused UNCHANGED by every realm (spec §8.2) — a realm supplies only `columns`/`rows`/`bulkActions`/`onAdd`/`buildEditOp`/`onRowClick`/`filterGroups`, never its own copy of this component.
//
// filterRows/sortRows/toggleSelection come from manifest.logic.js, loaded as a classic script — see track.js's header comment for why that is the real cross-runtime resolution here.
import { h } from '../vendor/preact.mjs';
import { html } from '../vendor/htm-preact.mjs';
import { useState, useMemo, useEffect } from '../vendor/preact-hooks.mjs';
import { stageAndCommit } from './composeClient.js';
import { Icon } from './icons.js';

// `filterGroups` is [{key, label, options:[{value,label}]}]. One CHIP PER GROUP that cycles through its own options, not one chip per option: 03-three-surfaces.html renders exactly two chips ("Type: all ×", "State: staged ×") for a table with five types and four states, so the chip shows the current value rather than enumerating every possible one. `all` is always the first option and is what the × returns to. The state pill's own class comes from the state VALUE, so a realm reporting 'scheduled' or 'expired' gets the right shape without this component learning its vocabulary. Anything unrecognised falls to the conflict shape, which is the safe default: an unknown state should look like something to look at, never like a confirmed live row. 🔴 EXPORTED, because a realm that needs to add something BESIDE the state (Season's outlives-the-season warning) used to supply its own `render` and lose the pill entirely — the column whose whole job is state, drawn as a bare word, on every row. ⚠️ `live` MAPS TO `saved`. The stylesheet fills `.stt.saved`; `.stt.live` has no rule, so the one column whose job is to carry state as a filled chip rendered as plain text on every live row. The stored value and the class are different vocabularies and this is where they meet. 🔴 FOUR OF THESE SIX EMITTED A CLASS NEITHER STYLESHEET DEFINES, AND TWO OF THE FOUR WERE REACHABLE. Measured 2026-09-01 from Broadcast's pass: `.stt.stag`, `.stt.sched`, `.stt.exp` and `.stt.conf` have ZERO rules in `portal/ui/app.css` AND zero in the design's — only `.stt.saved`, `.stt.staged` and `.stt.conflict` exist. `season.logic.js`'s `stateForElement` returns exactly live | staged | conflict, so every STAGED and every CONFLICT row on Season had been rendering its state chip with no shape at all — bare 9px mono text — against COMPANION §0.0's law that SHAPE carries state (solid live, dashed staged, hatched conflict). Same defect as Armory's `RANK_KEY` emitting `t-t3` against `.t-top3`, in the same component, and `portalReverseOrphans` carried it in its accepted-debt baseline for the same reason. ⚠️ `scheduled` and `expired` are UNREACHABLE today — Broadcast is the only realm with those states and it renders its own chip. They map the way Broadcast's own renderer maps them (anything not staged is solid), so the two vocabularies cannot drift apart if a realm ever does route them through here. ⚠️ `scheduled`/`expired` map to `saved` because Broadcast's own hand-rolled renderer does (anything not staged is solid) and they are unreachable through this component today. 🔴 A LATER SELF-REVIEW CAUGHT THE HAZARD IN THAT CHOICE: if a realm ever DOES route a scheduled row through here it renders a solid green SAVED chip, which claims a not-yet-live thing is live — a wrong render, worse than the no-shape defect this map was fixed to remove. The comment above already names the safe answer (*anything unrecognised falls to the conflict shape… an unknown state should look like something to look at, never like a confirmed live row*), so the two are listed explicitly and everything else falls there.
const PILL = { live: 'saved', saved: 'saved', staged: 'staged', conflict: 'conflict' };
// ⚠️ THE PILL AND THE KEY MUST SAY THE SAME WORD. The key above the table reads saved / staged / conflict — the design's vocabulary — and the pill printed the row's raw stored state, so a live row said LIVE beside a legend that never uses that word. The stored value stays `live`; only the label is the design's.
const STATE_LABEL = { live: 'SAVED', saved: 'SAVED', staged: 'STAGED', conflict: 'CONFLICT' };
export function StatePill({ state, accent }) {
    const key = String(state == null ? '' : state);
    // ⚠️ THE ACCENT IS A CUSTOM PROPERTY THE STYLESHEET ALREADY READS. `.stt.saved` fills from --c, so without one every pill fell back to plain text — the one column whose entire job is to carry state as a shape had no shape. The design sets it per row, from the row's own topic. A filled pill needs its own ink for the same reason a filled bar does: --on-accent is near-black and a draw window's plum takes it to 2.86:1. inkOnTopic derives it from the accent's luminance; a realm that passes a literal colour, or none, falls back to the stylesheet's global.
    const ink = accent && typeof inkOnTopic === 'function' && /^var\((--[\w-]+)\)$/.test(accent)
        ? inkOnTopic(accent.replace(/^var\(|\)$/g, '')) : '';
    return html`<span class=${'stt ' + (PILL[state] || 'conflict')} style=${accent ? `--c:${accent}` + (ink ? `;--ci:${ink}` : '') : null}>${STATE_LABEL[key] || key.toUpperCase()}</span>`;
}

function FilterChips({ groups, filters, onChange }) {
    // 🔴 ONE CHIP PER VALUE, NOT ONE CHIP PER GROUP THAT CYCLES. This rendered a single chip reading "Type: all" which advanced through its options on each click, cited to 03-three-surfaces.html. That citation is the 2026-08-20 package; the 2026-08-23 package supersedes it and draws every value as its own chip — `All · New draws · Returning · Draw windows · Events · Playlists · Patch notes` on Season, `All · live · scheduled · expired` on Broadcast — and on 2026-08-27 Harkirat wrote that the mockup IS the design. Same failure as the Board: a real quotation from a retired document, checked for existence and never for currency.
    //
    // It is also the better control on its own merits, which is worth saying so nobody re-litigates it from taste: a cycling chip hides the vocabulary until you click it, gives no way to reach the third option except by passing through the second, and cannot show which values EXIST. A row of chips is the filter and the legend at once.
    return groups.map((g) => {
        const options = [{ value: 'all', label: 'All' }, ...g.options];
        const current = filters[g.key] || 'all';
        return options.map((o) => html`
            <!-- ⚠️ A TOPIC FILTER IS NOT A STATE FILTER, and both used to render as the same neutral chip.
                 Lane and category ARE the topic vocabulary the whole console colours by — the Track's bars,
                 the row dots, the composer's chips — so a filter over them takes the topic chip and a filter
                 over state does not. The realm declares which it is; a shared component cannot guess. -->
            <button key=${g.key + ':' + o.value}
                    ${'' /* The design carries the pressed state on aria-pressed alone; the extra on class is the portal's and shows up as a different element to anything comparing the two. */}
                    aria-pressed=${o.value === current}
                    class=${'chip' + (g.topic && o.value !== 'all' ? ' topic' : '')}
                    style=${o.hex ? `--c:${o.hex}` : null}
                    title=${o.value === 'all' ? `All ${g.label.toLowerCase()}` : `Only ${o.label}`}
                    onClick=${() => onChange({ ...filters, [g.key]: o.value })}><!-- The design's topic chip carries the topic's own swatch; without it the chip is a word in a box and the colour vocabulary the whole console is built on stops at the table's edge. The COUNT is its own em, which is armory.html's renderCatChips markup — folded into the label string it is the same words in a wider box, and eight of them wrapped the toolbar so the primary action dropped to a row of its own. -->${g.topic && o.value !== 'all' ? html`<i></i>` : null}${o.label}${o.count == null ? null : html` <em>${o.count}</em>`}</button>`);
    });
}

// 🔴 THE SELECTION ACTIONS WERE 1,682px BELOW THE FOLD. They rendered at the FOOT of the table, so selecting row 1 of 39 at 1280×860 showed a checkmark and no consequence anywhere on screen — the affordance existed and was, for the reader, missing. Distance, not absence. Fixed to the viewport is the whole fix; `z-index:42` puts it above the sticky header and below the scrim, so opening a drawer covers it rather than letting a bar float over a modal.
//
// 🔴 THE REVERSIBILITY BADGE IS PER-REALM AND HAS NO DEFAULT, which is a correction the mockup made to itself: a shared bar defaulting to "reversible — undo stays in the tray" said that on ACCESS, whose permission edits do not go through the tray at all (portal/api/access.js writes them directly, by decision). A shared component may carry a default sentence; it may not carry one that is false on a realm that uses it. No badge is offered when a realm has not said which is true.
export function SelectionBar({ count, noun, summary, badge, tier, actions, onClear }) {
    const [on, setOn] = useState(false);
    // The bar starts translated off the bottom edge and slides up, which needs one frame between mount and the class — set in the same paint and the transition has nothing to animate from.
    useEffect(() => {
        const id = requestAnimationFrame(() => setOn(true));
        return () => cancelAnimationFrame(id);
    }, []);
    // `has-selbar` steps the tray up rather than letting the two objects share the bottom edge: the tray is a persistent status object, the bar a momentary action one.
    useEffect(() => {
        document.body.classList.add('has-selbar');
        return () => document.body.classList.remove('has-selbar');
    }, []);
    return html`
        <div class=${'selbar' + (on ? ' on' : '')} role="region" aria-label="Actions for the current selection">
            <div class="selbar-in">
                <span class="selbar-n">${count}</span>
                <div class="selbar-t">
                    <b>${count} ${count === 1 ? noun[0] : noun[1]}</b>
                    ${summary ? html`<span>${summary}</span>` : null}
                </div>
                ${badge ? html`<span class=${'selbar-rev ' + ((tier || 1) >= 3 ? 'gate' : 'ok')}>${badge}</span>` : null}
                <div class="selbar-a">
                    ${actions.map((a) => html`
                        <button class=${'pill sm' + (a.danger ? ' dang' : '')} key=${a.label}
                                onClick=${() => a.onClick()}>${a.label}</button>`)}
                </div>
                <button class="selbar-x" onClick=${onClear}>Clear</button>
            </div>
        </section>
    `;
}

// 🔴 THE CONFORMANCE REGISTER, AND EVERY ENTRY IS A DELIBERATE ADVANCE PAST THE DESIGN. Broadcast's mockup draws no checkbox column at all; the portal grew one because Broadcast gained bulk actions the design never specified. That is a real capability and it is NOT reverted — but in an overlay run it shifts every column of a four-column table by 40px, which reads as a page of differences rather than as one decision. Reading a dataset flag rather than a build define, so nothing about this can ship enabled: only a page that asks for conformance in its URL ever sets it, and the server never serves that page.


export function Manifest({ label = null, rows, columns, searchableFields, bulkActions = [], filterGroups = [], bulkNote, bulkTier, stateOf = (r) => r.state, onAdd, addLabel = '+ Add', realm, buildEditOp, csrfToken, onEditError, onRowClick, selectedRowId, title, headerRight, emptyText = 'Nothing here yet.', rowNoun = ['selected', 'selected'], onRemove, removeLabel = 'Remove' , searchLabel = '', searchPlaceholder = '', countSuffix = '', extraChips = null, defaultSort = null, footRow = null, selectable: selectableProp = null,
    // A realm that scopes something ELSE by the chips — Armory's export strip offers "this view" and "category" — needs to know what they are set to. Reported from the chip's own click rather than an effect, so there is no render loop to guard: the component still owns the state, the realm just gets told when it changes.
    onFiltersChange = null,
    // The inbound twin of onFiltersChange, for a realm whose OWN surface is a filter control -- Analytics' Alerts-by-level rows are buttons in the design that set the river to that level, and there was no way to drive these chips from outside. ⚠️ SHAPED SO IT CANNOT LOOP. The comment above records that reporting OUT was done from the click rather than an effect precisely to avoid a render loop, and an inbound effect reintroduces that hazard -- so this one is keyed on `seq` ALONE, a counter that only ever changes on a user action. The effect calls setFilters, the component re-renders, `seq` is unchanged, the effect does not run again. Keying it on the filters object instead would re-run on every render, which is the loop.
    filterSignal = null,
    // The size of the collection this table is a view OF, when the realm narrowed it before handing it over.
    totalRows = null,
    // 🔴 THE ROWS ARE A WINDOW AND EVERY NUMBER BESIDE THEM WAS NOT. Analytics' river is the newest 100 of each of three collections; `totalRows` is all of them, all time. So the count read "2 of 1,307" under a filter -- a numerator drawn from a population the denominator does not describe -- and at the cap it read "100 of 100", which is indistinguishable from "you are seeing everything" and is the precise lie `totalRows` was added to prevent. A realm that hands over a WINDOW says so, and the line states the window instead of implying its absence. A realm that hands over a WINDOW says so, and the line then states three separate quantities instead of implying they are one: how many you can see, how big the window is, and how big the collection is. Left null, nothing changes. ⚠️ AND IT ALWAYS SAYS IT, NOT ONLY AT THE CAP -- the first version triggered on `rows.length >= pageCap`, which is the same lie one state over: an eleven-row window out of 1,323 reads "11 of 1,323" and invites the reader to scroll for the rest. The shape it lands on, `N shown · newest M of T`, is the design's own ("12 shown · 1323 recorded").
    pageCap = null,
    // A line under the toolbar, which is where the design puts its own (armory.html's activeFilter sits in exactly this slot). A PROP rather than something a realm renders beside the Manifest, because any sibling element between the two panels breaks the .panel + .panel selector that gives the table its ground.
    caption = null}) {
    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState({});
    useEffect(() => { if (filterSignal && filterSignal.filters) setFilters(filterSignal.filters); }, [filterSignal && filterSignal.seq]);
    // The design's table opens sorted — its Window header carries `sorted-asc` — because a season read in entry order is a list and read in date order is a schedule. A realm names its own opening sort.
    const [sort, setSort] = useState({ column: defaultSort || null, direction: 'asc' });
    const [selected, setSelected] = useState(new Set());
    const [editingCell, setEditingCell] = useState(null); // {rowId, columnKey} | null
    const [editValue, setEditValue] = useState('');

    const visible = useMemo(
        () => sortRows(filterRows(rows, { query, searchableFields, filters }), sort,
            (columns.find((c) => c.key === sort.column) || {}).sortValue),
        [rows, query, filters, sort]
    );

    // One function for the select-all, because the click path and the key path must not be two implementations of one act — that divergence is what let the keyboard path be missing entirely. Added 2026-09-04 22:43 EDT.
    const allShown = () => visible.length > 0 && visible.every((r) => selected.has(r.id));
    const toggleAll = () => setSelected(allShown() ? new Set() : new Set(visible.map((r) => r.id)));

    async function commitEdit(row, columnKey) {
        const op = buildEditOp(row, columnKey, editValue);
        setEditingCell(null);
        // A realm may REFUSE an edit for a row its op vocabulary does not cover — Season refuses a publication. Without this the null went to stageAndCommit and the server saw [null].
        if (!op) { if (onEditError) onEditError('That row cannot be edited here.'); return; }
        const result = await stageAndCommit(realm, [op], csrfToken);
        if (!result.ok && onEditError) onEditError(result.reason || 'Edit failed.');
    }

    // ⚠️ THE SUMMARY NAMES THE ROWS; IT DOES NOT RESTATE THE COUNT. The bar's lead figure is already the count, so a second "3 selected" underneath it is the same fact twice — what a reader cannot get from the figure is WHICH three, which is exactly what they need before pressing something destructive.
    const selectionSummary = () => {
        const chosen = rows.filter((r) => selected.has(r.id));
        const named = chosen.slice(0, 3).map((r) => String(r[columns[0].key] ?? '')).filter(Boolean);
        if (!named.length) return '';
        return named.join(' · ') + (chosen.length > named.length ? ` · and ${chosen.length - named.length} more` : '');
    };

    // The state pill's own class comes from the row's state VALUE, so a realm that reports 'scheduled' or 'expired' gets the right shape without this component learning its vocabulary. Anything unrecognised falls to the conflict shape, which is the safe default: an unknown state should look like something to look at, never like a confirmed live row. The map moved out to module scope so StatePill (exported, below) and the default cell renderer share ONE copy.

    // Two ways a row can carry a colour, and both are legitimate. Season names a CSS TOKEN (row.topicVar -> '--draw'), because its four topic accents are design tokens the mockup fixes. Armory carries a raw HEX (row.accentHex), because its per-category hues are the BOT's own values arriving in the payload from getMpCategoryAccent -- reading them from data is what stops the portal's palette drifting from what Discord actually renders. Selection exists when the realm has something to do with it — and never in a conformance run for a realm whose design draws no checkbox. ⚠️ NOT gated on bulkActions: selection also drives export-of-selection and the row-preview, so a realm that declares no bulk verb still has a use for it. The ONLY thing that removes it is a conformance run against a design that draws no checkbox — narrowing it further silently dropped the row checkboxes from every realm and the a11y assertion caught it in one run. ⚠️ SELECTION IS A REALM'S OWN, NOT THE COMPONENT'S. Season's design draws a checkbox column and forty checkboxes; Broadcast's draws none — and forcing it on every realm cost Broadcast 38px of table width, which narrowed its widest column and wrapped a row, 18px on the page. Both earlier answers were the same mistake in opposite directions: one component deciding a thing that differs per design. Defaults to "selectable where bulk actions exist", which is what every realm but Broadcast wants, and Broadcast says otherwise.
    const selectable = selectableProp === null ? bulkActions.length > 0 : Boolean(selectableProp);

    const dotAccent = (row) => (row.accentHex ? `--topic-accent:${row.accentHex}` : `--topic-accent:var(${row.topicVar || '--ink3'})`);

    return html`
        <section class="panel" id="manifest">
            <!-- 🔴 THE label PROP NAMES THE TOOLBAR AND title ADDS A HEADER BAND ABOVE IT. They were one prop, so a realm
                 that wanted the toolbar named got a 33px band the design does not draw — the Manifest carried its
                 own name twice, once in a header strip and again in the toolbar directly beneath it. The design
                 has one: the word sits in the toolbar beside the search field. title is now opt-in for the
                 realms that genuinely need a header row above the tools. -->
            ${title ? html`<div class="ph"><span class="t">${title}</span>${headerRight ? html`<span class="rt">${headerRight}</span>` : null}</div>` : null}
            <div class="mtools">
                <!-- ⚠️ The chipset wrapper is display:contents, so it groups the chips for a screen reader and for the
                     markup without adding a box that would break the toolbar's own flex row. -->
                <!-- ⚠️ NO || title FALLBACK — removed 2026-09-04 22:06 EDT. The comment nine lines above records that these
                 two props were deliberately SPLIT so a realm can have a header band and a toolbar word; a fallback
                 from one to the other re-fuses them, and a realm passing title alone printed the identical
                 string twice, 45px apart, in two type treatments. Analytics was the only realm doing it, and it
                 had been on screen through every conformance gate. A prop that falls back to the prop it was
                 split from is not a default; it is the split undone. -->
            <span class="mlabel"><span>${label || 'Rows'}</span></span>
                <span class="srch">
                    <!-- app.css has styled the srch svg as a 14px magnifier at the field's left inset since the
                         sheet was adopted, and nothing ever rendered one: the input carried a 32px left padding
                         reserving space for an icon that did not exist. The icon comes FIRST, as the design
                         writes it — the label between icon and field desynchronised the whole toolbar. -->
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
                    <label class="sr" for="manifest-search">${searchLabel || `Search ${(rowNoun[1] || 'rows').toLowerCase()}`}</label>
                    <input id="manifest-search" value=${query} placeholder=${searchPlaceholder || 'Search…'} onInput=${(e) => setQuery(e.target.value)} /></span>
                ${filterGroups.length ? html`<span class="chipset" role="group" aria-label="Filters"><${FilterChips} groups=${filterGroups} filters=${filters}
                    onChange=${(f) => { setFilters(f); onFiltersChange?.(f); }} /></span>` : null}
                <!-- 🔴 A REALM'S OWN FILTER CHIP, AND SEASON'S LIVED SOMEWHERE ELSE. The design draws
                     "Staged only" here, beside the type chips, because it IS a filter over these rows;
                     the portal put it inside the staged-changes panel, which meant it disappeared with
                     that panel — so with nothing staged there was no way to learn the filter exists, and
                     with something staged the control sat 700px from the table it filters. -->
                ${extraChips || null}
                <!-- The add control sits BEFORE the count, which is the design's order and the useful one: the
                     count is a readout at the end of the row and the verb is a control among the other controls.
                     Measured 256px apart when they were the other way round. -->
                ${onAdd ? html`<button class="chip go" onClick=${onAdd}>${addLabel}</button>` : null}
                <!-- ⚠️ THE DENOMINATOR IS THE CATALOGUE, NOT THE ROWS HANDED IN. Armory pre-filters by armoury before
                     the Manifest ever sees a row, so dividing by the handed-in rows read "125 of 125" over a
                     133-build collection — a count that can never tell you something is being withheld. The design's
                     own count element divides by the whole set ("125 of 133"). Defaults to the handed-in rows, so a
                     realm that gives the Manifest everything is unchanged.
                     (No backticks in this comment: an EVEN number of them inside an html template closes and reopens
                      it, which parses as prose-turned-expressions — this exact comment did it twice.) -->
                <span class="rt">${pageCap != null
                    ? `${visible.length.toLocaleString()} shown · newest ${rows.length.toLocaleString()} of ${(totalRows == null ? rows.length : totalRows).toLocaleString()}`
                    : `${visible.length} of ${(totalRows == null ? rows.length : totalRows).toLocaleString()}`}${countSuffix || ''}${selected.size ? ` · ${selected.size} selected` : ''}</span>
            </div>
            ${caption ? html`<p class="hint">${caption}</p>` : null}
            <div class="mscroll">
            <table class="mtable">
                <!-- 🔴 table-layout:fixed NEEDS A COLGROUP OR EVERY COLUMN IS EQUAL. A realm supplies its
                     own columns, so the widths are derived from each column's ROLE rather than listed:
                     the first column is the identity one by this component's own contract (it is where
                     the topic dot goes), a date is a window, a state is a pill, everything else is
                     detail. The alternative — one width list per realm — is five copies of a decision
                     that would drift the first time a realm added a column. -->
                <colgroup>
                    ${selectable ? html`<col class="c-cb" />` : null}
                    ${columns.map((c, i) => html`<col key=${c.key}
                        class=${c.col || (i === 0 ? 'c-item' : c.key === 'state' ? 'c-state' : c.dataKind === 'date' ? 'c-win' : 'c-detail')} />`)}
                    <!-- The remove column takes its width from the .mtable th.ra rule, which the adopted sheet already sets; a col class of its own would be a second authority over one number. (No backticks in this comment: it lives inside a template literal, and the build's parse gate caught the sixth occurrence of that within seconds of writing it.) -->
                    ${onRemove ? html`<col class="c-ra" />` : null}
                </colgroup>
                <thead><tr>
                    ${selectable ? html`<th><!-- The design's header carries a select-all in the same control the rows use, so
                        the column has a purpose at its top rather than an empty cell.
                        KEYBOARD PARITY ADDED 2026-09-04 22:43 EDT. It was role=checkbox with tabindex=0 and a click handler
                        only, so Tab reached it and neither Enter nor Space did anything — while the PER-ROW
                        checkbox fifty lines below has had the handler all along, under a comment explaining that a
                        real checkbox gives it for free and this has to earn it. Two siblings disagreeing is exactly
                        what a per-element gate cannot see. -->
                        <span class=${'cb' + (visible.length && visible.every((r) => selected.has(r.id)) ? ' on' : '')}
                              role="checkbox" tabindex="0" aria-label="Select every row shown"
                              aria-checked=${visible.length && visible.every((r) => selected.has(r.id)) ? 'true' : 'false'}
                              onClick=${toggleAll}
                              onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAll(); } }}></span></th>` : null}
                    <!-- 🔴 A <th> WITH AN onClick IS NOT A CONTROL. Sorting was bound to the header cell
                         itself, which no keyboard can reach and no screen reader announces as actionable
                         — the whole table could be sorted with a mouse and not at all without one. The
                         button carries the handler and aria-sort states the current direction, which
                         is the part a caret alone cannot say. -->
                    ${columns.map((c, i) => html`
                        <!-- Three of the design's headers are plain: a spark, a free-text detail and a
                             state pill have no order a reader would ask for, and a button that sorts
                             nothing useful is a control that has to be tried before it can be dismissed. -->
                        <th key=${c.key} class=${(c.sortable === false ? '' : 'sortable') + (c.dataKind === 'right' ? ' ta-r' : '') + (sort.column === c.key ? (sort.direction === 'asc' ? ' sorted-asc' : ' sorted-desc') : '')
                                + (i > 0 && (c.dropSm || c.dataKind === 'date' || c.dataKind === 'code') ? ' drop-sm' : '')}
                            aria-sort=${sort.column === c.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                            ${c.sortable === false ? html`${c.label}` : html`
                            <button type="button" class="sortbtn"
                                    onClick=${() => setSort({ column: c.key, direction: sort.column === c.key && sort.direction === 'asc' ? 'desc' : 'asc' })}>
                                ${c.label}
                            </button>`}
                        </th>`)}
                    ${onRemove ? html`<th class="ra"><span class="sr">${removeLabel}</span></th>` : null}
                </tr></thead>
                <tbody>
                    ${visible.map(row => html`
                        <tr class=${selected.has(row.id) ? 'sel' : ''}
                            ${''/* 🔴 `preview-sel` WAS EMITTED HERE AND PAINTED BY NOTHING, ON EITHER SIDE. It marked the row whose preview drawer is open, and no rule in `app.css` or in the package's own sheet ever matched it — so the one row the reader most needs located looked exactly like its neighbours. Removed rather than styled: §0.6a says the portal renders the MOCKUP'S version until every realm matches, and the mockup marks nothing here. ⚠️ The state is real and the design's silence about it is a WEAKNESS — filed, not fixed, because inventing a mark mid-pass is the thing §0.6a exists to stop.
                                 ⚠️ AND IT CANNOT BE AN HTML COMMENT: this sits inside a tag's PROP LIST, where htm swallows every prop after an `<!-- -->`. The first version of this note did exactly that and would have killed `tabIndex`, `onKeyDown` and `onClick` on every manifest row on every realm. The `${''\/* *\/}` form two lines down is the file's own idiom for the same reason. */}
                            ${''/* 🔴 A CLICKABLE ROW WITH NO ROLE AND NO TABINDEX IS MOUSE-ONLY, ON EVERY REALM THAT PASSES onRowClick. The design caught this on its own event tables and says so in analytics.html:540: "THESE ROWS OPEN A DRAWER AND NOTHING INSIDE THEM COULD TAKE FOCUS -- mouse-only... Season's and Armory's rows escaped the same fault only because they happen to contain a rename input; these hold plain text, so the row itself is the control and has to say so. Enter and Space, because a role=button must answer both." That reasoning is about the SHARED component, not about one realm: Armory's rows have been reachable only by accident, through an input that happens to sit inside them. The attributes appear only when there is something to activate, so a table with no row action does not grow a focus stop that does nothing. */}
                            ${''/* 🔴 NO `role` ON A REAL TABLE ROW, AND THE KEY HANDLER MUST IGNORE ITS OWN CONTENTS. The first version of this copied `analytics.html:540` wholesale, and that note is about the design's DIV-based event table. This is a real `<table>`: `role="button"` on a `<tr>` replaces its implicit `row` role and orphans every `<td>`, whose required parent is a row. `tabIndex` + `onKeyDown` gives the same keyboard reach with no ARIA damage.
                                 🔴 AND THE GUARD IS NOT COSMETIC -- IT WAS BREAKING A SHIPPED REALM. Armory passes `onRowClick` (armory.js:1245) and declares `weaponName`/`buildName` editable, so its rows contain `<input class="edit">`. The `<td>` stops `onClick` and NOT `onKeyDown`, so this handler's `preventDefault()` on Space swallowed the space bar inside every Armory rename field -- on names that contain spaces on essentially every row -- and Enter both committed the edit and re-opened the row editor behind it. The checkbox cell got this right at :240 and the row handler did not. */}
                            tabIndex=${onRowClick ? 0 : null}
                            onKeyDown=${onRowClick ? ((e) => {
                                if (e.target !== e.currentTarget) return;
                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); }
                            }) : null}
                            onClick=${onRowClick ? () => onRowClick(row) : null} style=${onRowClick ? 'cursor:pointer' : ''}>
                            <!-- 🔴 THE ONLY BROWSER-DEFAULT CONTROL LEFT IN THE PORTAL, on the row of every table.
                                 The adopted sheet has drawn a checkbox since it was adopted — a 16px sunk square that
                                 fills with the accent and strokes a tick — and the Manifest rendered a UA checkbox
                                 beside it, so a design that reset every other control to its own vocabulary had a
                                 native blue tick on 39 rows. The input is still the input: it is visually hidden
                                 rather than replaced, so it keeps its focus, its keyboard behaviour and its label. -->
                            ${selectable ? html`<td onClick=${(e) => e.stopPropagation()}>
                                <!-- ⚠️ THE DESIGN'S CONTROL IS A span[role=checkbox], NOT A HIDDEN INPUT.
                                     A visually-hidden real input inside a label is a legitimate pattern and it
                                     is not this one: the cb and cb-on rules are what the adopted stylesheet draws,
                                     the label's own text lands in the row's textContent, and the two markups
                                     measure differently on every one of thirty-nine rows. Keyboard parity is
                                     kept explicitly — Space and Enter both toggle, which is what a real
                                     checkbox gives for free and what this has to earn. -->
                                <span class=${'cb' + (selected.has(row.id) ? ' on' : '')} role="checkbox"
                                      aria-checked=${selected.has(row.id) ? 'true' : 'false'} tabindex="0"
                                      aria-label=${`Select ${row[columns[0].key]}`}
                                      onClick=${(e) => { e.stopPropagation(); setSelected(toggleSelection(selected, row.id)); }}
                                      onKeyDown=${(e) => {
                                          if (e.key !== ' ' && e.key !== 'Enter') return;
                                          e.preventDefault(); e.stopPropagation();
                                          setSelected(toggleSelection(selected, row.id));
                                      }}></span>
                            </td>` : null}
                            ${columns.map((c, ci) => {
                                const isEditing = editingCell && editingCell.rowId === row.id && editingCell.columnKey === c.key;
                                if (isEditing) {
                                    return html`<td key=${c.key} onClick=${(e) => e.stopPropagation()}>
                                        <label class="sr" for=${`edit-${row.id}-${c.key}`}>Edit ${c.label}</label>
                                        <input class="edit" id=${`edit-${row.id}-${c.key}`} value=${editValue} autoFocus
                                               onInput=${(e) => setEditValue(e.target.value)}
                                               onKeyDown=${(e) => { if (e.key === 'Enter') commitEdit(row, c.key); if (e.key === 'Escape') setEditingCell(null); }}
                                               onBlur=${() => setEditingCell(null)} />
                                    </td>`;
                                }
                                const body = c.render ? c.render(row) : (c.key === 'state'
                                    ? html`<${StatePill} state=${stateOf(row)} />`
                                    : row[c.key]);
                                // 🔴 THE TABLE HAD ONE CELL KIND AND THE STYLESHEET STYLES FIVE. Every column rendered as plain text or a date, so a row could say WHAT a thing is and never what is IN it — the detail column, the tier chips, the right-aligned status column and the secondary line under a name were all styled, all unused, and invisible to an orphan check because a rule existed for each. `dataKind` names the cell; the realm supplies what goes in it.
                                //
                                // ⚠️ `detail` MUST stay a table-cell. The mockup's own comment records the fix: `display:block` on the td broke row layout thirty-nine times, once per row, and only the inner box needs the ellipsis. That is why `.det` carries `min-width:0` and the truncation lives on `.detcell`/`.dsub`.
                                const kind = ci === 0 ? 'n'
                                    // 🔴 `code` IS ITS OWN KIND. Armory's Gunsmith-code column was declared `date` purely to inherit `drop-sm`, so the cell rendered `.d` — the DATE cell, in the mono data face — where armory.html writes `td.code.drop-sm`. Visible where it matters least and reads worst: the "DMZ — no code" placeholder came out in JetBrains Mono against the design's Space Grotesk. Borrowing a kind for its side effect is how a cell ends up lying about what it holds.
                                    : c.dataKind === 'code' ? 'code drop-sm'
                                    : c.dataKind === 'date' ? 'd drop-sm'
                                    : c.dataKind === 'detail' ? 'det'
                                    : c.dataKind === 'right' ? 'ta-r'
                                    // 🔴 `dropSm` COMPOSES, IT IS NOT A KIND. It used to sit above the kinds as its own branch, so `nums` + `dropSm` was unreachable and a realm wanting the design's `td.nums.drop-sm` had to declare `date` and inherit the wrong ink. A column's CELL KIND and whether it drops at narrow widths are two independent decisions.
                                    : ((c.dataKind === 'nums' ? 'nums' : '') + (c.dropSm ? ' drop-sm' : '')).trim();
                                return html`
                                    <td key=${c.key} class=${kind}
                                        onClick=${c.editable ? (e) => { e.stopPropagation(); setEditingCell({ rowId: row.id, columnKey: c.key }); setEditValue(String(row[c.key] ?? '')); } : null}
                                        style=${c.editable ? 'cursor:text' : ''}>
                                        ${ci === 0
                                            ? html`<span class="ncell">
                                                <!-- The swatch is a FLEX SIBLING of the text, never inside it. A realm may
                                                     replace the topic dot with its own mark (Broadcast draws a severity mark), and the first attempt let the column render that mark inside
                                                     the text span — which took it out of the flex row, gave the title 17px
                                                     more room, and stopped two of four titles wrapping where the design
                                                     wraps them. Where the swatch SITS is part of the column's width. -->
                                                <span class=${c.dotClass ? c.dotClass(row) : 'dot'}
                                                      style=${c.dotClass ? (c.dotStyle ? c.dotStyle(row) : null) : dotAccent(row)}></span>
                                                <!-- 🔴 THE DESIGN'S NAME COLUMN IS A LIVE INPUT ON EVERY ROW, and this rendered
                                                     text you had to click first. Renaming is the single most common edit in this
                                                     table, and a click-to-reveal field cannot be tabbed to, cannot be scanned as
                                                     editable, and gives no hint it exists — measured, it also made every row 17px
                                                     shorter than the design's, which is 39 rows of accumulated difference. The
                                                     click handler on the cell stays: it still selects the cell for the keyboard path. -->
                                                <!-- ⚠️ THE INPUT IS A DIRECT CHILD OF .ncell, not wrapped. the ncell's own edit rule
                                                     sizes a FLEX CHILD, and wrapping it in a span made the span the flex child and left the input
                                                     at its own intrinsic width — 175px against the design's 310, on every row of the table. A
                                                     column that carries a meta line still needs the wrapper, so both shapes exist. -->
                                                ${c.liveEdit && !isEditing && !c.meta
                                                    ? html`<input class="edit" value=${String(row[c.key] ?? '')} aria-label=${`Rename ${row[c.key] ?? ''}`}
                                                                  onClick=${(e) => e.stopPropagation()}
                                                                  onChange=${(e) => { setEditingCell({ rowId: row.id, columnKey: c.key }); setEditValue(e.target.value); }} />`
                                                    : html`<span>${c.liveEdit && !isEditing
                                                        ? html`<input class="edit" value=${String(row[c.key] ?? '')} aria-label=${`Rename ${row[c.key] ?? ''}`}
                                                                      onClick=${(e) => e.stopPropagation()}
                                                                      onChange=${(e) => { setEditingCell({ rowId: row.id, columnKey: c.key }); setEditValue(e.target.value); }} />`
                                                        : body}${c.meta ? html`<span class=${'rowmeta' + (c.metaClass ? ' ' + c.metaClass : '')}>${c.meta(row)}</span>` : null}</span>`}</span>`
                                            : html`${body}${c.meta ? html`<div class=${'rowmeta' + (c.metaClass ? ' ' + c.metaClass : '')}>${c.meta(row)}</div>` : null}`}
                                    </td>
                                `;
                            })}
                            <!-- 🔴 ITS OWN COLUMN WITH A HEADER, NEVER A HOVER REVEAL. A reveal does not
                                 exist on touch and cannot be scanned, and a "…" menu buries the verb
                                 behind a click for nothing. It is --ink3 at rest so it is findable, and
                                 takes the destructive colour only on hover and focus. -->
                            ${onRemove ? html`
                                <td class="ra" onClick=${(e) => e.stopPropagation()}>
                                    <button class="rmv" data-tip=${removeLabel} aria-label=${`${removeLabel} ${row[columns[0].key]}`}
                                            onClick=${() => onRemove(row)}>
                                        <!-- The design draws this one inline rather than through the sprite, and the
                                             shapes are not the same glyph: its lid-and-body path is 15px wide against
                                             the sprite's 11.5, on thirty-nine rows. The icon set is right everywhere
                                             else; this control is the design's own. -->
                                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg></button>
                                </td>` : null}
                        </tr>
                    `)}
                </tbody>
            </table>
            </div>
            ${''/* ⚠️ A NO-MATCH STATE THAT NAMES NEITHER THE ACTION NOR THE TOTAL. It read "No rows match this search or filter." on every realm -- true, and it leaves the reader to work out that a filter is still set somewhere above and that the collection is not empty. The UX-copy audit calls this out (E2) and names the design's own template: `season.html:2431` says "Nothing matches that. Clear the search or a filter -- N alerts, N changes and N deploys are recorded in total." The rewrite keeps that shape generically: what to do, then how much is behind the filter, using the realm's own row noun. ⚠️ The two states stay DISTINCT -- an empty collection is not a filtered-out one, and collapsing them tells a reader with no data that their search is wrong. */}
            ${''/* ⚠️ AND IT DIVIDES BY THE SAME TOTAL THE HEADER USES, or the panel contradicts itself. This branch's first version divided by `rows` while the count line at :169 divides by `totalRows`, so a filtered-to-nothing Analytics read "0 of 1,307 events" at the top and "100 events in total" in the body -- and the body's whole job is to say how much sits behind the filter. */}
            ${visible.length === 0 ? html`<p class="empty">${rows.length
                ? html`<b>Nothing matches that.</b> Clear the search or a filter — ${pageCap != null && rows.length >= pageCap ? html`the newest ${rows.length.toLocaleString()} of ` : null}${(totalRows == null ? rows.length : totalRows).toLocaleString()}${' '}
                    ${(totalRows == null ? rows.length : totalRows) === 1 ? rowNoun[0] : rowNoun[1]} in total.`
                : emptyText}</p>` : null}
            <!-- The foot row: a realm's own quick-add strip, under the table it adds to. The design puts
                 one here on Season — a name, a type, two dates and a button — as the fast path beside the
                 composer above, and the portal had only the composer. -->
            ${footRow || null}
            ${selected.size && bulkActions.length ? html`
                <${SelectionBar} count=${selected.size} noun=${rowNoun} tier=${bulkTier}
                                 badge=${bulkNote} summary=${selectionSummary()}
                                 onClear=${() => setSelected(new Set())}
                                 actions=${bulkActions.map((a) => ({ label: a.label, danger: a.danger, onClick: () => a.onClick([...selected]) }))} />` : null}
        </div>
    `;
}
