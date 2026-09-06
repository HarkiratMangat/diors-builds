// portal/ui/harness/stub.js — HARNESS ONLY. Never served by portal/server.js.
//
// This module is aliased OVER portal/ui/httpClient.js by an import map in the harness page, so the real components import it without knowing: `import { fetchJson } from './httpClient.js'` resolves here instead. That is the whole seam. No production file is modified, no flag is threaded through the components, and there is nothing to remember to turn off — a page that does not declare the import map gets the real client.
//
// Why an import map rather than a `if (window.__HARNESS)` branch inside httpClient.js: a branch in production code is a branch that can ship enabled. This cannot: it exists only in a page the server never serves.

const FIX = window.FIX;

// Conformance mode: the harness renders exactly what the design renders, with every fixture flourish that exists to demonstrate a state switched off. Set by scripts/portalDiff.mjs on every harness capture. 🔴 THIS USED TO BE ?conform=1 AND IT DID TWO JOBS. One is retired: it published data-conform so components could render the mockup's version of a surface the portal was ahead on. The two rendering modes collapsed on 2026-08-31 and there is only one rendering now. The job that REMAINS is fixtures: the mockup's staging store is browser-local and empty on a fresh load, so it draws "0 staged" and no staged strip, while the harness synthesises four changesets so every staged surface is reachable. Renamed so the name says what it does — a parameter that keeps working while meaning something else is exactly what the collapse's own step 4 warns about. ⚠️ STALE COMMENT, corrected 2026-09-01: `?conform=1` no longer exists — the two rendering modes collapsed 2026-08-31 and the flag was renamed `?fresh=1`, which does FIXTURES ONLY. There is no stand-down switch; do not add one back.
const FRESH = new URLSearchParams(location.search).get('fresh') === '1';
// Published on the root element so COMPONENTS can read it too, not only this stub: the register of deliberate divergences has to reach the render layer or half of them stay invisible to the overlay.
if (FRESH) document.documentElement.dataset.fresh = '1';

// The season document as models/SeasonalData.js actually stores it — the six arrays live ON the document, which is why `state.live` is spread from FIX.season and the arrays together rather than nested under a `data` key. ⚠️ `releaseDateText` IS STAMPED BY THE REAL ROUTE and has to be stamped here too, or the record panel's editor refuses to stage in the harness — the empty-date guard would fire on every entry and the surface would demonstrate a refusal rather than the feature. It reproduces utils/adminParser.js's formatReleaseDateTime for the two shapes that function emits: a bare day for an exact UTC midnight, day plus a local clock time otherwise. ⚠️ The timezone is hardcoded to the one the bot defaults to; the real formatter takes it as an argument. That is the deliberate narrowing here, and it means a harness reading is right for Harkirat's clock and nobody else's.
const PATCH_TZ = 'America/Toronto';
function harnessReleaseText(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const midnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
    if (midnight) return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const day = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: PATCH_TZ });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: PATCH_TZ });
    return `${day} ${time}`;
}

function seasonLive() {
    return {
        ...FIX.season,
        newDraws: FIX.newDraws,
        returningDraws: FIX.returningDraws,
        calendar: FIX.calendar,
        patchNotes: (FIX.patchNotes || []).map((p) => ({ ...p, releaseDateText: harnessReleaseText(p.releaseDate) })),
    };
}

// Every realm this admin can see. The harness signs in as the owner because the alternative — a partial grant — hides surfaces, and a harness that silently omits a page is worse than useless when the whole point is looking at every page. Narrower grants are reachable with ?realms= below.
const ALL_REALMS = ['season', 'armory', 'broadcast', 'review', 'access', 'analytics'];
const params = new URLSearchParams(location.search);
const realms = params.get('realms') ? params.get('realms').split(',') : ALL_REALMS;
const owner = params.get('owner') !== '0';
// ⚠️ THE OVERLAY COMPARES DATA BEFORE IT COMPARES DESIGN. The mockup's staging store is browser-local and empty on a fresh load, so it draws "0 staged" and no staged strip; the harness synthesises four changesets so every staged surface is reachable. Both are right for their own job and they cannot be subtracted from each other -- 425px of staged panel on one side reads as a layout defect when it is really a fixture difference. Under ?conform=1 the harness matches the mockup's fresh state. ⚠️ STALE COMMENT, corrected 2026-09-01: `?conform=1` no longer exists — the two rendering modes collapsed 2026-08-31 and the flag was renamed `?fresh=1`, which does FIXTURES ONLY. There is no stand-down switch; do not add one back.
const freshFixtures = document.documentElement.dataset.fresh === '1' || params.get('fresh') === '1';

// portal/api/armory.js stamps two fields onto every build that are NOT in the stored document: `coverage` (from coverageFlags) and `accent` (from getMpCategoryAccent). The fixtures hold raw documents, so without this the Rack renders with no accents and the Coverage matrix is all zeros — a page that looks finished and is measuring nothing.
//
// ⚠️ ONE FLAG IS AN APPROXIMATION AND IT IS MARKED. The real near-duplicate check runs utils/search.js's findDuplicateLoadouts, which needs the bot's own module; here an exact shareCode collision among the other MP builds stands in. The other four rules are the server's verbatim. Anything that turns on the precise duplicate SET must be checked against the server, not against this.
const CAT_HEX = Object.fromEntries((FIX.CATS || []).map((c) => [c.key, c.hex]));
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MP_CODES = new Map();
for (const b of FIX.builds || []) {
    if (b.mode !== 'MP' || !b.shareCode) continue;
    MP_CODES.set(b.shareCode, (MP_CODES.get(b.shareCode) || 0) + 1);
}
function armoryBuild(b) {
    const flags = [];
    if (!b.imageKey) flags.push('missing-image');
    if (!(b.isMeta || b.categoryRank || b.dmzRangeRank || b.isToxic)) flags.push('no-badges');
    if ((b.attachments || []).length !== (b.mode === 'DMZ' ? 9 : 5)) flags.push('wrong-attachment-count');
    if (b.lastUpdated && Date.now() - new Date(b.lastUpdated).getTime() > NINETY_DAYS_MS) flags.push('stale-90d');
    if (b.mode === 'MP' && b.shareCode && (MP_CODES.get(b.shareCode) || 0) > 1) flags.push('near-duplicate');
    return { ...b, _id: b._id || b.id, coverage: flags, accent: CAT_HEX[b.category] || 'var(--ink3)' };
}

// portal/api/analytics.js assembles seven fields from six collections, and the fixtures hold the raw material under different names. Mapping them explicitly is the difference between a page that renders and a page that MEASURES — the first attempt passed the fixture arrays through under the API's key names and every KPI read "no boot recorded / 0 alerts / 0 users" on a fixture set that carries 303 boots, 998 alerts and 496 events. It looked finished and said nothing.
function analyticsPayload() {
    const F_ = window.FIX;
    const boot = F_.bootStats || {};
    const totals = F_.OBS_TOTALS || {};
    const alertRows = F_.alertSample || [];
    const changeRows = F_.changeLog || [];
    const bySeverity = Object.fromEntries((F_.alertStats || []).map((a) => [a.level, a.n]));
    // The river is one stream, oldest last, exactly as eventRiver() returns it: changes and alerts interleaved and sorted by time. `kind` is the row's OWN kind and must not be clobbered by a spread — the real endpoint carries a comment about that exact bug.
    const river = [
        ...changeRows.map((c) => ({ ...c, kind: 'change', at: c.at, changeId: c.target + c.at })),
        ...alertRows.map((a) => ({ ...a, kind: 'alert', at: a.at, alertId: a.title + a.at })),
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const spark = (n, peak) => Array.from({ length: 7 }, (_, i) => Math.round(peak * (0.4 + 0.6 * Math.abs(Math.sin(i + n)))));
    return {
        river,
        // Mirrors the real route: the fixtures' own recorded totals, never the sample length, or the harness teaches that the river shows everything there is. ⚠️ AND THE FIRST VERSION SAID THAT AND THEN USED THE SAMPLE. `changeRows` IS `F_.changeLog`, six rows; `OBS_TOTALS.changes` is 22 and sits in the same object this line already reads for `boots`. It rendered 1307 where 998 + 303 + 22 = 1323 -- which is the figure `api/analytics.js` quotes as the design's own target, so the fix shipped 16 short of the number it was citing.
        riverTotal: ((F_.alertStats || []).reduce((n, a) => n + (a.n || 0), 0) + (totals.changes || changeRows.length) + (totals.boots || 0)) || river.length,
        health: {
            uptimeSince: new Date(Date.now() - (boot.uptimeSec || 5400) * 1000).toISOString(),
            lastBootKind: boot.kind, lastBootVersion: boot.lastVersion,
            errors24h: (bySeverity.error || 0) + (bySeverity.critical || 0),
            noise24h: bySeverity.info || 0,
            rssPeakMb: (F_.memStats || {}).maxMb, rssSampleCount: alertRows.length,
            // 🔴 THIS READ THE RIVER'S 5-ROW SAMPLE AND CALLED IT THE WEEK'S DISTRIBUTION. It folded `alertSample` -- the handful of rows the river table draws -- so the Alerts-by-level panel showed ONE bar reading 5 while the masthead beside it said 498 alerts, and the mockup drew three. Its old comment defended this as "the same rows the river draws", but production's alertsByLevel is folded from alerts7d, every alert in the window, and the river is a sample BY CONSTRUCTION -- so the two legitimately differ and matching them was matching the wrong thing. The consequence was not cosmetic: with only `info` present, no fixture-driven instrument could reach the caution tier at all, which is exactly where the emitter was broken.
            //
            // ⚠️ `alertStats` is the fixture's OWN aggregate over its full alert set, which is what computeHealth produces from the collection -- not a hand-written distribution. Only levels PRESENT are emitted, which is what the panel itself promises.
            alerts7d: (F_.alertStats || []).reduce((n, a) => n + (a.n || 0), 0) || alertRows.length,
            alertsByLevel: (() => {
                const order = ['error', 'warn', 'caution', 'info'];
                const rank = (l) => (order.indexOf(l) < 0 ? 99 : order.indexOf(l));
                const stats = (F_.alertStats || []).filter((a) => a && a.level && a.n);
                const rows = stats.length
                    ? stats.map((a) => ({ level: a.level, n: a.n, pinged: a.pinged || 0, silent: a.silent || 0 }))
                    : (() => {
                        const by = new Map();
                        for (const a of alertRows) {
                            const level = a.level || 'info';
                            const row = by.get(level) || { level, n: 0, pinged: 0, silent: 0 };
                            row.n += 1;
                            if (a.pinged) row.pinged += 1;
                            if (a.silent) row.silent += 1;
                            by.set(level, row);
                        }
                        return [...by.values()];
                    })();
                return rows.sort((x, y) => rank(x.level) - rank(y.level));
            })(),
            commands24h: totals.events || 0,
            distinctUsers24h: new Set((F_.cmdStats || []).map((c) => c.command)).size,
            // 🔴 THE +4 FLOOR MEANT THIS SPARKLINE COULD NEVER READ ZERO. Under ?empty=1 the Health panel showed "Alerts per day: 3 2 4 3 2 4 4" beside "0 errors", "0 commands" and a river saying nothing had been recorded — a chart inventing a week of activity in a portal with no records at all, which is the precise failure that flag exists to expose. Both series now derive from a real row count, so an empty fixture set produces empty bars.
            spark: { alerts: spark(1, Math.ceil(alertRows.length / 7)), commands: spark(3, Math.round((totals.events || 0) / 7)) },
            restarts24h: 0, restarts7d: boot.boots || 0,
            // The real route sends the whole BootRecord; the fixture's bootStats carries the same fields under the same names, so the card renders what production would.
            lastBoot: {
                version: boot.lastVersion || null, commit: boot.lastCommit || null, kind: boot.kind || null,
                host: boot.host || 'diors-builds-bot', guilds: boot.guilds ?? 0,
                commandsRegistered: boot.commandsRegistered ?? 0,
                emojiSynced: boot.emojiSynced ?? 0, emojiMissing: boot.emojiMissing ?? 0,
                cloudinaryConfigured: boot.cloudinaryConfigured !== false,
                restartContext: boot.restartContext || '', at: new Date().toISOString(),
            },
        },
        // 🔴 THESE TWO WERE ARRAYS AND THE REAL ROUTE RETURNS OBJECTS. `usageStats: F_.cmdStats` put the fixture array straight under the API's key name — the exact defect this file's own header describes, committed a second time in the same function, on the two fields nothing was reading yet. The old component only touched `usageStats.current`, which is undefined on an array, so a header silently did not render and every gate stayed green. It surfaced only when a component finally destructured `byCommand` and got nothing on a fixture set carrying 496 events.
        //
        // The real shapes: computeUsageStats groups by $command ALONE, so the fixtures' per-subcommand rows have to be folded the way Mongo would fold them — a stub that keeps them separate would show more rows than production ever can.
        usageStats: usageStatsShape(F_), timingStats: timingStatsShape(F_),
        reach: F_.reachStats || [],
        searches: F_.searchTerms || [],
        outcomeKeys: F_.OUTCOMES || [], entryKeys: F_.ENTRIES || [],
    };
}

// 🔴 THE ADMIN FILTER IS PART OF THE SHAPE, NOT A DETAIL. computeUsageStats matches isAdmin:false, so byCommand and `current` describe the SAME population. Folding every fixture row in while taking `current` from adminSplit.product mixed two populations, and the page showed per-command shares of a smaller total: 38 + 30 + 23 + 19 + 17 … summing far past 100%. Production cannot produce that, so a stub that does is teaching the reviewer a defect the code does not have. The command list is the fixtures' own, which the mockup uses for exactly this filter.
const ADMIN_COMMANDS = ['mng', 'bot', 'manage', 'add', 'edit', 'autobuild'];

// $group by command, exactly as computeUsageStats does — summing the fixtures' subcommand rows rather than listing them.
function foldByCommand(cmdStats, { product = false } = {}) {
    const m = new Map();
    for (const c of cmdStats || []) {
        if (product && ADMIN_COMMANDS.includes(c.command)) continue;
        const k = c.command || '?';
        const prev = m.get(k) || { _id: k, c: 0, ok: 0, bg: 0, dur: 0, ack: 0, rows: 0 };
        prev.c += c.n || 0; prev.ok += c.ok || 0; prev.rows += 1;
        // The fixtures have no entry column per command row, so a zero-ack row stands in for a background job — those never answered an interaction, which is exactly what ack 0 means and why the mockup's own command drawer says so.
        prev.bg += (c.ack === 0 ? (c.n || 0) : 0);
        prev.dur = Math.max(prev.dur, c.dur || 0); prev.ack = Math.max(prev.ack, c.ack || 0);
        m.set(k, prev);
    }
    return [...m.values()].sort((a, b) => b.c - a.c);
}

function usageStatsShape(F_) {
    const folded = foldByCommand(F_.cmdStats, { product: true });
    const current = (F_.adminSplit || {}).product || folded.reduce((a, c) => a + c.c, 0);
    return {
        current,
        // No previous-window figure exists in the fixtures, so one is derived deterministically. It is a FIXTURE, invented like every other number in this file — it exists so the delta line has something to render, not because anybody measured it.
        previous: Math.round(current * 0.82),
        byCommand: folded.map((c) => ({ _id: c._id, c: c.c, ok: c.ok, bg: c.bg })),
        byEntry: (F_.entryStats || []).map((e) => ({ _id: e.entry, c: e.n })),
        byOutcome: (F_.outcomeStats || []).map((o) => ({ _id: o.outcome, c: o.n })),
    };
}

function timingStatsShape(F_) {
    const folded = foldByCommand(F_.cmdStats);
    // $percentile returns an array per requested p, which is why the real overall carries [p50, p95] rather than two fields — a stub with two scalars would render and be the wrong shape.
    const at = (list, q) => (list.length ? list[Math.min(list.length - 1, Math.floor(list.length * q))] : null);
    const acks = folded.map((c) => c.ack).filter((n) => n > 0).sort((a, b) => a - b);
    const durs = folded.map((c) => c.dur).filter((n) => n > 0).sort((a, b) => a - b);
    return {
        overall: { ackP: [at(acks, 0.5), at(acks, 0.95)], durP: [at(durs, 0.5), at(durs, 0.95)] },
        byCommand: folded.filter((c) => c.dur > 0).map((c) => ({ _id: c._id, p: [c.dur], n: c.c })),
        byDep: (F_.depStats || []).map((d) => ({ _id: d.name, totalMs: d.ms, calls: d.calls })),
        // $bucket names its groups by the LOWER BOUNDARY, under `_id` — the fixtures call the same number `from`.
        ackBuckets: (F_.ackBuckets || []).map((b) => ({ _id: b.from, n: b.n })),
    };
}

// ⚠️ HALF THE LIVE ITEMS, NOT ALL OF THEM. A draft that is a perfect copy of live makes the Compare and the item count meaningless — every number matches and the surface demonstrates nothing. Taking a slice is what a half-built next season actually looks like.
function draftFixture() {
    const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    // ⚠️ FIX.draft EXISTS AND IS `active: false` — a real inactive subdocument, which is what the schema leaves behind after a discard and what the route faithfully returns. The first version of this force-activated it, so the draft bar rendered "untitled · 0 items" on every load with no flag set: the exact case this file's own test calls out, that an inactive draft object is not a draft. Passed through unchanged unless the flag asks for one.
    if (params.get('draft') !== '1') return FIX.draft || null;
    const half = (a) => (a || []).slice(0, Math.ceil((a || []).length / 2));
    return {
        active: true,
        currentSeasonTitle: 'Season 8 — Unnamed',
        newDraws: half(FIX.newDraws), returningDraws: half(FIX.returningDraws), calendar: half(FIX.calendar),
    };
}

// A static stand-in for buildLoadoutCard()'s real Components V2 JSON, so the Armory's LIVE PREVIEW panel exercises portal/ui/v2Render.js against a known shape with no server and no auth.
//
// ⚠️ PRESERVED FROM AN EARLIER HARNESS THAT ONLY EXISTED IN BUILD OUTPUT. portal/public/review/ held a hand-written "Design Review Harness" doing much of what portal/ui/harness/ now does — untracked, generated by nothing, one `rm -rf portal/public` from gone, and invisible to every search that respects .gitignore. It was found only by looking at what the directory actually contained. This card was the one thing it had that this harness did not; the rest is superseded, so the duplicate was removed rather than left as a second answer to the same question.
const FIXTURE_CARD = { components: [
    { type: 17, accent_color: 0xF2C230, components: [
        { type: 10, content: '# AK-47\n🥇 Best AR' },
        { type: 14, spacing: 1, divider: true },
        { type: 10, content: '### Attachments\n• `Muzzle`\n• `Barrel`' },
        { type: 10, content: '### Gunsmith Code\n`6ZQ4-KP2M-VX90`' },
        { type: 12, items: [{ media: { url: 'https://res.cloudinary.com/dr6dn61eh/image/upload/f_auto,q_auto/ak47.webp' } }] },
        { type: 10, content: '-# AR • Build 1 of 3 • Updated <t:1755000000:D>' },
        { type: 14, spacing: 1, divider: true },
        { type: 1, components: [{ type: 2, label: 'Copy Attachments' }, { type: 2, label: 'Copy Code' }] },
    ] },
] };

// /api/review flattens open changesets to individual operations. FIX.sampleOps is the mockup's own staged set; its rows are [field, was, becomes] triples, while diffRows (portal/ui/board.logic.js) returns {key, from, to} — so they are converted here rather than teaching the component a second row shape. One op is marked stale, which is a real per-op state. 🔴 NEITHER PAYLOAD FABRICATES A TIER 3 ANY MORE — reviewPayload() stopped on 2026-09-02 and harnessChangesets() on 2026-09-03 09:03 EDT; until that second date the sentence below claimed both while only one was true. 🔴 IT NO LONGER FABRICATES A TIER 3, AND THAT WAS A REAL DEFECT RATHER THAN A HARMLESS PROP (2026-09-02 23:19 EDT). It typed the last op tier 3 so the export gate and the typed confirmation would render — but the tier is a property of the OP, derived from core/ops's registry, and `draw.delete` is tier 1 there because its inverse is exact. Production's /api/review takes the tier from validateSet, so it can NEVER show these four ops as tier 3: the harness was teaching a state the code cannot produce, which is the exact criticism this file applies to its own other stubs. It also made the seeded overlay unreadable — `shell.js`'s Store DERIVES the tier from FIX.OP_TIERS and refuses a claimed one, so the mockup showed tier 1 while this showed tier 3, and the whole tier-3 surface (gate line, export button, typed confirm, red chip, blocker count) reported as a design difference. ⚠️ THE COVERAGE IT PROVIDED IS NOT LOST, it moved somewhere stronger: `npm run portal:reviewwalk` drives a genuinely tier-3 op against the real server and asserts the gate closes, the reason is in words, and the commit is refused with 409. A fabricated fixture demonstrated the surface; the walk proves the behaviour. A states fixture is the right way to photograph it — filed.
function reviewPayload() {
    const src = window.FIX.sampleOps || [];
    const ops = src.map((o, i) => ({
        id: 'cs-' + i + ':0',
        changesetId: 'cs-' + i,
        index: 0,
        realm: o.realm || 'season',
        op: o.op || 'unknown',
        tier: (window.FIX.OP_TIERS && window.FIX.OP_TIERS[o.op]) || o.tier || 1,
        name: o.name,
        verb: o.verb || 'changed',
        rows: (o.rows || []).map((r) => ({ key: r[0], from: r[1], to: r[2] })),
        destroys: ((window.FIX.OP_TIERS && window.FIX.OP_TIERS[o.op]) || o.tier || 1) === 3,
        exported: false,
        exportedAt: null,
        stale: i === 1,
        staleChecked: true,
        blocked: null,
        confirmText: ('CS' + i).toUpperCase(),
    }));
    const changesets = ops.map((o) => ({
        id: o.changesetId, realm: o.realm, tier: o.tier, state: 'staged',
        exportedAt: null, confirmText: o.confirmText, opCount: 1,
        gate: { ok: o.tier !== 3, reason: o.tier === 3 ? 'export required' : null },
    }));
    return { ops, changesets };
}

// Staged changesets in the shape /api/changeset returns them — one per sample op, so the Board has columns with something in them and Season's staged panel has rows.
function harnessChangesets() {
    return (window.FIX.sampleOps || []).map((o, i) => ({
        // 🔴 DERIVED, NOT TYPED — and this line was MISSED when reviewPayload() was fixed on 2026-09-02, which is the instance-not-class error in the same session that cited a memory about it. The reader test found it. This feeds /api/changeset, so it is SEASON's Board and staged panel, not Review's: season.js:203 renders the tier chip and :1278 counts tier >= 3 as blocked. Typing a 3 onto draw.delete taught a state production cannot produce, on a realm already closed against this fixture. ⚠️ Season must be RE-MEASURED — filed. 2026-09-03 09:03 EDT.
        _id: 'cs-' + i, realm: o.realm || 'season',
        tier: (window.FIX.OP_TIERS && window.FIX.OP_TIERS[o.op || 'draw.edit']) || o.tier || 1,
        state: 'staged', ops: [{ type: o.op || 'draw.edit', target: null, payload: {} }],
        exportedAt: null, createdAt: new Date(Date.now() - i * 3600000).toISOString(),
    }));
}

const ROUTES = [
    [/^\/auth\/csrf$/, () => ({
        csrfToken: 'harness-csrf', discordId: FIX.OWNER_ID || '1139845545754632283',
        // D3 (2026-09-06): the identity the live /auth/csrf now carries. avatarHash stays null on purpose so the chip's INITIAL-LETTER fallback is what the harness exercises; the real-avatar path would fetch cdn.discordapp.com, which a fixture page must not.
        username: 'diorswrld', globalName: 'Dior', avatarHash: null,
        // The design's own viewer, so a conformance overlay compares composition rather than the difference between a fixture person and a real session. Same shape the live server would send if it carried a profile; it does not yet, and the chip falls back to the id when this is absent.
        displayName: 'dior',
        avatarUrl: 'https://cdn.discordapp.com/avatars/1139845545754632283/de36d1994e834cd75ac0b7bc3b66a6db.png?size=160',
        // ⚠️ SEPARATE FROM `owner`, and reachable on its own. ?destroy=1 lets the strip be seen by a NON-owner who holds the permission, which is the state that actually needed designing — the mockup's viewer is always the owner, so "present, legible and disabled with the reason stated" was undesignable until this existed.
        isOwner: owner, canDestroy: owner || params.get('destroy') === '1', visibleRealms: realms,
        // The account panel counts down to this. Fixed at seven and a bit hours out rather than derived from the clock, so the harness reads the same on every load and a screenshot of it is comparable to the last one — the whole point of a fixture.
        sessionExpiresAt: new Date(Date.now() + 7 * 3600e3 + 21 * 60e3).toISOString(),
    })],
    [/^\/api\/season$/, () => ({
        live: seasonLive(),
        // 🔴 THE FIXTURES CARRY NO DRAFT AT ALL, so `draft` was null on every load and the draft bar, the promote row and everything downstream of them were unrenderable — reviewed by nobody, because there was no way to put them on screen. ?draft=1 synthesises one from the live season, which is exactly how a real draft starts.
        draft: draftFixture(),
        grantedPages: ['season', 'draws', 'calendar', 'patchnotes'],
    })],
    [/^\/api\/armory$/, () => ({ builds: (FIX.builds || []).map(armoryBuild), grantedPages: ['loadouts'] })],
    // ⚠️ REAL TEXT, for the same reason the armory export emits it: the Export strip's claim is that what comes out is what the bot reads back, and a placeholder string demonstrates the layout while disproving the claim. Narrower than utils/adminParser.js on purpose — it reproduces each scope's SHAPE (comma line, prefixed bullet, keyed record) rather than its every edge case, and does not attempt formatAdminDate's vocabulary.
    [/^\/api\/season\/export$/, (params) => {
        const scope = params.get('scope');
        const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
        const md = (v) => (v ? `${new Date(v).getUTCMonth() + 1}/${new Date(v).getUTCDate()}` : '');
        if (scope === 'draws' || scope === 'returning') {
            const list = (scope === 'draws' ? FIX.newDraws : FIX.returningDraws) || [];
            return { count: list.length, text: list.map((d) => [d.title,
                (d.items || []).map((i) => `${i.tier || ''} ${i.name}`.trim()).join(', '), day(d.date), d.thumbnailUrl || ''].join(', ')).join('\n') };
        }
        if (scope === 'calendar') {
            const list = FIX.calendar || [];
            return { count: list.length, text: list.map((c) => `e• ${md(c.date)} - ${c.isOngoing ? 'All Season' : md(c.endDate || c.date)} | ${c.title}`).join('\n') };
        }
        if (scope === 'patchnotes') {
            const list = FIX.patchNotes || [];
            return { count: list.length, text: list.map((p) => [`Title: ${p.titleOverride || p.title}`,
                `Release Date: ${day(p.releaseDate)}`, `Description: ${p.description || '(none)'}`, 'URLs:',
                ...(p.images || []).map((u) => `  ${u}`)].join('\n')).join('\n\n') };
        }
        if (scope === 'all') {
            const rows = [];
            for (const d of FIX.newDraws || []) rows.push([d.title, 'New draw', day(d.date), day(d.date)]);
            for (const d of FIX.returningDraws || []) rows.push([d.title, 'Returning draw', day(d.date), day(d.date)]);
            for (const c of FIX.calendar || []) {
                const k = String(c.category || 'event').toLowerCase();
                rows.push([c.title, k === 'playlist' ? 'Playlist' : k === 'draw' ? 'Draw window' : 'Event',
                    day(c.date || c.startDate), c.isOngoing ? 'all season' : day(c.endDate || c.date)]);
            }
            for (const p of FIX.patchNotes || []) rows.push([p.titleOverride || p.title, 'Patch note', day(p.releaseDate), day(p.releaseDate)]);
            return { count: rows.length, text: [['Item', 'Type', 'Starts', 'Ends'].join('\t')].concat(rows.map((r) => r.join('\t'))).join('\n') };
        }
        return { error: 'export needs one of: draws, returning, calendar, patchnotes, all' };
    }],
    // ⚠️ REAL TEXT AND REAL CSV, for the reason the two exports above already give: a placeholder demonstrates the layout while disproving the claim the strip makes about what comes out. Each of the three reproduces its route's SHAPE -- blocks for prose, a header row plus quoting for a table -- against the same fixtures the panels beside them are drawing.
    [/^\/api\/broadcast\/export$/, (params) => {
        const scope = params.get('scope');
        if (scope !== 'live' && scope !== 'all') return { error: 'export needs one of: live, all' };
        const now = Date.now();
        const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
        const state = (a) => (a.expiresAt && new Date(a.expiresAt) <= now ? 'expired'
            : a.startsAt && new Date(a.startsAt) > now ? 'scheduled' : 'live');
        const all = (FIX.announcements || []).map((a) => ({ ...a, state: state(a) }));
        const list = scope === 'live' ? all.filter((a) => a.state === 'live') : all;
        const text = list.map((a) => [`[${a.state}] posted ${day(a.createdAt)}`,
            `starts ${day(a.startsAt)}  ends ${a.expiresAt ? day(a.expiresAt) : 'never'}`, a.text].join('\n')).join('\n\n');
        return { text: text, count: list.length };
    }],
    [/^\/api\/access\/export$/, (params) => {
        const scope = params.get('scope');
        const cell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
        const admins = FIX.accessAdmins || [];
        if (scope === 'admins') {
            const text = admins.map((a) => [a.discordId + (a.note ? `  (${a.note})` : ''),
                `granted ${(a.grantedAt || '').slice(0, 10) || '—'} by ${a.grantedBy || '—'}`,
                (a.permissions || []).join(', ') || '(none)'].join('\n')).join('\n\n');
            return { text: text, count: admins.length };
        }
        if (scope === 'matrix') {
            const scopes = [...new Set(admins.flatMap((a) => a.permissions || []))].sort();
            const head = ['Admin', 'Note', ...scopes].map(cell).join(',');
            const body = admins.map((a) => [a.discordId, a.note || '',
                ...scopes.map((k) => ((a.permissions || []).includes(k) ? 'direct' : ''))].map(cell).join(',')).join('\n');
            return { text: admins.length ? head + '\n' + body : head, count: admins.length };
        }
        if (scope === 'sessions') {
            const rows = FIX.sessions || [];
            const head = ['Admin', 'Signed in', 'Last seen', 'Expires'].join(',');
            const body = rows.map((r) => [r.discordId, r.createdAt, r.lastSeenAt, r.expiresAt].map(cell).join(',')).join('\n');
            return { text: rows.length ? head + '\n' + body : head, count: rows.length };
        }
        return { error: 'export needs one of: admins, matrix, sessions' };
    }],
    [/^\/api\/analytics\/export$/, (params) => {
        const scope = params.get('scope');
        const F_ = FIX;
        const cell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
        // ⚠️ EVERY BRANCH RETURNS AN EXPLICIT `{ text, count }` LITERAL. portalHarness.test.js reads this file as SOURCE and matches key names against what the real route's sendJson promises, so a helper returning the object is invisible to it -- the same shape of gate that refused a csvScope() factory in analytics.js. `csv` builds the STRING; the keys stay here.
        const csv = (cols, rows, get) => {
            const head = cols.map(cell).join(',');
            const body = rows.map((r) => get(r).map(cell).join(',')).join('\n');
            return rows.length ? head + '\n' + body : head;
        };
        if (scope === 'events') { const rows = F_.river || [];
            return { text: csv(['When', 'Kind', 'Level', 'Title', 'Detail', 'Host'], rows, (r) => [r.at || r.createdAt, r.kind, r.level, r.title, r.detail, r.host]), count: rows.length }; }
        if (scope === 'usage') { const rows = F_.usageByCommand || [];
            return { text: csv(['Command', 'Uses', 'Succeeded', 'Background'], rows, (r) => [r._id, r.c, r.ok, r.bg]), count: rows.length }; }
        if (scope === 'timing') { const rows = F_.timingByCommand || [];
            return { text: csv(['Command', 'Calls', 'Median ms', 'Worst ms'], rows, (r) => [r._id, r.n, (r.p || [])[0], Math.max(0, ...(r.p || []))]), count: rows.length }; }
        if (scope === 'reach') { const rows = F_.reachStats || [];
            return { text: csv(['Where', 'Install', 'Interactions'], rows, (r) => [r.context, r.installType, r.n]), count: rows.length }; }
        if (scope === 'searches') { const rows = F_.searchTerms || [];
            return { text: csv(['Term', 'Command', 'Field', 'Searches', 'Zero results', 'Picked'], rows, (r) => [r.term, r.command, r.field, r.searches, r.zeroResults, r.picked]), count: rows.length }; }
        return { error: 'export needs one of: events, usage, timing, reach, searches' };
    }],
    // 🔴 THE PREVIEW HAS TO BE OF THE BUILD THAT WAS ASKED FOR. This returned ONE fixed card for every id, which is invisible on the single-row preview panel — one card, one selection, nothing to compare it against — and became obvious the moment Compare put two of them side by side: two chips reading ".50 GS" above two cards both reading "AK-47". A stub that answers the same thing to every question is a stub that cannot demonstrate the feature it is standing in for.
    [/^\/api\/armory\/preview/, (params) => {
        // 🔴 THE RAW FIXTURES CARRY `id`, NOT `_id` — armoryBuild() is what normalises them, and this route searched the un-normalised array. So `String(b._id)` was the string "undefined" for every build, matched the real ObjectId the component sends for none of them, and every single row fell through to the generic FIXTURE_CARD below. The Live Preview panel showed the same AK-47 card whichever build you opened, which is worse than not rendering: it renders, it looks right, and it is about a different weapon. Found 2026-08-27 by opening the panel and reading the card against the editor beside it.
        const wanted = params.get('id');
        const build = (FIX.builds || []).find((b) => String(b._id || b.id) === wanted);
        if (!build) return { card: FIXTURE_CARD };
        // The real route runs the bot's own buildLoadoutCard; this reshapes the fixture card's own components so the shape stays honest and only the fields that identify the build change.
        const card = JSON.parse(JSON.stringify(FIXTURE_CARD));
        const container = (card.components || []).find((c) => c.type === 17);
        const text = container && (container.components || []).find((c) => c.type === 10);
        if (text) {
            text.content = `# ${build.weaponName}\n### ${build.buildName || 'Build'}\n`
                + (build.attachments || []).map((a) => `- ${a}`).join('\n')
                + (build.shareCode ? `\n-# ${build.shareCode}` : '');
        }
        if (container && build.accent) container.accent_color = parseInt(String(build.accent).replace('#', ''), 16);
        return { card };
    }],
    // 🔴 THE HARNESS EXPORTS REAL TEXT NOW, because the Bulk view's whole claim is that the export round-trips through the paste box — and a placeholder string proves the layout while disproving nothing. This mirrors utils/adminParser.js's formatLoadoutsAsBulkText field for field; the round trip is checkable in the harness by copying the output into the paste box and pressing Preview.
    [/^\/api\/armory\/export/, (params) => {
        // ⚠️ `params` IS A URLSearchParams, NOT A PLAIN OBJECT — `params.mode` is always undefined, and the first version of this read it that way. The export then ignored the mode entirely: the button offered "All 125 MP builds" and the panel answered with 133, the whole fixture set. Caught by opening the page, not by the suite, which never exercises the stub.
        const ids = String(params.get('ids') || '').split(',').filter(Boolean);
        const mode = params.get('mode') || null;
        const cat = (params.get('category') || '').toUpperCase();
        const all = (FIX.builds || []);
        const list = ids.length
            ? all.filter((b) => ids.includes(String(b._id)))
            : all.filter((b) => (!mode || b.mode === mode) && (!cat || String(b.category).toUpperCase() === cat));
        const text = list.map((l) => {
            const badges = [l.isMeta ? 'meta' : null, l.categoryRank,
                l.dmzRangeRank ? String(l.dmzRangeRank).replace('-', '') : null, l.isToxic ? 'toxic' : null].filter(Boolean).join(', ');
            const lines = [`${l.weaponName} | ${l.category}`];
            if (l.buildName) lines.push(`Build: ${l.buildName}`);
            if (l.imageKey && !String(l.imageKey).startsWith('http')) lines.push(`Image: ${l.imageKey}`);
            if (l.shareCode) lines.push(`Code: ${l.shareCode}`);
            if (badges) lines.push(`Badges: ${badges}`);
            lines.push(...(l.attachments || []).map((a) => `- ${a}`));
            return lines.join('\n');
        }).join('\n\n');
        return { text, count: list.length };
    }],

    // ⚠️ NARROWER THAN THE REAL PARSER, AND THE NARROWING IS NAMED. This reproduces the block grammar exactly — blank-line separated blocks, a "Weapon | Category" header, Build/Image/Code/Badges keyed lines, everything else an attachment — because that is what the preview demonstrates. It does NOT reproduce parseLoadoutBadges' token vocabulary, so an unrecognised badge token produces no warning here and does in production; a stub that half-implements a validator teaches a grammar the product does not have.
    [/^\/api\/parse-bulk\/loadout$/, (params, body) => {
        const mode = (body && body.mode) === 'DMZ' ? 'DMZ' : 'MP';
        const KEYS = { build: 'buildName', image: 'imageKey', code: 'shareCode', badges: 'badges' };
        const blocks = String((body && body.text) || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
        const rows = []; const errors = [];
        for (const block of blocks) {
            const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
            const head = lines[0];
            const snippet = head.length > 60 ? `${head.slice(0, 60)}...` : head;
            const parts = head.split('|').map((x) => x.trim());
            while (parts.length > 2 && parts[parts.length - 1] === '') parts.pop();
            if (parts.length > 2) { errors.push(`"${snippet}" -- that looks like the OLD pipe format. The first line is now just "Weapon | Category".`); continue; }
            if (!parts[0] || !parts[1]) { errors.push(`"${snippet}" -- a block's first line must be "Weapon | Category", and both halves are required.`); continue; }
            const fields = {}; const attachments = []; let badKey = null;
            for (const line of lines.slice(1)) {
                if (/^[-*•]\s+/.test(line)) { attachments.push(line.replace(/^[-*•]\s+/, '').trim()); continue; }
                const keyed = /^([A-Za-z ]+):\s*(.*)$/.exec(line);
                if (!keyed) { attachments.push(line); continue; }
                const key = keyed[1].trim().toLowerCase();
                if (!Object.prototype.hasOwnProperty.call(KEYS, key)) { badKey = keyed[1].trim(); break; }
                fields[KEYS[key]] = keyed[2].trim();
            }
            if (badKey) { errors.push(`"${snippet}" -- unrecognized field "${badKey}:". Valid fields are Build, Image, Code and Badges.`); continue; }
            const atts = attachments.filter(Boolean);
            if (!atts.length) { errors.push(`"${snippet}" -- no attachment lines found under the header`); continue; }
            const weaponKey = parts[0].toLowerCase().replace(/\s+/g, '');
            const buildName = fields.buildName || 'Standard Build';
            rows.push({
                weaponName: parts[0], buildName, category: parts[1].toUpperCase(), attachments: atts.length,
                imageKey: fields.imageKey || '', shareCode: fields.shareCode || '',
                existing: (FIX.builds || []).some((b) => b.mode === mode
                    && String(b.weaponName).toLowerCase().replace(/\s+/g, '') === weaponKey
                    && (b.buildName || 'Standard Build') === buildName),
            });
        }
        return { mode, blocks: blocks.length, rows, errors };
    }],
    [/^\/api\/broadcast$/, () => ({
        // 🔴 `state`, NOT `active`. The route's own announcementState() is the one place an announcement's state is decided, and the counts in the masthead already read it — filtering on a different field here put FOUR cards under a "Now showing" heading beside a masthead reading LIVE 2. One quantity, two authorities, on the same screen: the exact defect this project keeps paying for, reproduced in the instrument rather than the product.
        live: (FIX.announcements || []).filter((a) => a.state === 'live'),
        all: FIX.announcements || [],
        // ⚠️ ONE, NOT TEN, and that is the point of a fixture. Discord's real cap is 10 and the route sends utils/announcement.js's own constant; with four fixture announcements a cap of 10 renders the over-cap state ZERO times, so the harness would show a panel that cannot demonstrate the one fact it was rebuilt to show. A fixture exists to reach the states real data does not happen to be in today. 🔴 THE DEMO OVERRIDE IS OFF UNDER ?fresh=1. A fixture exists to reach states real data is not in today, which is why this is 1 rather than Discord's real 10 — with four announcements a cap of 10 renders the over-cap state zero times. But an OVERLAY run compares this page against the mockup, and the mockup uses the real cap, so the deliberate demo divergence becomes a false difference worth 800 vertical pixels: the portal drew one preview card where the design draws two. `?fresh=1` turns every such override off, and this is the register of them — anything added here must answer to it.
        maxPerMessage: FRESH ? 10 : 1,
    })],
    // 🔴 THE FIXTURE HAS NO SESSIONS, so the sessions view could only ever show its empty state — and a surface a reviewer cannot see is one nobody reviews. The live/stale distinction is the whole point of this panel (a browser session has no logout event, so "signed in now" is derived from lastSeenAt inside fifteen minutes), and it takes two rows on opposite sides of that line to show it at all. ⚠️ Synthesised relative to NOW rather than pinned to a date: a fixture timestamp from last week would read as stale forever and the live half would never render.
    [/^\/api\/access$/, () => ({
        admins: FIX.accessAdmins || [], sessionTtlHours: 12, sessions: (FIX.sessions && FIX.sessions.length) ? FIX.sessions : [
            { sessionHash: 'harness-live', discordId: '1139845545754632283', userAgent: 'Chrome on macOS',
              lastSeenAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
            { sessionHash: 'harness-stale', discordId: '310361322000000000', userAgent: 'Safari on iPhone',
              lastSeenAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
        ],
        singlePointsOfFailure: FIX.spof || FIX.SPOF || [],
    })],
    // 🔴 THE FIXTURE PREDATES THE `realm` FIELD, AND THE GRID READS ITS COLOUR FROM IT. Without this the harness rendered twelve identical grey columns while production renders them tinted by the realm each scope governs — the instrument showing a duller page than the product, which is the harder direction to notice. The mapping is the route's own (portal/api/realmAccess.js's realmForScope), reproduced here rather than imported because the stub runs in the browser.
    [/^\/api\/access\/matrix$/, () => {
        const REALM = {
            bot: 'analytics', autobuild: 'armory',
            'manage.draws': 'season', 'manage.calendar': 'season', 'manage.patchnotes': 'season',
            'manage.seasondraft': 'season', 'manage.season': 'season',
            'manage.loadouts_mp': 'armory', 'manage.loadouts_dmz': 'armory',
            'manage.announcement': 'broadcast',
        };
        const scopes = (FIX.accessScopes || FIX.SCOPES || []).map((s) => ({ ...s, realm: s.realm || REALM[s.key] || null }));
        return { scopes, admins: FIX.accessAdmins || [] };
    }],
    // ⚠️ THE FLAG CHANGES THE NUMBERS HERE TOO, or the toggle is a control that visibly does nothing — which is the exact defect class this branch has spent its life finding. The real route re-runs the aggregations with `isAdmin` unfiltered; the harness cannot, so it scales the two counts by a fixed fraction and says so. It demonstrates that the control reaches the server and the page re-reads; it does not claim to be the real ratio.
    [/^\/api\/analytics$/, (params) => {
        const payload = analyticsPayload();
        if (params.get('admin') !== '1') return payload;
        const bump = (n) => Math.round((n || 0) * 1.34);
        return { ...payload,
            health: { ...payload.health, commands24h: bump(payload.health.commands24h) },
            usageStats: { ...payload.usageStats, current: bump(payload.usageStats.current) } };
    }],
    // 🔴 THE HARNESS MUST PARSE DATES TOO, or the composer's echo reads "not a date yet" for every value and the one thing that surface exists to demonstrate cannot be seen. The real route calls the bot's chrono parser; this understands only what a fixture needs to show — an ISO day, and the two relative forms the placeholder itself suggests. ⚠️ It is deliberately NARROWER than chrono rather than a second attempt at it: a stub that half-implements a parser teaches the reviewer a grammar the product does not have. ⚠️ NARROWER THAN THE REAL PARSER ON PURPOSE, same as parse-date above: this understands the two shapes the placeholder itself suggests, so a reviewer can see the preview work without the stub teaching a grammar the product does not have. The real route runs utils/adminParser.js.
    [/^\/api\/parse-bulk$/, (params, body) => {
        const kind = (body && body.kind) || 'draw';
        const day = (d) => new Date(d).toISOString().slice(0, 10);
        const rows = String((body && body.text) || '').split('\n').map((raw) => {
            const line = raw.trim();
            if (!line) return null;
            const dash = line.split(/\s+[—-]\s+/);
            const parts = dash.length > 1 ? dash : line.split(',').map((p) => p.trim());
            const name = (parts.shift() || '').trim();
            const span = (parts.join(' ') || '').match(/(.+?)\s+to\s+(.+)/);
            // 🔴 `Date.parse` SAYS YES TO ALMOST ANYTHING. "with no date 2026 UTC" parses to January 1st, so a line the real parser would skip came back understood, with a date nobody typed — the stub teaching a behaviour the product does not have, which is the whole failure mode a fixture harness has. The candidate has to LOOK like a date before it is offered to the parser.
            const one = (v) => {
                const raw = String(v).trim();
                if (!/^(\d{1,2}[\/-]\d{1,2}|[a-z]{3,9}\.?\s+\d{1,2}|\d{1,2}\s+[a-z]{3,9})/i.test(raw)) return null;
                const t = Date.parse(raw + ' 2026 UTC');
                return Number.isFinite(t) ? day(t) : null;
            };
            const start = span ? one(span[1]) : one(parts[parts.length - 1] || '');
            const end = span ? one(span[2]) : start;
            return { name, start, end, ok: Boolean(name && start) };
        }).filter(Boolean);
        return { kind, rows };
    }],
    // 🔴 THE DRAWER'S TIER PREVIEW NEEDS THIS OR IT SHOWS ITS EMPTY STATE WITH TEXT IN THE BOX. Narrower than utils/adminParser.js on purpose, same as parse-date/parse-bulk: the four shorthands the placeholder itself teaches, so the stub cannot teach a grammar the product does not have. The Grant drawer's lookup (pin 32). A superset of both shapes the route can answer with — ok:true beside the found fields — so portalHarness.test.js's promise check is satisfied and access.js's `res.id` test takes the found branch. Any 17–20 digit id resolves to the fixture person, and the display name says so.
    [/^\/api\/discord\/user$/, (params) => ({ ok: true, reason: '', id: params.get('id') || '1139845545754632283', username: 'diorswrld', globalName: 'Dior (fixture)', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/3.png' })],
    [/^\/api\/parse-items$/, (params, body) => {
        const TIER = { m: 'mythic', l: 'legendary', lg: 'legacy', e: 'epic' };
        const items = []; const errors = [];
        String((body && body.text) || '').split('\n').forEach((raw, i) => {
            const line = raw.trim();
            if (!line) return;
            if (/^-#\s*/.test(line)) {
                const name = line.replace(/^-#\s*/, '');
                if (!name) { errors.push({ line: i + 1, text: line }); return; }
                items.push({ tier: 'comment', name });
                return;
            }
            const m = line.match(/^(\S+)\s+(.+)$/);
            items.push(m ? { tier: TIER[m[1].toLowerCase()] || m[1], name: m[2] } : { tier: 'epic', name: line });
        });
        return { items, errors };
    }],
    [/^\/api\/parse-date$/, (params) => {
        const q = (params.get('q') || '').trim().toLowerCase();
        const day = (d) => new Date(d).toISOString().slice(0, 10);
        const today = new Date((document.documentElement.dataset.today || new Date().toISOString().slice(0, 10)) + 'T12:00:00Z');
        let iso = null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(q)) iso = q;
        else if (q === 'today') iso = day(today);
        else if (q === 'tomorrow') iso = day(today.getTime() + 86400000);
        else {
            const rel = q.match(/^in (\d+) (day|week|month)s?$/);
            if (rel) iso = day(today.getTime() + Number(rel[1]) * { day: 1, week: 7, month: 30 }[rel[2]] * 86400000);
            else { const abs = Date.parse(q + ' 2026 UTC'); if (Number.isFinite(abs)) iso = day(abs); }
        }
        return { q, iso };
    }],
    [/^\/api\/review$/, () => reviewPayload()],
    // 🔴 BOTH FORMS, AND THE BARE ONE WAS MISSING. season.js fetches `/api/changeset?realm=season` and board.js fetches `/api/changeset/:id/preview`, but the route the API actually registers is `/^\/api\/changeset$/` — and with no stub for it the Board's own fetch fell through to the unrouted {ok:true} fallback, so `body.changesets` was undefined and the Board rendered empty all session while looking perfectly fine. Caught by scripts/portalHarness.test.js, which is the only thing that compares what the stub returns against what the route promises. 🔴 THE SAME PATH IS TWO ROUTES, AND THE STUB WAS ONLY EVER THE GET. `/api/changeset` is a GET that LISTS and a POST that STAGES, and this returned the list body for both — so every POST through composeClient.js's stageOps came back with no `changesetId`. Nothing rendered wrong, which is why it survived: stageOps ignored the body, so staging LOOKED fine. But `stageAndCommit` reads `staged.changesetId` and takes the "Could not stage the change." branch without it, so the Manifest's inline edit reported failure on every save in the harness, and the staged acknowledgement — which fires only on a real stage — could never fire either. Caught 2026-08-27 by wiring that acknowledgement and watching it not happen. ⚠️ portalHarness.test.js could not see it: it compares the keys a stub returns against the keys the route promises, and a route registered once for two methods has one set of keys to compare against. The `sent` argument is the only thing that distinguishes them here.
    [/^\/api\/changeset(\?|$)/, (params, sent) => (sent
        ? { changesetId: 'cs-new', state: 'staged', tier: (sent.ops && sent.ops[0] && sent.ops[0].tier) || 1, failures: [], preview: [] }
        : { changesets: freshFixtures ? [] : harnessChangesets() })],
    [/^\/api\/changeset\/[^/]+\/preview$/, () => ({ preview: null })],
];

// 🔴 A STATE NOTHING CAN PUT ON SCREEN IS A STATE NOBODY DESIGNS AND NO CHECK CAN OPEN. This package has learned that repeatedly — ?audit=1 went unrun for weeks, every hidden view was audited by nothing, and the owner-only refusal was undesignable until ?as= existed. Async is now the largest such surface in the portal, so it gets the same treatment: every failure mode is reachable from the address bar.
//
//   ?fail=500        every request answers 500        ?fail=/api/season  only that path fails
//   ?fail=offline    the connection never lands       ?fail=garbage      a 200 that is not JSON
//   ?fail=expired    the session is gone              ?slow=4000         every request takes that long
//
// ⚠️ The delay is applied to EVERY route including the ones that succeed, because "slow" is not a failure and the point is to see the is-slow note appear over data that then arrives.
const FAULT = (() => {
    const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    return { fail: q.get('fail'), slow: Number(q.get('slow')) || 0 };
})();

function faultFor(pathname) {
    const f = FAULT.fail;
    if (!f) return null;
    // A path-shaped value fails only that path, which is how a realm renders its failure while the rest of the app keeps working — the case a blanket switch cannot produce and the one that actually happens.
    if (f.startsWith('/')) return pathname === f ? { failed: true, status: 500, detail: 'Injected failure for ' + f } : null;
    if (f === 'offline') return { failed: true, offline: true, status: 0, detail: 'Injected: fetch never landed' };
    if (f === 'expired') return { signedOut: true };
    if (f === 'forbidden') return { forbidden: true };
    if (f === 'garbage') return { failed: true, unreadable: true, status: 200, detail: 'Injected: Unexpected token < in JSON at position 0' };
    return { failed: true, status: Number(f) || 500, detail: 'Injected HTTP ' + (Number(f) || 500) };
}

export async function fetchJson(path, opts) {
    // 🔴 MATCH ON THE PATH, NOT THE WHOLE URL, WHICH IS WHAT THE SERVER DOES. Every route regex here is anchored with `$`, and this used to test it against the raw argument — so the moment a caller passed a query string the regex stopped matching and the request fell through to the unrouted `{ok:true}` branch. `/api/parse-date?q=in+3+weeks` did exactly that: the composer's date echo read "not a date yet" for every value, which looks like a parser that cannot parse rather than a route that was never reached. ⚠️ `portalHarness.test.js` could not see it either — that gate compares the KEYS a stub returns against the keys the real route promises, and a route whose regex never matches still has the right keys.
    const [pathname, query = ''] = String(path).split('?');
    if (FAULT.slow) await new Promise((r) => setTimeout(r, FAULT.slow));
    const fault = faultFor(pathname);
    if (fault) {
        console.warn('[harness] INJECTED FAULT', (opts && opts.method) || 'GET', path, fault);
        await new Promise((r) => setTimeout(r, 0));
        return fault;
    }
    for (const [re, make] of ROUTES) {
        if (re.test(pathname)) {
            // A POST route needs what was posted; a GET route ignores the second argument. Parsed here rather than in each route so a stub cannot forget it.
            let sent = null;
            try { sent = opts && opts.body ? JSON.parse(opts.body) : null; } catch (e) { sent = null; }
            const body = make(query ? new URLSearchParams(query) : new URLSearchParams(), sent);
            // Same the real client returns, including the async boundary — a component that renders correctly only because the harness resolved synchronously would be a lie.
            await new Promise((r) => setTimeout(r, 0));
            console.log('[harness]', (opts && opts.method) || 'GET', path, body);
            return body;
        }
    }
    // A POST the harness has no route for is an ACCEPTED no-op, not a 404: every mutation in this portal goes through the changeset flow, and refusing them would make the compose surfaces untestable for exactly the wrong reason.
    console.warn('[harness] unrouted', (opts && opts.method) || 'GET', path, '→ {ok:true}');
    await new Promise((r) => setTimeout(r, 0));
    return { ok: true };
}
