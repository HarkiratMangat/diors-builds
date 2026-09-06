// portal/ui/analytics.js — ESM. The Analytics realm: Health/Usage/Timing over one filterable event river as the Manifest, with revert as its one action.
//
// 🔴 THIS WAS THE LARGEST MOCKUP-VS-LIVE GAP IN THE PORTAL, and it was never a styling gap. The tab shipped as three <pre> blocks holding the raw /bot analytics TEXT exports — the Discord command's own output pasted into a web page. 06-access-and-analytics.html specs a dashboard: a Health/Usage/ Timing switcher, KPI tiles with sparklines, and a filterable event river with kind and source chips. Session A's Phase 1 addendum named the difference correctly: "a missing-dashboard-FEATURE gap, not a missing-style gap — the two are different programs, not one under-styled version of the other." Built at Harkirat's call, 2026-08-23 15:00 EDT.
//
// The river needed NO API change at all: /api/analytics has always returned it as structured JSON and this component was throwing the structure away into a <pre>. Only the tiles needed new data.
import { h } from '../vendor/preact.mjs';
import { html } from '../vendor/htm-preact.mjs';
import { useState, useEffect } from '../vendor/preact-hooks.mjs';
import { Icon } from './icons.js';
import { Shell, NoAccess, Masthead } from './shell.js';
import { Manifest } from './manifest.js';
import { fetchJson } from './httpClient.js';
import { useAsync, RealmShell, reportFailure } from './async.js';
import { useOverlay, Drawer } from './overlay.js';

// ⚠️ NEITHER SIDE'S WORD FOR THE THIRD KIND WAS RIGHT, so this is a deliberate third choice rather than a port. The design says "Deploy" (analytics.html:521) and the fixtures it ships contain rows reading "automatic/unattended restart" — an unattended crash-recovery is not a deploy, so the design's word is factually wrong about its own data. The portal said "BOOT", which is accurate and is exactly the dialect Harkirat ruled against eight lines below this ("literally no clue what p50, p95 even mean… they look like jargon"). RESTART is the one word that is both true of every row and plain. summaryOf() already writes "restarted — …" in the What column, so the chip and the sentence now agree.
const KIND_LABEL = { change: 'CHANGE', alert: 'ALERT', boot: 'RESTART' };

// 🔴 NO "p50", "p95" OR "HEADROOM" REACHES A READER ON THIS PAGE, AND THAT IS A RULING, NOT A STYLE PREFERENCE. Harkirat, on the version of the Discord panel that shipped an hour before he read it: "literally no clue what p50, p95, 99% headroom even mean. they look like jargon to me. not intuitive." He is the only person who will ever open this screen, so a page fluent in a dialect its sole reader does not speak is a broken page. commands/bot.js already carries the translations and the portal inherits them rather than inventing a second set: the median becomes "usually", and the 95th percentile becomes "slowest 1 in 20" — which is NOT the worst case, a simplification that is tempting and false.
const USUALLY = 'usually';
const SLOWEST = 'slowest 1 in 20';

// The prose sits here and the ENUM does not: outcomeKeys/entryKeys arrive in the payload from models/AnalyticsRollup, because the Outcomes panel's whole reading is which outcomes have never once occurred, and a list retyped in a browser file is how the schema's own copy went stale. Labels are a UI concern; the set of things that can happen is not.
const OUTCOME_LABEL = { ok: 'OK', error: 'Error', expired: 'Expired', blocked_by_policy: 'Blocked by policy',
    swallowed_by_cooldown: 'Swallowed by cooldown', rejected_admin: 'Rejected — not admin' };
const ENTRY_LABEL = { slash: 'Slash command', button: 'Button', select: 'Select menu', autocomplete: 'Autocomplete',
    modal: 'Modal submit', synthetic: 'Synthetic', background: 'Background job' };

// Discord's own deadline, not a target invented here. The last bucket edge and the overflow key are the same number on purpose, so the overflow bucket means exactly one thing.
const ACK_LIMIT_MS = 3000;
const ACK_BUCKETS = [0, 100, 250, 500, 1000, 2000, 3000];
const ACK_BUCKET_LABEL = { 0: 'under 100ms', 100: '100–250ms', 250: '250–500ms', 500: '500ms–1s',
    1000: '1–2s', 2000: '2–3s', 3000: 'over 3s — MISSED' };

// 🔴 TEN SECONDS, NOT THREE, AND THE GAP IS DELIBERATE. commands/bot.js records what happened when total duration was measured against the 3,000ms ack deadline: it shipped "/colors -204% headroom" for an image command working exactly as designed, i.e. the page asserted a production fault that did not exist. The deadline is the clock for ACKNOWLEDGING an interaction; once deferred, the window is fifteen minutes. So the marker on a duration bar stays (it is real context for how long the work runs next to how long the answer is owed) and the fault COLOUR is driven from somewhere else entirely — Nielsen's published ~10s "limit of held attention", the same band commands/bot.js already calls a long wait. If the two coincided, a reader would read "past the marker" as "broken", which is the false claim all over again.
const LONG_WAIT_MS = 10000;

const pct = (n, d) => (d ? (n / d) * 100 : 0);
// ⚠️ A SUB-MILLISECOND FIGURE ROUNDED TO "0ms", WHICH READS AS BROKEN RATHER THAN AS FAST. The dependency rows divide a total by a call count, so Atlas at 52ms across 437 calls printed "0ms each" — a real measurement rendered as the absence of one. Zero itself still prints 0ms; only a value that exists and is under half a millisecond becomes the bound.
const fmtMs = (ms) => (ms == null || Number.isNaN(ms) ? '—'
    : ms < 0 ? '—'
    : ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`
    : ms > 0 && Math.round(ms) === 0 ? '<1ms'
    : `${Math.round(ms)}ms`);

// Where the event came from, which is the column that makes "one history, two front doors" true rather than asserted: a ChangeLog row written by the portal and one written by /manage are the same kind of thing from different surfaces, and you can only see that if the surface is a column.
function sourceOf(row) {
    if (row.kind !== 'change') return '—';
    return (row.source || row.via || '').toLowerCase() === 'portal' ? 'PORTAL' : 'DISCORD';
}

function summaryOf(row) {
    if (row.kind === 'alert') return row.title || 'Alert';
    if (row.kind === 'boot') return `restarted — ${row.kind_ || row.bootKind || row.version || 'boot'}`;
    return row.summary || row.target || row.action || 'Change';
}

// ⚠️ DECLARED ABOVE `RIVER_COLUMNS`, WHICH READS `LEVEL_TAG`, AND THAT ORDER IS LOAD-BEARING. These sat BELOW it until 2026-09-02 10:52 EDT, on my own reasoning that a render closure always runs after module evaluation — true at runtime, and `npm run tdz` flagged it anyway, correctly. The ratchet exists to stop the PATTERN spreading rather than to adjudicate whether one instance happens to be reachable, and a temporal dead zone throws at EVALUATION where `node --check` cannot see it. ⚠️ The comment I had written arguing it was safe is the exact shape this branch spent the day finding: a rule stated confidently one line above the code that breaks it. 🔴 REBUILT ON THE ADOPTED DESIGN, AND THE OLD MARKUP HAD NO STYLING AT ALL. `.kpi`, `.kpis`, `.srcline` and `.metrics` were defined in a portal-authored stylesheet that adopting the mockup's app.css deleted, so the whole Health view had been rendering with no rules — four bare stacks of text where the design specifies a tile grid, a split panel and a banner. Nothing errored and every gate passed; `npm run portal:orphans` is the check that can see it. ⚠️ THE CLASSES ARE LITERALS, NOT CONCATENATED. `'lvlb lv-' + a.level` emits a class portal:orphans can only see as `lv-`, so it reports an orphan and -- worse -- a level the stylesheet has no rule for would render unstyled with nothing complaining. A table makes every emitted class visible to the gate and makes an unknown level fall back to a real one. 🔴 `caution` WAS MISSING AND IT IS 30.6% OF THE DATA. Measured against the dev database 2026-09-01 21:34 EDT: info 678 · caution 306 · error 16 · warn ZERO, out of 1,000 AlertLog rows. This table carried a key for `warn` (which never occurs) and none for `caution` (the second-largest tier), so `LEVEL_ROW[a.level] || LEVEL_ROW.info` painted 306 alerts as the grey no-severity tier — directly beneath a paragraph this file writes naming three tiers. Both stylesheets already define `.lvlb.lv-caution` and `.lvtag.lv-caution`; the rule was never dead, the emitter was. utils/alertWebhook.js is the writer and treats all four as first-class (LEVEL_COLOR/LEVEL_ICON at :22-23), with `warn` and `error` pinging by default and `info` and `caution` staying quiet (:61) — so `caution` is a tier with its own interrupt semantics, NOT a display alias for `warn`, which is what the old code assumed.
const LEVEL_ROW = { error: 'lvlb lv-error', warn: 'lvlb lv-warn', caution: 'lvlb lv-caution', info: 'lvlb lv-info' };

// The river's inline tag, same literal rule, read by `RIVER_COLUMNS` BELOW. ⚠️ This said "above" until 2026-09-02 11:18 EDT and carried the argument that came with it — "a module-scope const, so the closure that reads it always runs after this line" — which was the exact reasoning `npm run tdz` refuted when it flagged the read as a temporal dead zone. The block moved to fix that and its comment described the old position for two commits: moved text keeps asserting what was true where it used to be. ⚠️ `warn` shares the ERROR tag on purpose: neither stylesheet defines `.lvtag.lv-warn`, and the property that separates the loud tag from the quiet one is whether a human gets pinged, which alertWebhook:61 gives `warn` and `error` alike. The tag's text is the level's own name, so nothing is hidden by the shared colour. `info` carries `lv-info` even though neither sheet styles it: the design emits the modifier (`span.lv-info.lvtag`, five of them) and an element signature is what the overlay pairs on, so a bare class reads as a different element for no gain.
const LEVEL_TAG = { error: 'lvtag lv-error', warn: 'lvtag lv-error', caution: 'lvtag lv-caution', info: 'lvtag lv-info' };

const RIVER_COLUMNS = [
    { key: 'at', label: 'When', dataKind: 'date', render: (r) => new Date(r.at).toISOString().slice(5, 16).replace('T', ' ') },
    { key: 'kind', label: 'Kind', col: 'c-type', render: (r) => html`<span class=${'rivk ' + r.kind}>${KIND_LABEL[r.kind] || r.kind}</span>` },
    // ⚠️ The source is PLAIN TEXT in a monospaced column. It used to carry a `.src` chip class with no rule behind it, and a chip here would compete with the kind chip beside it for the same reading — one of the two has to be quieter, and the kind is the one that classifies.
    { key: 'source', label: 'Source', render: (r) => sourceOf(r) },
    // 🔴 THE LEVEL WAS A FILTER AND NEVER A MARK. An error and a routine change read identically down the column, so the one thing you scan a log for — which rows are bad — needed the filter to be touched first. The dot carries severity, the tag names it, and both are absent on rows that have no level rather than defaulting to a reassuring one.
    { key: 'summary', label: 'What', render: (r) => {
        const sev = r.level === 'error' ? 'err' : r.level === 'caution' ? 'warn' : r.level ? 'info' : '';
        // ⚠️ THE ${' '} BEFORE THE TAG, for the same reason the tiles needed theirs: htm drops the whitespace across the newline, so the cell read "Bot onlineinfo" — and now that the row is focusable, that string is part of its accessible name.
        return html`<span class="sev ${sev}"></span>${summaryOf(r)}${' '}${r.kind === 'alert' && r.level
            ? html`<span class=${LEVEL_TAG[r.level] || 'lvtag'}>${r.level}</span>` : null}`;
    } },
    { key: 'actor', label: 'Who', render: (r) => (r.actorId ? String(r.actorId).slice(-6) : html`<span class="none">system</span>`) },
];

const RIVER_FILTERS = [
    { key: 'kind', label: 'Kind', options: [
        { value: 'change', label: 'changes' }, { value: 'alert', label: 'alerts' }, { value: 'boot', label: 'restarts' },
    ] },
    // 🔴 THIS FILTER IS WHERE THE DELETED ALERT EXPORT WENT. The Alerts pre block held the level and the describe() detail of every alert, and the river was already fetching whole AlertLog documents and throwing both away. Deleting a redundant layer is right; deleting the facts it carried is not — so level becomes a filter and detail becomes searchable, which is strictly more useful than the prose block was, because both compose with the kind filter and the search box.
    { key: 'level', label: 'Level', options: [
        // ⚠️ THE LEVEL'S OWN NAME, not a pluralisation, because this group carried TWO vocabularies: "errors" and "warnings" plural beside "caution" and "info" singular, inside one chip that cycles between them. The panel above writes the bare words (info is a record, caution is a look-when-convenient, error pings a human) and the design builds its own chips from the level values, so agreeing with the sentence above is what makes the chip readable.
        { value: 'error', label: 'error' }, { value: 'warn', label: 'warn' },
        { value: 'caution', label: 'caution' }, { value: 'info', label: 'info' },
    ] },
];

// 🔴 `.spark` EXISTS IN THE ADOPTED STYLESHEET AND MEANS SOMETHING ELSE ENTIRELY. The old component emitted `<i style="height:N%">` for a vertical bar chart; app.css's `.spark` is a 6px horizontal progress track whose children are absolutely positioned by `left`/`width`, so every bar collapsed and the chart rendered as a flat line. Nothing errored, the class WAS defined, and `portal:orphans` cannot see this — its question is whether a class exists, not whether it means what the emitter thought.
//
// The honest fix is not a third bar chart: `.lvlbars` is the adopted design's own labelled series, and it is better than the sparkline it replaces because seven anonymous bars become seven NAMED days. A reader could not previously tell which end was today. UTC, because every other date the portal prints is the UTC calendar day the bot stores — a local-midnight rollover here would label the same bar differently depending on where it is read.
const dayAgo = (ago) => new Date(Date.now() - ago * 86400000)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function DailyBars({ series = [], label }) {
    if (!series.length) return null;
    const max = Math.max(1, ...series);
    // Newest first, because the question is almost always "what is happening now" and a series read left-to-right made today the LAST thing you reached.
    const rows = series.map((n, i) => ({ n, ago: series.length - 1 - i })).reverse();
    return html`
        <h5>${label}</h5>
        <div class="lvlbars">
            ${rows.map((r) => html`
                <div class="lvlb" key=${r.ago}>
                    <span class="ln">${r.ago === 0 ? 'today' : `−${r.ago}d`}</span>
                    <span class="lt"><i style=${`width:${Math.round((r.n / max) * 100)}%`}></i></span>
                    <span class="lv2">${r.n}</span>
                    <!-- 🔴 "−3d" IS A DISTANCE, NOT A DAY. Every other date in this console is a real one, and a
                         reader comparing a spike here against a deploy in the river below had to count backwards
                         from today to line them up. The adopted sheet already reserves a second grid row on this
                         component for exactly this kind of sub-line. -->
                    <span class="lp">${dayAgo(r.ago)}</span>
                </div>`)}
        </div>
    `;
}

// A tile is the adopted design's KPI: a label, a figure with its unit set smaller inside it, and one line of context.
//
// 🔴 THE TONE IS A THRESHOLD, NOT "IS THIS NON-ZERO". The mockup's own note records why: `errors ? 'warn' : 'ok'` painted a 99.0% success rate in alarm orange because five events out of 496 failed — and in production there is always at least one, so the tile would have been orange forever. A colour that is on regardless stops carrying information. Green is reserved for a figure with NOTHING against it; everything else is neutral until it is actually a problem. ⚠️ A BUTTON ONLY WHEN IT DOES SOMETHING, WHICH IS THE DESIGN'S OWN RULE AND NOT A BLANKET CONVERSION. analytics.html:147 draws the four HEALTH tiles as `<button data-tile>` wired to jump to Timing, and its Timing and Search tiles (`:290`, `:462`) as plain divs -- so the tag IS the affordance, and converting Tile globally would promise a click on eight tiles that answer four. The overlay saw this as `button.tile` mockup-only against `div.tile` portal-only, and nothing else could: a div and a button with the same class are the same pixels until you try to press one.
function Tile({ label, value, unit, sub, tone, onClick = null }) {
    const cls = 'tile' + (tone ? ' ' + tone : '');
    // 🔴 THE ${' '} SEAMS ARE WHY A BUTTON NEEDS THEM AND A DIV DID NOT. A button takes its accessible name FROM ITS CONTENTS, and htm drops the whitespace-only node across a newline -- so the moment these became buttons they began announcing "Restarts 7d3030 in the last 24 hours" and "RAM at last alert174MBhighest of 5 samples in 7d". As divs they had no accessible name at all, so making them reachable is what created the defect. ⚠️ `portal:audit --triggers` printed the fused strings hours before `portal:states` failed on them, and I read past it.
    const body = html`
            <span class="tl-k">${label}</span>${' '}
            <span class="tl-v">${value}${unit ? html`<i>${unit}</i>` : null}</span>${' '}
            ${sub ? html`<span class="tl-s">${sub}</span>` : null}`;
    if (onClick) return html`<button class=${cls} onClick=${onClick}>${body}</button>`;
    return html`
        <div class=${cls}>
            <span class="tl-k">${label}</span>
            <span class="tl-v">${value}${unit ? html`<i>${unit}</i>` : null}</span>
            ${sub ? html`<span class="tl-s">${sub}</span>` : null}
        </div>
    `;
}

// ⚠️ THE MASTHEAD HAS THREE STATS AND NOT THE DESIGN'S FOUR, AND THAT IS A DECISION. Harkirat, 2026-09-02 10:43 EDT: the `include admin traffic` toggle governs the VIEW only. A `worst ack` stat read `timingStats`, which takes `includeAdmin`, while `uptime`, `errors 24h` and `commands 24h` read `healthStats()`, which takes no arguments -- so flipping the toggle moved one figure and froze three, and this branch had just moved the toggle out of the masthead into the panel header, further from the stats it silently governed. Uptime and errors are facts about the PROCESS; filtering them by admin traffic is not a meaningful operation. So the odd one out was the per-interaction stat sitting among bot-wide ones, and it is gone rather than made to lie quietly. 🔵 The ack figures are not lost: Timing draws the full bucket distribution, where the toggle legitimately applies to every number on the view. 🔴 RESTORED 2026-09-02 11:03 EDT AFTER A BLOCK DELETION TOOK THEM AS COLLATERAL. Removing `worstAck` sliced from its own comment to `function fmtUptime`, and these three sat inside that range: 71 lines went where about 15 were intended. The asserts guarding it checked that `worstAck` and `ACK_BOUND_LABEL` WERE gone and never that nothing else was — an assertion that can confirm a removal but cannot see over-reach. ⚠️ IT SHIPPED THROUGH EVERYTHING. `node --check` passes (a call to a missing function is not a syntax error), the build passes, every scoped gate passes, and a full green `npm test` passed over it — because nothing in the suite OPENS the drawer. It surfaced only while registering this realm's interactive states, from a `ReferenceError: EventDrawer is not defined` in the browser console. A deletion is the one edit whose damage is invisible to a syntax check.
function eventRows(r) {
    const out = [['Kind', KIND_LABEL[r.kind] || r.kind]];
    if (r.kind === 'alert') {
        out.push(['Level', r.level || '—']);
        out.push(['Pinged a human', r.pinged ? 'yes' : 'no']);
        // ⚠️ `silent` is not the opposite of `pinged`. An alert can be stored and never posted to Discord at all, which is a third state, and the level panel already says so in its own sub-line.
        if (r.silent) out.push(['Posted to Discord', 'no — recorded only']);
        if (typeof r.rssMb === 'number') out.push(['Memory at the time', `${r.rssMb} MB`]);
        if (r.host) out.push(['Host', r.host]);
    }
    if (r.kind === 'change') {
        out.push(['Page', r.page || '—']);
        out.push(['Action', r.action || '—']);
        out.push(['Model', r.model || '—']);
        out.push(['Undone', r.undone ? 'yes' : 'no']);
    }
    if (r.kind === 'boot') {
        if (r.version) out.push(['Version', r.version]);
        if (r.commit) out.push(['Commit', r.commit]);
        if (r.bootKind || r.kind_) out.push(['Restart kind', r.bootKind || r.kind_]);
    }
    out.push(['Who', r.actorId ? String(r.actorId) : 'system']);
    if (r.detail) out.push(['Detail', r.detail]);
    return out;
}

// One sentence per kind, saying what the row IS rather than restating the fields above it — an alert has no inverse and a restart is not something anyone did, and neither fact is visible from the table.
const EVENT_NOTE = {
    change: 'Every portal and /manage write is recorded with the step that reverses it, so this row can be put back from either surface, and it survives a restart.',
    alert: 'Alerts come from the bot itself and mirror to the alert webhook. They carry no inverse — an alert is a record of something that happened, not an operation.',
    boot: 'Restart records are written on boot. A merged version can sit undeployed indefinitely, so this is the only thing that says what is actually running.',
};

// ⚠️ A ROW WITH NO USABLE DATE MUST NOT TAKE THE REALM DOWN. `new Date(x).toISOString()` throws a RangeError on an unparseable value, and this renders inside the page rather than beside it -- one malformed `createdAt` in one of three collections would blank Analytics entirely, mid-render, with no error state.
function EventDrawer({ row, onClose, onRevert }) {
    const at = new Date(row.at);
    const atText = Number.isNaN(at.getTime()) ? 'not recorded' : at.toISOString().slice(0, 16).replace('T', ' ');
    const revertable = row.kind === 'change' && !row.undone;
    return html`
        <${Drawer} eyebrow=${`${KIND_LABEL[row.kind] || row.kind} · ${atText}`}
                   title=${summaryOf(row)} onClose=${onClose}
                   actions=${html`
                       <button class="btn" onClick=${onClose}>Close</button>
                       ${revertable ? html`<button class="btn dang" onClick=${onRevert}>Reverse this change</button>` : null}`}>
            <div class="dwbody">
                <div class="diff">
                    ${eventRows(row).map(([k, v]) => html`
                        <div class="diff-r" key=${k}><span class="dk">${k}</span><span>${v}</span></div>`)}
                </div>
                <p class="dw-p" style="margin-top:16px">${EVENT_NOTE[row.kind] || EVENT_NOTE.alert}</p>
            </div>
        <//>`;
}


function fmtUptime(since) {
    if (!since) return '—';
    const secs = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 1000));
    const d = Math.floor(secs / 86400), hrs = Math.floor((secs % 86400) / 3600);
    return d ? `${d}d ${hrs}h` : `${hrs}h ${Math.floor((secs % 3600) / 60)}m`;
}


// 🔴 PIN 37, 2026-09-06 01:28 EDT — THE LEAD NOW MATCHES THE MOCKUP'S FOUR TILES AND ITS "WHERE THE MILLISECONDS GO" SPLIT (analytics.html:100-200). The 2026-09-04 two-tile cut reasoned that a tile repeating a masthead figure is a second statement of it — that argument still holds, which is why Interactions and Success rate below read the SAME population Usage/Timing already filter to (7 days, admin traffic excluded) rather than the masthead's 24h/admin-inclusive commands24h and errors24h. Nothing here is invented: every value comes from usageStats/timingStats, which this view already had via the same page load — no new request, per the build-out's `optimize` lens.
function DepBars({ byDep = [] }) {
    // Lifted out of Timing() (it used to own this panel, at the foot of that view) rather than duplicated: the mockup draws "Where the milliseconds go" ONLY on Health — analytics.html never repeats it on the Timing tab — so Timing loses the block instead of gaining a second copy of it. The per-call colour rule, the atlas total-vs-average distinction and the empty banner are unchanged from Timing's own version; only the home of the function moved.
    const depTop = Math.max(1, ...byDep.map((d) => d.totalMs || 0));
    const worst = byDep.length ? byDep.map((d) => ({ name: d._id, calls: d.calls || 0, per: d.calls ? d.totalMs / d.calls : d.totalMs }))
        .sort((x, y) => y.per - x.per)[0] : null;
    const over = worst && worst.per >= ACK_LIMIT_MS;
    const atlas = byDep.find((d) => d._id === 'atlas');
    return html`
        <section class="hpanel">
            <h4>Where the milliseconds go</h4>
            <p class="hp">Timings are aggregated <b>per dependency name</b>, never per call — that is what
                keeps the array on each event bounded. Read a row as: what this subsystem costs across the
                week, when it is used.</p>
            ${byDep.length ? html`
                <div class="depbars">
                    ${byDep.map((d) => {
                        const per = d.calls ? d.totalMs / d.calls : d.totalMs;
                        return html`
                            <div class=${'depb' + (per >= 1000 ? ' slow' : '')} key=${d._id}>
                                <span class="dn">${d._id}</span>
                                <span class="dt"><i style=${`width:${pct(d.totalMs, depTop)}%`}></i></span>
                                <span class="dv">${fmtMs(d.totalMs)}</span>
                                <span class="dc">${(d.calls || 0).toLocaleString()} call${d.calls === 1 ? '' : 's'}${' '}
                                    · ${fmtMs(per)} each</span>
                            </div>`;
                    })}
                </div>
                <div class=${'hbanner' + (over ? ' warn' : '')}>
                    <span class="hbi"><${Icon} name=${over ? 'triangle-alert' : 'check'} cls="sm" /></span>
                    <div>
                        <h4>${worst.name} is the slowest per call, at ${fmtMs(worst.per)}</h4>
                        <p>${atlas
                            ? html`Atlas costs ${' '}<b>${fmtMs(atlas.totalMs)}</b>${' '}
                                across <b>${(atlas.calls || 0).toLocaleString()}</b> calls this week, so the database is not the cost. `
                            : html`Atlas has not been called in this window, so the database is not in this picture at all. `}
                            ${over
                                ? html`At ${fmtMs(worst.per)} it exceeds Discord's ${ACK_LIMIT_MS / 1000}s acknowledgement deadline
                                    on its own, which is survivable only where it runs as a background job rather than inside an interaction.`
                                : html`It stays inside the interaction budget.`}</p>
                    </div>
                </div>` : html`
                <div class="hbanner">
                    <span class="hbi"><${Icon} name="check" cls="sm" /></span>
                    <div><h4>No timings recorded yet</h4>
                        <p>A dependency only appears here once something has called it. On a bot that has
                           just started, that is the correct reading — not a gap.</p></div>
                </div>`}
        </section>`;
}

function Health({ health, timingStats, usageStats, onOpenTiming, onFilterLevel, onOpenReach, onFilterRiver }) {
    const h = health || {};
    const usage = usageStats || {};
    const byOutcome = usage.byOutcome || [];
    const outcomeTotal = byOutcome.reduce((a, o) => a + (o.c || 0), 0);
    const errOutcome = byOutcome.find((o) => o._id === 'error');
    const errCount = errOutcome ? errOutcome.c : 0;
    // null, not 0, when nothing has run this week — a rate computed over zero interactions is not "100%", it is unmeasured, and the tile says so rather than claiming a perfect week it never had.
    const successRate = outcomeTotal ? (100 - pct(errCount, outcomeTotal)) : null;
    const byDep = (timingStats || {}).byDep || [];
    return html`
        <div class="panel" id="health">
            <div class="ph">
                <span class="t">Health</span>
            </div>
            <div class="tiles">
                <${Tile} label="Interactions" value=${usage.current ?? '—'} onClick=${onOpenTiming}
                         sub="product traffic this week — admin excluded" />
                <${Tile} label="Success rate" value=${successRate == null ? '—' : successRate.toFixed(1)}
                         unit=${successRate == null ? '' : '%'}
                         onClick=${() => onFilterRiver({ kind: 'alert', level: 'error' })}
                         tone=${successRate == null ? '' : !errCount ? 'ok' : successRate < 99 ? 'warn' : ''}
                         sub=${outcomeTotal ? `${errCount} error${errCount === 1 ? '' : 's'} across ${outcomeTotal} interactions this week` : 'nothing recorded this week'} />
                <${Tile} label="Restarts" value=${h.restarts7d ?? 0} onClick=${() => onFilterRiver({ kind: 'boot' })}
                         tone=${(h.restarts7d ?? 0) > 20 ? 'warn' : ''}
                         sub=${`${h.restarts24h ?? 0} in the last 24 hours`} />
                <${Tile} label="Memory" value=${h.rssPeakMb || '—'} unit=${h.rssPeakMb ? 'MB' : ''}
                         onClick=${onOpenTiming} tone=${h.rssPeakMb > 400 ? 'warn' : ''}
                         sub=${h.rssSampleCount ? `highest of ${h.rssSampleCount} ${h.rssSampleCount === 1 ? 'sample' : 'samples'} in 7d` : 'no alerts fired in 7 days'} />
            </div>
            <!-- 🔴 THE SPLIT IS THE MOCKUP'S, NOT THE PORTAL'S PRIOR ONE. analytics.html's Health leads
                 with its dependency-timing panel beside "Alerts by level" — the portal's own hsplit here
                 used to pair the Restarts/Where-these-come-from spark bars instead; those are demoted
                 below rather than dropped, since the mockup has no per-day chart at all and it is real,
                 portal-only depth worth keeping. -->
            <div class="hsplit">
                <${DepBars} byDep=${byDep} />
                <section class="hpanel">
                    <h4>Alerts by level</h4>
                    <!-- 🔴 THE LEVELS WERE A FILTER AND A PAIR OF TOTALS, NEVER A DISTRIBUTION. errors 24h
                         and quiet alerts 24h sit either side of one line, which answers whether anything is on
                         fire and not what the channel is actually full of. ⚠️ It names only levels PRESENT in the
                         window, the rule every key and legend here follows -- a week with no errors should not
                         draw an empty error bar, which reads as a measurement rather than as an absence. -->
                    ${(h.alertsByLevel || []).length ? html`
                        <p class="hp">Three tiers, and they never collapse into one number:${' '}
                            <b>info</b> is a record, <b>caution</b> is a look-when-convenient,${' '}
                            <b>error</b> pings a human. Seven days.</p>
                        <div class="lvlbars">
                            ${h.alertsByLevel.map((a) => html`
                                <button class=${LEVEL_ROW[a.level] || LEVEL_ROW.info} key=${a.level}
                                        onClick=${() => onFilterLevel(a.level)}>
                                    <span class="ln">${a.level}</span>${' '}
                                    <span class="lt"><i style=${`width:${Math.max(1, Math.round((a.n / Math.max(1, h.alerts7d || 1)) * 100))}%`}></i></span>${' '}
                                    <span class="lv2">${a.n}</span>${' '}
                                    <!-- ⚠️ "never pings" is a FACT about this level in this window, not a rule:
                                         sendAlert can ping on request, so a level that usually stays quiet can
                                         still have pinged once, and stating the rule would hide that. -->
                                    <span class="lp">${a.pinged ? `${a.pinged} pinged` : 'never pinged'}${a.silent ? ` · ${a.silent} not posted` : ''}</span>
                                </button>`)}
                        </div>` : html`<p class="hp">No alerts recorded in the last seven days.</p>`}
                    <!-- 🔴 ELEVEN FACTS ARE WRITTEN ON EVERY BOOT. models/BootRecord.js stores the commit,
                         the guild count, how many commands registered and how many emoji synced or went
                         MISSING — that last one is the known stale-prod-id trap. Nested here now, matching
                         the mockup, which puts the boot card inside this same panel rather than above the tiles. -->
                    ${h.lastBoot ? html`
                        <div class="bootcard">
                            <h5>Last boot</h5>
                            <div class="bootgrid">
                                <span>Version</span><b>${h.lastBoot.version || '—'}</b>
                                <span>Commit</span><b>${h.lastBoot.commit || 'not recorded'}</b>
                                <span>Kind</span><b>${h.lastBoot.kind || '—'}</b>
                                <span>Host</span><b>${h.lastBoot.host || '—'}</b>
                                <span>Guilds</span><b>${h.lastBoot.guilds ?? '—'}</b>
                                <span>Commands</span><b>${h.lastBoot.commandsRegistered ?? '—'}</b>
                                <span>Emoji</span>
                                <b class=${h.lastBoot.emojiMissing ? 'bad' : 'ok'}>${h.lastBoot.emojiSynced ?? 0} synced${h.lastBoot.emojiMissing ? `, ${h.lastBoot.emojiMissing} missing` : ''}</b>
                                <span>Cloudinary</span>
                                <b class=${h.lastBoot.cloudinaryConfigured ? 'ok' : 'bad'}>${h.lastBoot.cloudinaryConfigured ? 'configured' : 'not configured'}</b>
                                ${h.lastBoot.restartContext ? html`<span>Restarts</span><b>${h.lastBoot.restartContext}</b>` : null}
                            </div>
                            <!-- A non-zero missing count is not cosmetic: it is the emoji-capture trap, and the card
                                 says what it means rather than only how many. -->
                            ${h.lastBoot.emojiMissing
                                ? html`<p class="pnote">${h.lastBoot.emojiMissing} emoji did not resolve at boot — those render as raw ids in Discord until the next sync.</p>`
                                : null}
                        </div>` : null}
                </section>
            </div>
            <div class="hsplit">
                <section class="hpanel">
                    <h4>Restarts</h4>
                    <!-- ⚠️ THE COUNTS MOVED UP INTO A TILE AND ARE NOT REPEATED HERE. Restating them would
                         rebuild the duplication the tiles were just rewritten to remove, one panel lower. -->
                    <p class="hp">A restart is normal after a deploy and is worth a look when it was not one.</p>
                    <!-- 🔴 IT PLOTTED ALERTS UNDER A HEADING READING "RESTARTS" — 2026-09-04 22:54 EDT. The heading, the
                         prose and the series disagreed three ways, and the two figures could not be reconciled: a
                         tile said 303 restarts in 7d while this chart totalled 6. spark.boots has existed in the
                         payload all along (portal/api/analytics.js:110). Corrected toward what the heading and the
                         prose already agree on rather than by retitling, because they are the half that is right. -->
                    <${DailyBars} series=${h.spark?.boots || []} label="Restarts per day" />
                </section>
                <section class="hpanel">
                    <h4>Where these come from</h4>
                    <!-- ⚠️ NAMED IN THE READER'S WORDS, NOT THE DATABASE'S — 2026-09-04 20:53 EDT, copy audit §B. This
                         paragraph printed four collection names to somebody who wants to know whether the numbers
                         above are trustworthy, which is a question about WHAT is counted, not about where it is
                         stored. The collections are still the answer; they are just not the reader's vocabulary. -->
                    <p class="hp">Uptime and restarts come from what the bot writes each time it starts; errors and
                        the memory figure from its alert log; command counts from what players actually ran, and the${' '}
                        river below adds every admin change to those three.</p>
                    <${DailyBars} series=${h.spark?.commands || []} label="Commands per day" />
                </section>
            </div>
            <div class="hbanner">
                <span class="hbi"><${Icon} name="clock" cls="sm" /></span>
                <div>
                    <h4>These are the bot's records, not a live reading.</h4>
                    <p>The portal runs as its own process with no gateway connection, so gateway status and live memory
                        are not readable from here. For a live reading, run the <code>/bot analytics</code> command in Discord.</p>
                </div>
            </div>
        </div>
    `;
}

// ══ USAGE ═══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 THIS REPLACED A <pre> HOLDING THE DISCORD COMMAND'S TEXT EXPORT, and the replacement is the whole change rather than a restyling of it. The text is still generated — by /bot analytics, in Discord, where a downloadable .txt is the right answer — and it is no longer sent here, because a dashboard beside a transcript of itself is two layers saying one thing.
//
// ⚠️ EVERY FIGURE ON THIS VIEW IS PRODUCT TRAFFIC ONLY. computeUsageStats filters isAdmin, so /manage, /bot and /autobuild are absent by design: a self-observing system that counts its own admin traffic reports a product busier than it is. The Timing view does NOT filter them, and that difference is stated there rather than assumed.
//
// ⚠️ THE FOURTH COLUMN IS SHARE, NOT DURATION, AND THE MOCKUP'S IS DURATION. Joining timingStats' per-command figure onto these bars would put an admin-INCLUSIVE number in a product-only row — for /manage the two populations are not close — and the reader has nothing on screen telling them the column changed meaning. Share of the window is derived from the same filtered set as the bar beside it, so the row stays one population throughout. Duration lives on the Timing view, next to the sentence that says who is counted.
function Usage({ stats, outcomeKeys = [], entryKeys = [] }) {
    const byCommand = stats?.byCommand || [];
    const byEntry = stats?.byEntry || [];
    const byOutcome = stats?.byOutcome || [];
    const current = stats?.current ?? 0;
    const previous = stats?.previous ?? 0;
    const top = Math.max(1, ...byCommand.map((c) => c.c));
    const topEntry = Math.max(1, ...byEntry.map((e) => e.c));
    // 🔴 A SHARE INSIDE A BREAKDOWN IS COMPUTED FROM THAT BREAKDOWN, never from a headline figure next to it. Dividing the outcome bars by `current` assumed the two aggregations match on the same $match — they do in production, and the moment anything drifts a bar renders past 100% and is silently clamped by overflow, which looks exactly like a full bar. Its own sum cannot do that.
    const outcomeTotal = Math.max(1, byOutcome.reduce((a, o) => a + o.c, 0));
    const neverSeen = outcomeKeys.filter((k) => !byOutcome.find((o) => o._id === k));
    // The ENTRY set comes from the payload's enum, not from the rows, for the same reason the outcome set does: an entry point nobody has used is a fact, and rows-only would hide it. Ordered by volume with the never-used ones last.
    const entryRows = entryKeys.map((k) => ({ key: k, n: byEntry.find((e) => e._id === k)?.c || 0 }))
        .sort((a, b) => b.n - a.n);

    if (!byCommand.length) {
        return html`
            <div class="panel">
                <div class="ph"><span class="t">Usage — last 7 days</span></div>
                <div class="estate">
                    <span class="eicon"><${Icon} name="clock" cls="xl" /></span>
                    <h4>No command usage in the last 7 days</h4>
                    <p>Only public commands count here — your own ${'/'}manage and ${'/'}bot activity is deliberately
                        excluded, so a quiet week of admin work shows as nothing at all.</p>
                </div>
            </div>`;
    }
    return html`
        <div class="panel">
            <div class="ph">
                <span class="t">Usage — last 7 days</span>
            </div>
            <!-- ⚠️ INSIDE THIS PANEL, NOT BESIDE IT. Built first as a standalone box below — three numbers
                 the bars underneath already carry, in a second container, which is two places answering one
                 question. Harkirat: keep it, move it. It leads the panel it summarises, so the shape is
                 headline-then-breakdown rather than breakdown-then-restatement. -->
            <${OutcomeSplit} stats=${stats} />
            <div class="ubars">
                ${byCommand.map((c) => {
                    const failed = Math.max(0, c.c - (c.ok ?? c.c));
                    // 🔴 A ROW THAT NOBODY TYPED DOES NOT GET A SLASH. The busiest names in this collection are background jobs — cache warms and image renders — and prefixing them made the page assert that /webp_nameplate is a command a person can run. It is not, and there is no way to find that out from anywhere else on the screen.
                    const isJob = (c.bg ?? 0) >= c.c;
                    return html`
                        <div class="ub2" key=${c._id || '?'}>
                            <span class="ubk">${isJob ? c._id || '?' : `/${c._id || '?'}`}</span>
                            <span class="ubt2">
                                <i class="ok" style=${`width:${pct(c.ok ?? c.c, top)}%`}></i>
                                ${failed ? html`<i class="bad" style=${`width:${pct(failed, top)}%`}></i>` : null}
                            </span>
                            <span class="ubv">${c.c.toLocaleString()}${failed
                                ? html`<em class="dn">${failed} failed</em>` : null}</span>
                            <span class="ubt3">${pct(c.c, current).toFixed(pct(c.c, current) < 10 ? 1 : 0)}%</span>
                        </div>`;
                })}
            </div>
            <div class="usplit">
                <div class="uside">
                    <h5>How interactions start</h5>
                    <p class="hp">Seven entry points exist and a command is only one of them. The shape of this list is
                        the shape of the bot: how much of what it does begins with somebody typing, and how much
                        happens on its own. A row above with <b>no slash</b> is one of the latter — a background job,
                        which nobody can run.</p>
                    ${entryRows.map((e) => html`
                        <div class=${'erow' + (e.n ? '' : ' never')} key=${e.key}>
                            <span class="ek">${ENTRY_LABEL[e.key] || e.key}</span>
                            <span class="et"><i style=${`width:${pct(e.n, topEntry)}%`}></i></span>
                            <span class="ev">${e.n || '—'}</span>
                        </div>`)}
                </div>
                <div class="uside">
                    <h5>Outcomes</h5>
                    <!-- The reading is COMPUTED, not typed. Naming the four that had never fired on the day this was written is a comment about a snapshot: the sentence goes stale the first time one of them does fire, and nothing would say so. -->
                    <p class="hp">${outcomeKeys.length} outcomes are possible${neverSeen.length ? html`, and${' '}
                        <b>${neverSeen.length}</b> of them have never once happened —${' '}
                        ${neverSeen.map((k) => (OUTCOME_LABEL[k] || k).toLowerCase()).join(', ')}. That means those
                        paths have not been exercised, not that they cannot fire.` : html`, and every one of them has
                        occurred at least once in this window.`}</p>
                    ${outcomeKeys.map((k) => {
                        const hit = byOutcome.find((o) => o._id === k);
                        return html`
                            <div class=${'erow' + (hit ? '' : ' never')} key=${k}>
                                <span class="ek">${OUTCOME_LABEL[k] || k}</span>
                                <span class="et"><i style=${`width:${hit ? pct(hit.c, outcomeTotal) : 0}%;background:${k === 'ok' ? 'var(--ok)' : 'var(--warn)'}`}></i></span>
                                <span class="ev">${hit ? hit.c.toLocaleString() : '—'}</span>
                            </div>`;
                    })}
                </div>
            </div>
        </div>`;
}

// ══ TIMING ══════════════════════════════════════════════════════════════════════════════════════
//
// Two clocks and one hard deadline. Ack is what Discord judges the bot on; duration is what a person feels. A page that averages them into one "latency" figure hides which of the two is actually at risk, which is why the schema records them separately in the first place.
function Timing({ stats }) {
    const overall = stats?.overall || null;
    const buckets = stats?.ackBuckets || [];
    const byCommand = stats?.byCommand || [];
    const byDep = stats?.byDep || [];
    const ackP = overall?.ackP || [null, null];
    const durP = overall?.durP || [null, null];
    const measured = buckets.reduce((a, b) => a + (b.n || 0), 0);
    // Ranked by how slow, not by how often: the slowest thing is the only one anybody ever describes as "the bot is slow".
    const worst = [...byCommand].sort((a, b) => (b.p?.[0] ?? 0) - (a.p?.[0] ?? 0));
    const worstMs = worst[0]?.p?.[0] || 1;
    const depTop = Math.max(1, ...byDep.map((d) => d.totalMs || 0));
    const emptyBuckets = ACK_BUCKETS.filter((b) => !(buckets.find((x) => x._id === b)?.n));

    if (!measured && !worst.length) {
        return html`
            <div class="panel">
                <div class="ph"><span class="t">Timing — last 7 days</span></div>
                <div class="estate">
                    <span class="eicon"><${Icon} name="clock" cls="xl" /></span>
                    <h4>No timings recorded yet</h4>
                    <p>Every interaction records how long it took to answer and how long it took to finish.
                        This fills in on its own as the bot gets used.</p>
                </div>
            </div>`;
    }
    return html`
        <div class="panel">
            <div class="ph">
                <span class="t">Timing — last 7 days</span>
            </div>
            <div class="tim2">
                <section class="hpanel">
                    <h4>Answering — the clock Discord is holding</h4>
                    <p class="hp">Every interaction has to be answered within <b>3 seconds</b> or Discord throws it
                        away and the person sees a failure the bot never gets to explain. This scale is that
                        deadline, not a target invented here.${ackP[0] != null ? html`${' '}
                        ${USUALLY} <b>${fmtMs(ackP[0])}</b>, ${SLOWEST} <b>${fmtMs(ackP[1])}</b>.` : null}</p>
                    <!-- An empty slot is DRAWN rather than left out. Five of seven buckets empty, including the one past the deadline, is the reading of this panel, and a list that silently omits the empty ones cannot say it. -->
                    <p class="gread">${measured
                        ? html`<b>${buckets.find((x) => x._id === 0)?.n || 0} of ${measured}</b> answers land in the
                               first band${emptyBuckets.length
                                   ? html`, and <em>${emptyBuckets.length} of ${ACK_BUCKETS.length} bands are empty</em>${' '}
                                          ${emptyBuckets.includes(ACK_LIMIT_MS) ? '— including the one past the deadline.' : '.'}`
                                   : ' — spread across every band.'}`
                        : 'Nothing has been answered inside this window yet.'}</p>
                    <div class="ackscale">
                        ${ACK_BUCKETS.map((b) => {
                            const n = buckets.find((x) => x._id === b)?.n || 0;
                            return html`
                                <div class=${'ackrow' + (b >= 2000 ? ' danger' : '') + (n ? '' : ' zero')} key=${b}>
                                    <span class="al">${ACK_BUCKET_LABEL[b]}</span>
                                    <span class="at"><i style=${`width:${pct(n, measured || 1)}%`}></i></span>
                                    <span class="av">${n || '—'}</span>
                                </div>`;
                        })}
                    </div>
                </section>
                <section class="hpanel">
                    <h4>Finishing — the clock a person feels</h4>
                    <p class="hp">How long the work itself takes, after the answer. Once an interaction has been
                        answered the bot has <b>fifteen minutes</b> to finish, so nothing here is late — this is
                        simply how long you wait. Each figure is that command's <b>${SLOWEST}</b> run.</p>
                    ${worst.length ? html`
                        <div class="durlist">
                            ${worst.map((c) => html`
                                <div class=${'durrow' + ((c.p?.[0] ?? 0) >= LONG_WAIT_MS ? ' slow' : '')} key=${c._id || '?'}>
                                    <span class="dl">/${c._id || '?'}</span>
                                    <span class="dt2">
                                        <i style=${`width:${pct(c.p?.[0] ?? 0, worstMs)}%`}></i>
                                        <b class="deadline" style=${`left:${Math.min(pct(ACK_LIMIT_MS, worstMs), 100)}%`}></b>
                                    </span>
                                    <span class="dv2">${fmtMs(c.p?.[0])}</span>
                                </div>`)}
                        </div>
                        <p class="hp"><span class="dlkey"></span> marks the 3-second answering deadline. Every command
                            here answers first and works afterwards, so a bar reaching past it is the work taking
                            longer than the answer was owed — not a missed deadline.</p>`
                        : html`<p class="hp">No command has recorded a finish time in this window.</p>`}
                </section>
            </div>
            <!-- 🔴 "WHERE THE MILLISECONDS GO" MOVED TO HEALTH, 2026-09-06 01:28 EDT (pin 37). The mockup draws that
                 panel only on the Health tab (analytics.html never repeats it on Timing), so it now lives
                 there as the shared DepBars component instead of being drawn twice on one realm. -->
        </div>`;
}

// ══ REACH ═══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 THE DIMENSION NEITHER SURFACE HAD. context and installType are written on every single event by utils/eventStore.js and had never once been read back — not by /bot analytics, which has no Reach page, and not by the portal. This is the measurement the whole v3 guild-install line exists to answer, and the one Discord itself will never tell you.
function Reach({ rows = [] }) {
    const total = rows.reduce((a, r) => a + r.n, 0);
    const byCtx = ['guild', 'dm'].map((c) => ({ c, n: rows.filter((r) => r.context === c).reduce((a, r) => a + r.n, 0) }));
    const lead = byCtx.slice().sort((x, y) => y.n - x.n)[0] || { c: 'dm', n: 0 };
    const leadShare = total ? (lead.n / total) * 100 : 0;
    // ⚠️ AN EMPTY WINDOW MUST NOT ARGUE FROM ZERO. With no interactions this rendered "0% of all use is in DMs" as the case for the portal existing -- a finding stated over an absence of data, which is the same defect as a colour that is on regardless.
    const haveSplit = total > 0;
    const leadLabel = lead.c === 'dm' ? 'DMs' : 'servers';
    const byInstall = [
        { key: 'guild', label: 'Guild install', note: 'the app is added to a server; everyone there can use it' },
        { key: 'user', label: 'User install', note: 'the app travels with one person, into any server and any DM' },
        // Kept as its own row rather than folded into either bar: Discord omits authorizingIntegrationOwners on some interaction types, so this is a real third answer and absorbing it would overstate whichever install kind swallowed it.
        { key: null, label: 'Not reported', note: 'Discord did not say how the app was installed for these' },
    ].map((x) => ({ ...x, n: rows.filter((r) => (r.installType || null) === x.key).reduce((a, r) => a + r.n, 0) }));

    if (!total) {
        return html`
            <div class="panel">
                <div class="ph"><span class="t">Reach — last 7 days</span></div>
                <div class="estate">
                    <span class="eicon"><${Icon} name="user" cls="xl" /></span>
                    <h4>Nobody has used the bot in this window</h4>
                    <p>Reach counts public interactions only. Your own admin work is excluded here for the same
                        reason it is on Usage.</p>
                </div>
            </div>`;
    }
    return html`
        <div class="panel">
            <div class="ph">
                <span class="t">Reach — last 7 days</span>
            </div>
            <div class="reach">
                <section class="hpanel">
                    <h4>Where the interaction happened</h4>
                    <div class="donutrow">
                        ${byCtx.map((x) => html`
                            <div class="dcell" key=${x.c}>
                                <div class="donut" style=${`--p:${pct(x.n, total).toFixed(1)};--c:${x.c === 'dm' ? 'var(--sched)' : 'var(--ok)'}`}>
                                    <b>${pct(x.n, total).toFixed(0)}<i>%</i></b>
                                </div>
                                <span class="dlab">${x.c === 'dm' ? 'Direct message' : 'In a server'}</span>
                                <span class="dsub">${x.n.toLocaleString()} interaction${x.n === 1 ? '' : 's'}</span>
                            </div>`)}
                    </div>
                    <!-- ⚠️ THE CAPTION NAMES WHAT THE CHART SHOWS BEFORE IT ARGUES FROM IT. The design leads on the measurement (analytics.html:428, "More than half of all use is in DMs") and this led on the principle, so a reader got the conclusion without the number standing directly above it. The closing line is the portal's own and is kept — the design has no equivalent. ⚠️ It reads the split rather than asserting one: the design's sentence assumes DMs lead, which is true of its fixtures and is not a fact about the data.
                         "privately" is dropped for the same reason — it is only true of one of the two answers this sentence can now give.
                         ⚠️ AND IT STATES THE PERCENTAGE RATHER THAN "MORE THAN HALF", which was the first attempt and which the fixtures immediately falsified: 51% against 49% is more than half and reads as a decisive majority. A phrase that renders 51% and 80% identically has stopped carrying information, which is the same objection this file already makes to a tile that is orange whatever the numbers are. -->
                    <p class="hp">${haveSplit
                        ? html`${Math.round(leadShare)}% of all use is in <b>${leadLabel}</b> — a`
                        : html`Nothing has been recorded in this window, so there is no split to read yet. A`} bot answering one screenful at a time, which is not the place to audit
                        a season or bulk-edit an armory. That split is the argument for this portal existing at all.</p>
                </section>
                <section class="hpanel">
                    <h4>How the app was installed</h4>
                    <p class="hp">Whether each interaction came from a server that added the app or from a person who
                        did. The v3 line made every public command guild-installable while the admin commands stayed
                        user-only — this is the measurement that says whether that landed.</p>
                    ${byInstall.map((x) => html`
                        <div class=${'inrow' + (x.key ? '' : ' muted')} key=${x.label}>
                            <span class="ik">${x.label}</span>
                            <span class="it"><i style=${`width:${pct(x.n, total)}%`}></i></span>
                            <span class="iv">${x.n.toLocaleString()}</span>
                            <span class="inote">${x.note}</span>
                        </div>`)}
                </section>
            </div>
        </div>`;
}

// ══ SEARCH ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 THE ONLY FIGURE IN THE SYSTEM THAT DESCRIBES WHAT SOMEBODY WANTED. Everything else on this realm describes what the bot did. A term typed into an autocomplete that matched nothing names something this bot does not have — a missing alias, or a missing feature — and it appears on no other surface, in Discord or here. 🔴 A SUCCESS RATE IS A COMPARISON AND IT WAS RENDERED AS A PERCENTAGE. "99.0%" hides both numbers that matter — how many ran and how many did not — and the panel already has them. The sheet's diff block is the shape for exactly this: a key, and the two sides of the fact. ⚠️ IT READS `byOutcome`, THE SAME BREAKDOWN THE BARS BELOW IT DRAW, and never the headline `current`. The panel's own note records why: dividing one aggregation by another assumes the two match on the same $match, and the moment they drift a bar renders past 100% and is silently clamped, which looks exactly like a full bar. A summary computed from a different source than the thing it summarises is the same defect wearing a smaller hat.
function OutcomeSplit({ stats }) {
    const byOutcome = stats?.byOutcome || [];
    if (!byOutcome.length) return null;
    const total = byOutcome.reduce((a, o) => a + o.c, 0);
    if (!total) return null;
    const failed = byOutcome.filter((o) => o._id && o._id !== 'ok').reduce((a, o) => a + o.c, 0);
    return html`
        <div class="diff">
            <div class="diff-r"><span class="dk">Succeeded</span><span>${(total - failed).toLocaleString()} of ${total.toLocaleString()}</span></div>
            <div class="diff-r"><span class="dk">Failed</span><span>${failed ? failed.toLocaleString() : 'none'}</span></div>
            <div class="diff-r"><span class="dk">Outcomes recorded</span><span>${byOutcome.length}</span></div>
        </div>`;
}

function Search({ rows = [] }) {
    const zero = rows.filter((r) => r.zeroResults > 0);
    const picked = rows.reduce((a, r) => a + r.picked, 0);
    return html`
        <div class="panel">
            <div class="ph">
                <span class="t">Search — last 30 days</span>
            </div>
            <div class="srchview">
                <div class="tiles" style="padding:0">
                    <div class="tile">
                        <span class="tl-k">Terms recorded</span><span class="tl-v">${rows.length}</span>
                        <span class="tl-s">distinct autocomplete queries</span>
                    </div>
                    <div class=${'tile ' + (zero.length ? 'warn' : 'ok')}>
                        <span class="tl-k">Returned nothing</span><span class="tl-v">${zero.length}</span>
                        <span class="tl-s">someone wanted this and did not get it</span>
                    </div>
                    <div class="tile">
                        <span class="tl-k">Picked a result</span><span class="tl-v">${picked}</span>
                        <span class="tl-s">searches that ended in a choice</span>
                    </div>
                </div>
                ${rows.length ? html`
                    <table class="mtable srchtab">
                        <thead><tr>
                            <th>Term</th><th>Command</th><th>Field</th>
                            <th class="ta-r">Searches</th><th class="ta-r">Zero results</th><th class="ta-r">Picked</th>
                        </tr></thead>
                        <tbody>
                            ${rows.map((r) => html`
                                <tr class=${r.zeroResults ? 'zero' : ''} key=${r.term + r.command + r.field}>
                                    <td class="n"><b>${r.term}</b></td>
                                    <td>/${r.command}</td>
                                    <td>${r.field}</td>
                                    <td class="nums ta-r">${r.searches}</td>
                                    <td class=${'nums ta-r' + (r.zeroResults ? ' bad' : '')}>${r.zeroResults || '—'}</td>
                                    <td class="nums ta-r">${r.picked || '—'}</td>
                                </tr>`)}
                        </tbody>
                    </table>`
                    : html`
                        <div class="estate">
                            <span class="eicon"><${Icon} name="search-x" cls="xl" /></span>
                            <h4>No searches recorded yet</h4>
                            <p>This fills only from autocomplete sessions. An empty table means nobody has typed into
                                an autocomplete field in the last 30 days — <b>not</b> that nobody searched.</p>
                        </div>`}
                <div class="bvnote">
                    <b>What this view is for.</b> Every other number in Analytics describes what the bot${' '}
                    <em>did</em>. A search that returned nothing is the only one that describes what somebody${' '}
                    <em>wanted</em> and did not get. That is either a missing alias or a missing feature, and it is
                    invisible everywhere else — including in Discord, where the person simply saw an empty list and
                    moved on.
                </div>
            </div>
        </div>`;
}

export function AnalyticsRealm({ session }) {
    // 🔴 THE ONE FIGURE AN ADMIN CANNOT GET ANYWHERE ELSE. `/manage`, `/bot` and `/autobuild` are stamped `isAdmin` and excluded from every product count — correctly, because one admin's afternoon would otherwise dominate a small dataset. But that also makes "did my own edit register, and how long did it take" unanswerable from the screen that should answer it. The toggle asks the server again rather than filtering here, because the percentiles and the roll-ups are aggregations: there is no client-side subset of a p95.
    const [includeAdmin, setIncludeAdmin] = useState(false);
    // ⚠️ `/api/review` RIDES ALONG for the rail's staged badge, in the SAME `useAsync` so the realm still has one loading phase. Spreading `analytics` first keeps its own `forbidden`/`failed`/`signedOut` keys, so `failureOf` inside `useAsync` still routes a genuine analytics failure to the failbox.
    const load = useAsync(() => Promise.all([fetchJson(`/api/analytics${includeAdmin ? '?admin=1' : ''}`), fetchJson('/api/review')])
        .then(([analytics, review]) => ({ ...analytics, stagedOps: (review && review.ops) || [],
                                          stagedUnknown: Boolean(review && (review.forbidden || review.failed)) })), [includeAdmin]);
    const [view, setView] = useState('Health');
    // 🔴 THE DESIGN'S LEVEL ROWS ARE A FILTER CONTROL AND THE PORTAL DREW THEM AS TEXT. analytics.html:228 sets the river to kind=alert plus that level and scrolls it into view, so the distribution and the log are one surface: you read that 258 alerts were cautions and press the row to see them. The portal had the same three rows as inert divs and the same filters sitting unreachable in the Manifest's own chipset. `seq` rather than the filters object is what Manifest keys its effect on -- see its comment.
    const [riverFilter, setRiverFilter] = useState(null);
    // 🔴 THE RIVER'S ROWS OPENED NOTHING, AND THE DESIGN OPENS A DRAWER FROM EVERY ONE. analytics.html:545 makes each row a role=button that calls openEvent, and `--triggers` structurally cannot list a handler bound to a table row, so this was the last piece of the interaction tier and the one no instrument reported. The row carries the columns the table has space for; everything the collection actually stores -- the level, whether it pinged, the memory reading, the page and action behind a change -- had nowhere to be read.
    const [openEvent, setOpenEvent] = useState(null);
    function filterRiver(filters) {
        setRiverFilter((prev) => ({ seq: (prev ? prev.seq : 0) + 1, filters }));
        // After the render that applies the filter, not before it -- scrolling to a table that has not re-rendered lands on the old row count.
        requestAnimationFrame(() => document.getElementById('manifest')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    const overlay = useOverlay();

    if (!load.data) return html`<${RealmShell} realm="analytics" session=${session} error=${load.error} slow=${load.slow}
                                               onRetry=${load.reload} skeleton=${{ rows: 8, lines: [18, 30, 14, 22, 10] }} />`;
    const data = load.data;

    // 🔴 CSV, NOT THE BOT'S PROSE. /bot analytics already hands a person a readable .txt in Discord, and this route deliberately stopped serving those three text builds in the page payload -- but the mockup's own strip offers "CSV for a spreadsheet", which is a different artifact for a different act: reading versus pivoting. Five tables, one per panel the dashboard draws. ⚠️ Each scope RE-QUERIES on download rather than serialising what this page loaded, so an export taken later is the data as it is then, not a snapshot of a stale tab. ⚠️ WRITTEN OUT, NOT BUILT BY A HELPER, and the gate is right to insist. A `csvScope(id, label, count, note)` factory filled `unit` and `filename` uniformly for all five -- which is precisely what "each scope states its OWN shape" exists to prevent, and portalExport.test.js reads these as source literals so it can check that every one of them does. A helper is invisible to it.
    const exportToday = new Date().toISOString().slice(0, 10);
    const exportScopes = [
        { id: 'analytics.events', label: 'Event river', unit: 'events',
          count: (data.river || []).length, url: '/api/analytics/export?scope=events',
          filename: `dioreo-analytics-events-${exportToday}.csv`,
          note: 'Changes, alerts and boots on one timeline — most columns are empty for most rows, because three collections share it.' },
        { id: 'analytics.usage', label: 'Usage by command', unit: 'commands',
          count: ((data.usageStats || {}).byCommand || []).length, url: '/api/analytics/export?scope=usage',
          filename: `dioreo-analytics-usage-${exportToday}.csv`,
          note: 'Uses, successes and background runs per command.' },
        { id: 'analytics.timing', label: 'Timing by command', unit: 'commands',
          count: ((data.timingStats || {}).byCommand || []).length, url: '/api/analytics/export?scope=timing',
          filename: `dioreo-analytics-timing-${exportToday}.csv`,
          note: 'Calls, median and worst duration per command — the raw sample array is reduced here rather than pasted into a cell.' },
        { id: 'analytics.reach', label: 'Reach', unit: 'rows',
          count: (data.reach || []).length, url: '/api/analytics/export?scope=reach',
          filename: `dioreo-analytics-reach-${exportToday}.csv`,
          note: 'Where interactions happened and how the app was installed.' },
        { id: 'analytics.searches', label: 'Search terms', unit: 'terms',
          count: (data.searches || []).length, url: '/api/analytics/export?scope=searches',
          filename: `dioreo-analytics-searches-${exportToday}.csv`,
          note: 'What people searched for, and what returned nothing — the only export here that names a gap rather than a total.' },
    ];

    // 🔴 THE MOST DANGEROUS BUTTON IN THE PORTAL ALSO HAD THE QUIETEST FAILURE. A revert that 500ed resolved to a payload nothing read, so the row stayed exactly as it was — indistinguishable from a portal that ignored the click, and the reader's next move is to press it again. ⚠️ ONE WORD FOR THE COMMITTED SENSE, AND IT IS "REVERSE". The UX-copy audit's vocabulary table (`local/handoff/2026-08-25-portal-ux-copy-audit.md`, gitignored -- state the path when citing it) reserves Undo for taking a STAGED change back and Reverse for undoing a COMMITTED one, because one word for two operations at different tiers is how a reader learns the wrong consequence. This realm carried both: the bulk bar and its confirm said Revert while the event drawer said Reverse, four inches apart. The op id stays `change.revert` -- an internal identifier is not a reader-facing word, and renaming it would break the route, the ChangeLog rows already written, and every custom_id in a panel someone still has open.
    async function revert(changeId) {
        // 🔴 ENCODED, AND THE BUG THIS FIXES WAS INVISIBLE FROM BOTH ENDS. A change id is `#1`-shaped, and `#`
    // in a template-literal URL starts a FRAGMENT: the browser sent `/api/revert/` with no id at all, the route regex did not match, and the answer was a 404 with a null body — which the comment above describes as the quiet failure this button already had once. Fixed with `segment()`'s decode on 2026-09-02 22:41 EDT; either half alone leaves the button dead, so they must never be separated.
    const res = await fetchJson(`/api/revert/${encodeURIComponent(changeId)}`, { method: 'POST', headers: { 'x-csrf-token': session.csrfToken } });
        if (await reportFailure(overlay, res, 'That change was not reversed')) return false;
        load.reload();
        return true;
    }

    // 🔴 THE MOST DANGEROUS BUTTON IN THE PORTAL HAD NO CONFIRMATION AT ALL. Everything else here stages; this one fires immediately against live data, once per selected row, and it is the only control that can undo something a person already committed on purpose. It sat in a bulk-action list beside "Export selection".
    //
    // ⚠️ NOT a typed gate, and that is a judgement rather than an omission: a revert applies the change's own recorded INVERSE, so the safe direction is the one this button goes in — the risk is reverting the WRONG row, which naming the rows answers and typing a word does not.
    function confirmRevert(ids) {
        const chosen = rows.filter((r) => ids.includes(r.id));
        const revertable = chosen.filter((r) => r.kind === 'change');
        overlay.confirm({
            op: 'change.revert', tier: 2, danger: true,
            confirmLabel: revertable.length === 1 ? 'Reverse it' : `Reverse ${revertable.length} changes`,
            title: revertable.length === 1 ? 'Reverse this change?' : `Reverse ${revertable.length} changes?`,
            body: html`
                <p class="dw-p">This applies each change's recorded inverse <b>immediately</b> — it does not stage, and
                    the Review screen never sees it. The reversal is itself recorded here, so it can be reversed in turn.</p>
                ${chosen.length !== revertable.length ? html`
                    <p class="dw-p"><b>${chosen.length - revertable.length}</b> of the selected rows${' '}
                        ${chosen.length - revertable.length === 1 ? 'is an alert or a restart' : 'are alerts or restarts'},
                        not changes — nothing will happen to ${chosen.length - revertable.length === 1 ? 'it' : 'them'}.</p>` : null}
                <ul class="dw-l">${revertable.slice(0, 6).map((r) => html`
                    <li key=${r.id}>${r.summary}</li>`)}
                    ${revertable.length > 6 ? html`<li>…and ${revertable.length - 6} more</li>` : null}</ul>`,
            // 🔴 IT CLAIMED SUCCESS BEFORE A SINGLE REQUEST HAD ANSWERED — corrected 2026-09-04 21:57 EDT. `revert` is async and `forEach` discards every promise, so the toast fired synchronously: a server that was down produced BOTH *"3 changes reverted"* and, a moment later, the failure — and since one toast replaces another, the reader's last word was the failure with a success already in their memory. The single-row path was fixed under the comment above calling this the most dangerous button in the portal; the BULK path was the same defect, still live, on the only control that mutates committed production data with no staging step. ⚠️ AND THE WORD WAS WRONG. `analytics.js`'s own rule is one word for the committed sense and it is REVERSE; the button says Reverse and the toast said *reverted*, two lines apart.
            onConfirm: async () => {
                const results = await Promise.all(revertable.map((r) => revert(r.id)));
                const done = results.filter(Boolean).length;
                if (!done) return;   // every failure has already named itself through reportFailure
                overlay.say(done === revertable.length
                    ? `${done} change${done === 1 ? '' : 's'} reversed. Players see the previous value now.`
                    : `${done} of ${revertable.length} reversed. The rest are unchanged — try them again.`);
            },
        });
    }

    // The row dot carries the event's KIND, matching its chip. Left ungated it rendered 100 identical grey squares, which is a column of noise -- colour has to mean something or it should not be drawn. --patch/--warn/--ret are the same three signals the chips use, so the dot and the chip never disagree.
    const KIND_VAR = { change: '--patch', alert: '--warn', boot: '--ret' };
    // The level default is not cosmetic: a change or a boot carries no level, and an undefined value would make the Level filter silently hide every non-alert row the moment it is touched.
    const rows = data.river.map(r => ({ ...r, id: r.changeId || r.alertId || r._id, state: 'live', topicVar: KIND_VAR[r.kind], summary: summaryOf(r), source: sourceOf(r), actor: r.actorId || 'system', level: r.level || (r.kind === 'alert' ? 'info' : '—') }));
    const h = data.health || {};

    // A lookup, not a ternary chain: three views nested two deep was already at the edge of readable, and this is five.
    const VIEWS = {
        Health: () => html`<${Health} health=${data.health} timingStats=${data.timingStats} usageStats=${data.usageStats} onOpenTiming=${() => setView('Timing')} onFilterLevel=${(level) => filterRiver({ kind: 'alert', level })} onOpenReach=${() => setView('Reach')} onFilterRiver=${filterRiver} />`,
        Usage: () => html`<${Usage} stats=${data.usageStats} outcomeKeys=${data.outcomeKeys} entryKeys=${data.entryKeys} />`,
        Timing: () => html`<${Timing} stats=${data.timingStats} />`,
        Reach: () => html`<${Reach} rows=${data.reach} />`,
        Search: () => html`<${Search} rows=${data.searches} />`,
    };
    // 🔴 THE DESIGN PUTS A PER-VIEW SUMMARY IN THE ONE PANEL HEADER AND THIS REALM HAD NONE THERE. analytics.html:40 draws a `span.sp` and :601 fills it per view, and Shell has carried a `meta` slot for exactly this since Broadcast had to hand-roll one -- access, armory, season and broadcast all use it and Analytics was the only realm that did not, which is what converge reported as `ABSENT mk span.sp`. ⚠️ THE LINES ARE MOVED, NOT ADDED. Each view already drew this sentence inside its OWN panel header, a second `.ph` nested in the Shell's -- so writing a meta line without removing those would be the two-layers-saying-the-same-thing defect this file keeps finding, four inches apart on the same screen.
    const reachTotal = (data.reach || []).reduce((a, r) => a + (r.n || 0), 0);
    const usage = data.usageStats || {};
    const viewMeta = view === 'Health'
        ? `${data.health.commands24h ?? '—'} commands · ${data.health.rssSampleCount ?? 0} memory samples · ${data.health.restarts7d ?? '—'} boots in 7 days`
        : view === 'Usage' ? `${(usage.current ?? 0).toLocaleString()} this week · ${(usage.previous ?? 0).toLocaleString()} the week before`
        : view === 'Timing' ? 'your own admin commands are counted here, unlike Usage'
        : view === 'Reach' ? `${reachTotal.toLocaleString()} public interactions`
        : 'autocomplete sessions only';
    const viewSlot = (VIEWS[view] || VIEWS.Health)();

    // 🔴 THE RAIL'S STAGED COUNT REACHED TWO REALMS OF SEVEN. `badges` was passed by Home (home.js) and Season (season.js) only, so the one number the rail exists to carry — how much work is waiting — was absent on the five realms in between, including the two that stage on every edit. It is a property of the CHANGESET, so it is the TOTAL and not this realm's share; `Rail` omits it at zero, which is the "absent rather than zero" rule `shell.js:43` states. Unknown (a 403 on /api/review) reads as absent too, because a badge is not the surface that can say "you cannot see that". ⚠️ AS A `//` COMMENT ABOVE THE RETURN, NEVER AS `<!-- -->` INSIDE THE PROP LIST — the first version was the latter on all five realms and htm dropped every prop after it.
    return html`
        <${Shell} realm="analytics" session=${session} busy=${load.hostClass} view=${view} viewOptions=${['Health', 'Usage', 'Timing', 'Reach', 'Search']} onSetView=${setView}
                  exports=${exportScopes} exportLabel="Export" overlayFor=${overlay}
                  meta=${viewMeta}
                  badges=${{ review: data.stagedUnknown ? 0 : (data.stagedOps || []).length }}
                  stagedOps=${data.stagedUnknown ? null : data.stagedOps}
                  tools=${html`
                      <label class="adminsw">
                          <input type="checkbox" checked=${includeAdmin}
                                 onChange=${(e) => setIncludeAdmin(e.target.checked)} />
                          include admin traffic
                      </label>`}
                  overlaySlot=${html`${overlay.render()}${openEvent ? html`<${EventDrawer} row=${openEvent}
                                     onClose=${() => setOpenEvent(null)}
                                     onRevert=${() => { const r = openEvent; setOpenEvent(null); confirmRevert([r.id]); }} />` : null}`}
                  masthead=${html`<${Masthead} title="Analytics" sub="What the bot did, what it cost, and what somebody looked for and did not find."
                                               stats=${[
                                                   { value: (h.commands24h ?? 0).toLocaleString(), label: 'commands 24h', lead: true, accent: 'var(--r-analytics)' },
                                                   { value: h.errors24h ?? 0, label: 'errors 24h', tone: h.errors24h ? 'warn' : undefined },
                                                   { value: fmtUptime(h.uptimeSince), label: 'uptime' },
                                               ]} />`}
                  viewSlot=${viewSlot}
                  manifestSlot=${html`<${Manifest} rows=${rows} columns=${RIVER_COLUMNS} searchableFields=${['summary', 'title', 'actor', 'detail']}
                                                    title="One history, both front doors" label="River" filterGroups=${RIVER_FILTERS}
                                                    headerRight="Alerts, changes and boots are all events — filtering one stream beats switching between four lists."
                                                    emptyText="No changes, alerts or restarts have been recorded yet."
                                                    bulkNote="Immediate — a revert applies the inverse now, and is itself recorded"
                                                    bulkTier=${3} rowNoun=${['event', 'events']}
                                                    bulkActions=${[{ label: 'Reverse', danger: true, onClick: confirmRevert }]}
                                                    onRowClick=${(row) => setOpenEvent(row)} selectedRowId=${openEvent && openEvent.id}
                                                    ${''/* The river is capped at 100 server-side, so without a total the count divides by the page and reads 11 of 11 over a collection holding thousands -- a number that can never say something is being withheld. */}
                                                    totalRows=${data.riverTotal ?? rows.length} pageCap=${100} countSuffix=" events"
                                                    filterSignal=${riverFilter} />`} />
    `;
}
