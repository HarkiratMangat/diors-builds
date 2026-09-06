// portal/ui/home.js — ESM. Home: what needs you.
//
// 🔴 EVERY NUMBER HERE IS DERIVED FROM THE SAME ENDPOINTS THE REALM PAGES USE, and that is the whole design rule rather than an implementation convenience. A home screen that counts rows with its own query is a home screen that can disagree with the page it links to — you read "3 flagged" here, open Armory, and find four. So Home fetches the realms' own endpoints and applies the realms' own predicates; it adds no server route and no second source of truth.
//
// ⚠️ THE MASTHEAD FIGURES DO NOT REPEAT THE RAIL. The masthead answers WHAT IS THE STATE; the rail answers WHERE DO I GO and carries no counts at all. Putting a figure on both rebuilds the cards-versus-list defect one level up.
import { h } from '../vendor/preact.mjs';
import { html } from '../vendor/htm-preact.mjs';
import { useState, useEffect } from '../vendor/preact-hooks.mjs';
import { Shell, NoAccess, Masthead } from './shell.js';
import { fetchJson } from './httpClient.js';
import { useAsync, RealmShell } from './async.js';
// The clock FACE is Season's, imported rather than transcribed — see its header for the copy this replaced.
import { ClockFace, seasonRepairCount, seasonConflictCount, seasonLastDeadline } from './season.js';
// Armory's own fault-versus-age split, imported rather than restated — see the attention row that uses it.
import { splitCoverage } from './armory.js';

const dayOf = (v) => String(v || '').slice(0, 10);
const fmtDay = (iso) => new Date(dayOf(iso) + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dday = (from, to) => Math.round((new Date(dayOf(to) + 'T00:00:00Z') - new Date(dayOf(from) + 'T00:00:00Z')) / 86400000);
const todayIso = () => (typeof document !== 'undefined' && document.documentElement.dataset.today)
    || new Date().toISOString().slice(0, 10);

// The masthead's fourth figure, reduced to a pure function so scripts/home*.test.js can exercise both edges without a DOM: a season with every deadline TBD or unset (seasonLastDeadline returns '') is `null`, never a stray number, and a deadline already in the past clamps to 0 rather than going negative — the same convention season.logic.js's countdownParts already uses for "today or past" elsewhere on this page. Exported for the test file; nothing else in this realm calls it from outside HomeRealm.
export function seasonDaysLeft(season, today) {
    const iso = seasonLastDeadline(season);
    if (!iso) return null;
    return Math.max(0, dday(today, iso));
}

// Every dated thing in the season as ONE list, which is what both clock columns read. The realms keep their arrays separate because each has its own schema; Home only ever asks "when".
function seasonItems(live) {
    if (!live) return [];
    const out = [];
    for (const [key, lane] of [['newDraws', 'draw'], ['returningDraws', 'returning']]) {
        for (const d of live[key] || []) out.push({ lane, title: d.title, start: dayOf(d.date), end: dayOf(d.date) });
    }
    for (const c of live.calendar || []) {
        // 🔴 TWO BUGS THE REST OF THE PORTAL HAD ALREADY FIXED AND THIS COPY HAD NOT. ① `isOngoing` is how the calendar says a row runs until the SEASON does — commands/calendar.js's own
        //    isEventEnded reads it that way — and falling back to `c.date` collapsed an all-season row to a single
        //    day. So a row live all season was absent from "Running right now" on every day but its first, and
        //    Home's "N more running" read one short of the design's on the same fixtures. season.js's toTrackItems
        //    header records the identical defect on the Track, where it drew an all-season window as a dot.
        // ② The calendar has THREE categories, not two: `draw` is a DRAW WINDOW. `!isPlaylist` is not "is an event",
        //    so every window landed in the Events lane wearing the Events colour — the same one-category-short fix
        //    season.logic.js's calCategoryOf exists to make impossible. Read that table rather than re-testing here.
        // ⚠️ `calCategoryOf` IS A BARE GLOBAL AND MUST STAY ONE. It is declared in `season.logic.js`, which `scripts/buildPortal.js` injects as a CLASSIC script before the module graph evaluates — it exports nothing. `import { calCategoryOf } from './season.logic.js'` is valid module syntax, passes every parse check, and throws "does not provide an export named" at load, blanking the page; `season.js`'s header records that shipping once. `assertNoLogicImport` catches it at build time, but the sentence above names the file, which reads like an invitation. Flagged 2026-09-03 23:26 EDT by the §L ⑥ agent as a comprehension hazard rather than a live bug.
        const cat = calCategoryOf(c);
        out.push({ lane: cat.lane, accent: `var(${cat.topic})`, title: c.title, start: dayOf(c.date),
                   // 🔴 THE FALLBACK IS THE SEASON'S LAST DEADLINE, NOT `bpEnd`, AND THAT MATTERS ON THE REAL DATABASE. `season.js` records that the dev document has `bpEnd` UNSET; keyed on `bpEnd` alone this ternary fell straight through to `c.date` there, collapsing an all-season row back to a single day — the exact defect this line was added to fix, silently, only in the one environment nobody had measured. §L ⑤ has never run on Home. Flagged 2026-09-03 23:26 EDT by the §L ⑥ agent. `seasonLastDeadline` reads all three lines and returns '' only when every one is unset or TBD, which is the honest "the season has no end" case.
                   end: dayOf(c.endDate || (c.isOngoing && (live.bpEnd || seasonLastDeadline(live)) ? (live.bpEnd || seasonLastDeadline(live)) : c.date)) });
    }
    return out;
}

const LANE_ACCENT = { draw: 'var(--draw)', returning: 'var(--ret)', event: 'var(--ev)', playlist: 'var(--play)' };

// ── THE ATTENTION LIST ────────────────────────────────────────────────────────────────────────
//
// Each row states the ONE thing in a realm that currently wants a person, and links to it. A dashboard that only counts rows makes you open all five realms to find out whether anything is wrong.
//
// 🔴 SEVERITY IS A PROPERTY OF THE KIND, NOT OF THE COUNT (COMPANION §5.9f.1). Thirty-three builds needing a caption is not more urgent than one scope only one person can use; the count only breaks ties. The portal emitted `kind:'warn'` on every row — one weight, three rows — so the ladder existed in the stylesheet (`.s-conflict` `.s-spof` `.s-error` `.s-repair` `.s-forever`) with nothing ever wearing four of its five rungs, and Access and Analytics were never asked whether anything was wrong with them at all.
const SEV = { conflict: 95, spof: 90, error: 80, repair: 60, forever: 50 };

// 🔴 STAGED WORK IS DELIBERATELY NOT ON THIS LIST, and that is the fix rather than an omission. Measured 2026-08-27: the staged count appeared THREE times on Home inside 500px — the masthead figure, an entry here, and the staged bar 16px below that entry saying the same sentence with more in it. COMPANION §16.6 warns about exactly this shape: "a third copy of a fact stated above it". It also corrects the LEAD figure: this list is EXCEPTIONS — things that are WRONG — and `needs you` counts its rows, so counting a queue here inflated the one number the page is named after.
//
// ⚠️ READ EACH REALM'S OWN DERIVATION, NEVER A SECOND COPY OF IT. The mockup records this failing twice from opposite directions: Home once said "133 builds · 33 need repair" where Armory said "31 · 28", and later "117 need repair" where Armory said 11 — the second time while already reading a shared figure that did not carry Armory's own stale-versus-broken split. So the season findings come from `seasonRepairCount`, which is Season's own Repairs panel summed, and the single points of failure come from the server's `singlePointsOfFailure`, never from counting the matrix again here. 🔴 A DERIVATION THAT THROWS HERE TAKES THE WHOLE PAGE DOWN, and this function grew three new ones in one change. `useAsync` wraps the FETCH, not the RENDER — `attentionRows` runs inside `HomeRealm`'s body, so an exception in `seasonRepairCount` (which walks every calendar row through `findExpiringBanners`) or in `seasonConflictCount` is an unmounted component and a blank console, not a missing row. Home is also the one realm that reads five OTHER realms' data, so it is the page most exposed to one of them being shaped unexpectedly. A row that cannot be computed is dropped and the rest of the list still renders, which is the same judgement `async.js` already makes for a realm the admin cannot see.
const safeRow = (label, fn, fallback) => { try { return fn(); } catch (e) { console.warn(`home: ${label} row skipped —`, e); return fallback; } };

function attentionRows({ season, armory, broadcast, access, matrix, analytics, today }) {
    const out = [];
    const push = (kind, realm, href, text, n, act, of) => out.push({ sev: SEV[kind], kind, realm, href, text, n, act, of });
    const live = season?.live;
    // 🔴 THE POPULATION INCLUDES PATCH NOTES AND `seasonItems` DELIBERATELY DOES NOT. The design's season rows read "16 of 39"; this read "16 of 37", and the two missing rows are the season's patch notes. `seasonItems` is also what LiveNow and the clock columns iterate, and a patch note must never enter those — it is a PUBLICATION, not a state with a duration, which is why `track.js` keeps it off an axis whose every other lane answers "when is this ON?". So the denominator is widened here rather than the list. ⚠️ The design's own Repairs checks never examine a patch note either, so 39 is a scale reference for "how much season is there", not a checked set.
    const items = seasonItems(live);
    const seasonPopulation = items.length + ((live?.patchNotes || []).length);

    // 🔴 THE SEASON'S LAST DEADLINE, NOT THE BATTLE PASS. `bpEnd` is the FIRST of three lines, so an item that outlives the season outlives all of them. This row read `bpEnd` while Track's own strip had already been corrected off that edge for exactly this reason (see its header) — one surface fixed, the other left asking a narrower question under the same words.
    const conflicts = safeRow('conflict', () => seasonConflictCount(live), 0);
    if (conflicts) {
        push('conflict', 'Season', '#/season',
            `${conflicts} item${conflicts === 1 ? '' : 's'} run past the season's own deadlines`,
            conflicts, 'the Track', seasonPopulation);
    }

    const spof = (access?.singlePointsOfFailure || []).length;
    if (spof) {
        push('spof', 'Access', '#/access',
            `${spof} permission${spof === 1 ? '' : 's'} held by exactly one person`,
            spof, 'the matrix', (matrix?.scopes || []).length);
    }

    // "Pinged" is the design's word and it is a real distinction: portal/api/analytics.js folds each level into `{n, pinged, silent}`, and a silent error never reached anybody. Falls back to the level total only when the split is absent.
    const errRow = (analytics?.health?.alertsByLevel || []).find((a) => a.level === 'error');
    const errs = errRow ? (errRow.pinged ?? errRow.n ?? 0) : 0;
    if (errs) {
        push('error', 'Analytics', '#/analytics', `${errs} error${errs === 1 ? '' : 's'} pinged`,
            // 🔴 THE DENOMINATOR IS NOW THE SAME COLLECTION AND WINDOW AS THE NUMERATOR, AND IT WAS NOT. This read
        // `commands24h` — `AnalyticsEvent` over 24 HOURS — against a numerator counted from `AlertLog` over SEVEN DAYS, and rendered the pair as "23 of 496". N was not a subset of M and could exceed it: a fixture with no commands in 24h and one error alert renders "23 of 0". Every gate passed because the design renders the same string, so the two sides agreed about a number that means nothing. Found 2026-09-03 23:19 EDT by the §L ⑥ agent — the second live instance of the cross-surface class this Part filed, and the one with no comment admitting it.
        errs, 'Health', analytics?.health?.alerts7d ?? 0);
    }

    // ⚠️ ARMORY'S OWN `splitCoverage`, IMPORTED RATHER THAN RESTATED. `stale-90d` is age, not a fault — the realm separates them, and a row here that recombined them would report a different question's answer under Armory's words. This line held its own copy of that predicate until 2026-09-03 21:37 EDT; the copy happened to agree, which is the version of this bug that survives longest.
    //
    // 🔴 THE SCOPE STILL DIFFERS FROM ARMORY'S MASTHEAD AND THAT IS DELIBERATE, STATED HERE BECAUSE IT LOOKS LIKE THE DEFECT COMPANION RECORDS TWICE. Home counts EVERY build; Armory's masthead counts the mode you are looking at and opens on MP. Measured on the fixtures: 66 across both modes, 60 in MP, so six DMZ builds have faults that Armory's masthead cannot show and Home would otherwise hide. The design's Home counts all of them too — its `of` is ARMORY_COUNTS.total. A reader who clicks through therefore sees 60 where this said 66, which is a real question about Armory's masthead being mode-scoped rather than a licence for Home to under-report; filed.
    const flagged = safeRow('armory repair', () => (armory?.builds || []).filter((b) => splitCoverage(b).faults.length), []);
    if (flagged.length) {
        push('repair', 'Armory', '#/armory', `${flagged.length} build${flagged.length === 1 ? '' : 's'} need repair`,
            flagged.length, 'Repairs', (armory?.builds || []).length);
    }

    const findings = safeRow('season repair', () => seasonRepairCount(live), 0);
    if (findings) {
        push('repair', 'Season', '#/season', `${findings} season item${findings === 1 ? '' : 's'} to repair`,
            findings, 'Repairs', seasonPopulation);
    }

    // The real Broadcast finding is not a coverage gap — it is an announcement with no `expiresAt`, which never stops on its own.
    const forever = (broadcast?.all || []).filter((a) => a.state === 'live' && !a.expiresAt);
    if (forever.length) {
        // 🔴 ROUNDS THE REAL ELAPSED TIME, and this line truncated to calendar days until 2026-09-03 23:11 EDT — twenty lines below `endsIn`, which had been corrected for exactly this an hour earlier. `createdAt` is an INSTANT, so an announcement posted 19.6 days ago is "up 20d" to the design and was "up 19d" here. The fix was applied to the instance and not to the class; the region diff found the other half.
        const age = (a) => (a.createdAt
            ? Math.round((new Date(dayOf(today) + 'T00:00:00Z').getTime() - new Date(a.createdAt).getTime()) / 86400000) : 0);
        const oldest = Math.max(0, ...forever.map(age));
        push('forever', 'Broadcast', '#/broadcast',
            `${forever.length} announcement${forever.length === 1 ? '' : 's'} never end — oldest up ${oldest}d`,
            forever.length, 'Airtime', (broadcast?.all || []).filter((a) => a.state === 'live').length);
    }

    return out.sort((a, b) => b.sev - a.sev || b.n - a.n);
}

function AttentionList({ rows }) {
    if (!rows.length) {
        // An empty state that names what it MEANS, not "nothing here".
        return html`
            <div class="att-list" role="list">
                <div class="att-row clear" role="listitem">
                    <span class="att-i">✓</span><span class="att-b"></span>
                    <span class="att-x"><b>Nothing needs you right now.</b><em>Every realm matches what the bot is serving.</em></span>
                </div>
            </div>`;
    }
    // 🔴 A LIST ELEMENT, NOT AN <ol>. The rows are anchors, and an <ol> may only contain <li> — so `<ol><a>…</a></ol>` is invalid markup that announces a list with ZERO items, which is exactly what a screen reader got. It also made `portalRealWalk`'s past-the-door probe (`main li`) match nothing on Home, so §L ⑤ could not pass here for a reason that was never a Home defect. `.att-list` is `list-style:none;padding:0;display:flex`, so div + role is PIXEL-IDENTICAL to the <ol> it replaces. The mockup carries the same fix.
    return html`
        <div class="att-list" role="list">
            ${rows.map((a, i) => html`
                <a role="listitem" class=${`att-row s-${a.kind}`} href=${a.href} key=${a.text} style=${`--c:var(--r-${a.realm.toLowerCase()})`}>
                    <span class="att-i" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
                    <span class="att-b" aria-hidden="true"></span>
                    <span class="att-x"><b>${a.text}</b>${' '}<em>${a.realm} · ${a.act}</em></span>${' '}
                    <span class="att-go">
                        ${a.of ? html`<span class="att-sev">${a.n} of ${a.of}</span>` : null}
                        <span class="arw" aria-hidden="true">→</span>
                    </span>
                </a>`)}
        </div>`;
}

// 🔴 THE CLOCK EARNS ITS TWO LISTS HERE AND ONLY HERE. Harkirat: the ending/starting items are "a feature unique to the home page". Season's clock carries the time and the title and nothing else, because that page IS the season and the detail is one click away there. Home is the overview.
function HomeClock({ season, today }) {
    const [, setTick] = useState(0);
    const moments = seasonMoments(season, today);
    useEffect(() => {
        if (!moments.length) return undefined;
        const id = setInterval(() => setTick((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, [moments.length]);

    // ⚠️ ONBOARD, 2026-09-06 — both empty states now name the next action rather than leaving the reader to already know Season is where a deadline gets set. Home's build-out row asks for exactly this: an empty state carries a button/link to the realm that would fix it.
    if (!moments.length) return html`<section class="hclock"><span class="sc-none">No season deadline set. <a href="#/season">Set one in Season</a>.</span></section>`;
    const next = moments[0], rest = moments.slice(1);
    const p = countdownParts(next.iso, Date.now());
    if (!p || p.past) return html`<section class="hclock"><span class="sc-none">This season has ended. <a href="#/season">Start the next one in Season</a>.</span></section>`;

    const items = seasonItems(season);
    const upcoming = items.filter((i) => i.start > today && i.start <= next.iso).sort((a, b) => (a.start < b.start ? -1 : 1));
    const ending = items.filter((i) => i.end && i.start <= today && i.end >= today && i.end <= next.iso).sort((a, b) => (a.end < b.end ? -1 : 1));

    const rows = (list, dateOf) => list.slice(0, 4).map((i) => html`
        <div class="hc-r" key=${i.title} style=${`--c:${i.accent || LANE_ACCENT[i.lane] || 'var(--ink4)'}`}><i></i>
            <span class="n">${i.title}</span>
            <span class="w">${dday(today, dateOf(i)) === 0 ? 'today' : `in ${dday(today, dateOf(i))}d`}</span>
        </div>`);

    return html`
        <section class="hclock" aria-label="Season countdown">
            <div class="sclock hc-face" data-tier=${seasonTier(p.d)}>
                <${ClockFace} p=${p} />
                <div class="sc-when">${season?.currentSeasonTitle || 'This season'} · until <b>${fmtDay(next.iso)}</b></div>
                ${rest.length ? html`<div class="sc-then">then <b>${rest[0].lines.map((L) => L.label).join(' ')}</b> ${fmtDay(rest[0].iso)}</div>` : null}
            </div>
            <div class="hc-cols">
                <div class="hc-col">
                    <h3>Still to drop <b>${upcoming.length}</b></h3>
                    ${upcoming.length ? rows(upcoming, (i) => i.start) : html`<p class="hc-none">Nothing else releases before then.</p>`}
                    ${upcoming.length > 4 ? html`<p class="hc-more">${upcoming.length - 4} more</p>` : null}
                </div>
                <div class="hc-col">
                    <h3>Stops by then <b>${ending.length}</b></h3>
                    ${ending.length ? rows(ending, (i) => i.end) : html`<p class="hc-none">Nothing running ends before then.</p>`}
                    ${ending.length > 4 ? html`<p class="hc-more">${ending.length - 4} more</p>` : null}
                </div>
            </div>
        </section>`;
}

// 🔴 THE PORTAL'S ACTUAL SUBJECT, AND HOME DID NOT ANSWER IT. The attention list says what is WRONG and the clock says how long the season has; neither says what a player opening the bot this second would be shown. Those are three different questions and the third is the one the whole console exists to control.
//
// ⚠️ IT IS NOT A SECOND AUTHORITY OVER THE ATTENTION LIST. That list is EXCEPTIONS — things that want a person. This is CURRENT STATE, which is true and boring most days. Merging them would mean either the exceptions drown in routine rows or the routine rows get dressed as problems.
//
// ⚠️ AND IT RE-USES `seasonItems`, never its own filter. Home already learned this the expensive way in the mockup: two copies of one predicate on one page reported different numbers for the same collection, and the fix is that there is only ever one derivation to read. The design's own three rungs. The portal's version said "ends in 2d" where the design says "2 days left", and had no `ends tomorrow` at all — so the one day that most wants naming read as a number like every other day.
//
// 🔴 CALENDAR DAYS, AND THE DIFFERENCE FROM THE DESIGN IS CITED RATHER THAN AN OVERSIGHT. The design rounds ELAPSED TIME against midnight, and that is wrong at BOTH ends of its own range: measured 2026-09-03 23:19 EDT with today = 2026-08-24, an announcement expiring **today at 18:00** rounds to 1 and reads "ends tomorrow", and one that expired **yesterday at 18:00** rounds to 0 and reads "ends today". Any expiry past roughly midday is reported a day late, and an already-dead announcement is reported as live — on the panel whose entire subject is what players are being shown right now.
//
// ⚠️ THIS FILE HELD THE ROUNDING VERSION FOR ABOUT AN HOUR AND ITS COMMENT DEFENDED IT WITH ONE CASE — the 1.75-day example, where rounding is right — and never tested the two ends. A comment that argues from the middle of a range is how a range's edges go unexamined. Found by the §L ⑥ agent, not by me.
//
// The cost is one permanent region of the resting diff: the design says "2 days left" where this says "ends tomorrow" for a timestamped expiry.
const endsIn = (iso, today) => {
    const d = dday(today, dayOf(iso));
    if (d < 0) return 'ended';
    if (d === 0) return 'ends today';
    if (d === 1) return 'ends tomorrow';
    return `${d} days left`;
};

function LiveNow({ season, broadcast, today }) {
    const SHOW = 5;
    const items = seasonItems(season)
        .filter((i) => i.start <= today && (i.end || i.start) >= today)
        .sort((a, b) => ((a.end || a.start) < (b.end || b.start) ? -1 : 1));
    const anns = (broadcast?.live || []).length ? broadcast.live : (broadcast?.all || []).filter((a) => a.state === 'live');

    return html`
        <div class="hlive">
            <div class="lp">
                <h2>Running right now</h2>
                <p class="lsub">What a player opening the bot this second would be shown.</p>
                ${items.slice(0, SHOW).map((i) => html`
                    <div class="lrow" key=${i.title + i.start} style=${`--c:${i.accent || LANE_ACCENT[i.lane] || 'var(--ink4)'}`}>
                        <i class="ld"></i>
                        <span class="lt">${i.title}</span>
                        <!-- "hot" is two days out, the same threshold the attention list uses for a deadline. A colour that fires on a different number than the list beside it teaches the reader that neither can be trusted. -->
                        <span class=${'lw' + (i.end && dday(today, i.end) <= 2 ? ' hot' : '')}>
                            ${i.end && i.end !== i.start ? endsIn(i.end, today) : 'today'}
                        </span>
                    </div>`)}
                ${items.length > SHOW ? html`
                    <p class="lmore">${items.length - SHOW} more running · <a href="#/season">open the Track</a></p>` : null}
                ${!items.length ? html`
                    <p class="lmore">Nothing is scheduled for today. The season runs, but no draw, event or playlist
                        opens or closes. <a href="#/season">Open Season</a>.</p>` : null}
            </div>
            <div class="lp">
                <h2>Showing to players</h2>
                <p class="lsub">Announcements the bot is attaching to its replies.</p>
                ${anns.length ? anns.map((a) => html`
                    <div class="lrow" key=${a._id || a.text} style="--c:var(--patch)">
                        <i class="ld"></i>
                        <span class="lt">${a.text || a.title || html`<span class="none">untitled announcement</span>`}</span>
                        <!-- 🔴 NO EXPIRY IS THE HOT STATE, not the calm one. An announcement with no expiresAt value never stops on its own, which is the single defect Broadcast's own attention row exists to report — so it reads hot here for the same reason. -->
                        <span class=${'lw' + (a.expiresAt ? '' : ' hot')}>
                            ${a.expiresAt ? endsIn(a.expiresAt, today) : 'never ends'}
                        </span>
                    </div>`)
                : html`<p class="lmore">No announcement is showing. Replies go out with nothing attached.</p>`}
                <p class="lmore"><a href="#/broadcast">Open Broadcast</a></p>
            </div>
        </div>`;
}

// ⚠️ IT OFFERS THE WAY BACK, NOT THE VERBS. The mockup puts "Discard all" here beside "Review & commit"; the portal does not, because Review is the only screen that commits and discarding everything from a summary strip — with no list of what is about to go — is the one shape of that button nobody should press. The count and the route are what this can honestly carry.
function Resume({ ops }) {
    if (!ops.length) return null;
    const realms = new Set(ops.map((o) => o.realm || 'season'));
    return html`
        <div class="hres">
            <b>${ops.length} staged change${ops.length === 1 ? '' : 's'}</b>
            <span>across ${realms.size} realm${realms.size === 1 ? '' : 's'} — nothing is live until you commit them.</span>
            <span class="sp"></span>
            <a class="chip go" href="#/review">Review & commit</a>
        </div>`;
}

export function HomeRealm({ session }) {
    // In parallel: four realms' own endpoints. A realm the signed-in admin cannot see answers with `forbidden`, which reads here as "no rows from there" rather than an error — Home must render for a delegated admin who holds one page. Only the SESSION being gone is fatal, which is why season's signedOut is the one answer allowed to fail the whole page. ⚠️ SEVEN ENDPOINTS, AND ACCESS AND ANALYTICS ARE THE TWO THIS PAGE NEVER ASKED. The attention list carries a row for each of them in the design — a permission held by exactly one person, and errors pinged — and neither could ever fire while their realms went unqueried. `/api/access` is fetched for the server's own `singlePointsOfFailure`; `/api/access/matrix` only for the scope population the row counts against ("7 of 12"), which is the one figure that endpoint has and the other does not.
    const load = useAsync(() => Promise.all(['/api/season', '/api/armory', '/api/broadcast', '/api/review', '/api/access', '/api/access/matrix', '/api/analytics'].map((path) => fetchJson(path)))
        .then(([season, armory, broadcast, review, access, matrix, analytics]) => (season.signedOut ? season
            : { season, armory, broadcast, review, access, matrix, analytics })), []);
    const data = load.data;

    if (!data) return html`<${RealmShell} realm="home" session=${session} error=${load.error} slow=${load.slow}
                                          onRetry=${load.reload} skeleton=${{ rows: 5, lines: [12, 46, 20] }} />`;

    const today = todayIso();
    const rows = attentionRows({ ...data, today });
    // 🔴 A FIGURE THAT CANNOT BE KNOWN MUST NOT READ AS ZERO — the rule `broadcast.js:326` states and implements, which this file broke on the one page that reads five other realms. `/api/review` and `/api/broadcast` are both forbidden to a delegated admin who does not hold them, and `fetchJson` answers a 403 with `{forbidden:true}` — so `(x || [])` yielded `[]` and Home told that admin "0 live now / 0 staged" when the honest answer is "you cannot see that". `null` reaches the Masthead as an em dash, the portal's own absent-value voice. ⚠️ `needs you` is NOT given the same treatment: `attentionRows` already drops a row it cannot compute and still renders the rest, so its count is a real count of what IS known rather than a masked absence.
    const unknown = (d) => Boolean(d && (d.forbidden || d.failed));
    const live = unknown(data.broadcast) ? null : (data.broadcast?.live || []).length;
    const staged = unknown(data.review) ? null : (data.review?.ops || []).length;

    // The LEAD is "needs you", because that is what this page IS. Its colour is the state it reports — warn when there is something, plain ink at zero — which is the same rule every other masthead follows. A zero lead keeps its SIZE and drops its COLOUR.
    //
    // 🔴 FOUR FIGURES AGAIN, 2026-09-06 01:29 EDT — THE BUILD-OUT PLAN REOPENS THIS ON MERIT, NOT BY INHERITANCE. The 2026-09-03 cut to three was itself explicit that `days left` could "come back on merit in the redesign phase" (docs/db-deferred-list.md) rather than being restored as a figure nobody re-examined — this is that merit pass, ordered directly in docs/superpowers/plans/2026-09-06-portal-build-out.md's Unit E row. The countdown still sits ~200px below in Home's own clock panel, so the masthead figure and the clock panel now agree on purpose rather than by accident, the same way every other realm's masthead states a headline the view beneath it elaborates.
    const daysLeft = seasonDaysLeft(data.season?.live, today);
    const stats = [
        { value: rows.length, label: 'needs you', lead: true, accent: rows.length ? 'var(--warn)' : 'var(--ink)' },
        // The two non-lead figures carry their own state rather than plain ink: a live count reads in the live colour and a staged count in the staged one, which is the same shape-and-colour rule every mark in this portal follows. A zero keeps its size and drops its colour. ⚠️ NO `tone: 'live'` HERE, AND THE ABSENCE IS THE POINT. It was added to clear a coverage entry and there is no `.stat.live` rule anywhere — `.stat.stg .v` and `.stat.warn .v` exist, `.stat.live` does not — so the class styled nothing and existed only to make a number move. The live figure reads in plain ink because that is what the design gives it.
        //
        // ⚠️ RENAMED "live now" → "announcements live", 2026-09-06 01:29 EDT (build-out plan, `clarify` lens). This counts LIVE ANNOUNCEMENTS specifically (broadcast.live.length), which is a different question from "Running right now" 200px below it — the old label read as the same question the clock and LiveNow panels already answer, so it now names what it counts.
        { value: live === null ? '—' : live, label: 'announcements live' },
        // 🔴 THE STAGED FIGURE IS NOT A MASTHEAD STAT ON HOME — removed 2026-09-04 22:54 EDT. This screen stated one number four times: the header commit chip, the rail badge, this stat, and the resume strip 60px below it — which is the only one of the four that says WHICH realms and what "staged" costs. On a page titled "What needs you", whose job is ranking, a bare repeated digit is the weakest of the four and it goes. ⚠️ HOME ONLY. Every other realm's masthead staged figure is scoped to that realm and says something its neighbours do not.
        //
        // 🔴 RESTORED, READING THE SEASON'S LAST DEADLINE — never `bpEnd` alone, for the same reason `seasonItems` above does not: the dev document leaves `bpEnd` unset, and a fallback keyed on it alone silently reads the wrong wall on the one environment nobody had measured. Absent (no season, or every deadline TBD) reads as an em dash with a label that says why, matching the portal's "a figure that cannot be known must not read as zero" rule — see broadcast.js:326.
        { value: daysLeft == null ? '—' : daysLeft, label: daysLeft == null ? 'no deadline set' : 'days left' },
    ];

    return html`
        <${Shell} realm="home" session=${session} busy=${load.hostClass} badges=${{ review: staged || 0 }} stagedOps=${unknown(data.review) ? null : (data.review?.ops || [])}
                  commands=${rows.map((a) => ({
                      label: a.text, group: a.realm, local: true, accent: `var(--r-${a.realm.toLowerCase()})`,
                      keywords: ['needs', 'attention', 'fix', a.act], run: () => { location.hash = a.href.slice(1); },
                  }))}
                  viewSlot=${html`
                      <div class="home">
                          <!-- 🔴 THE MASTHEAD IS A CHILD OF .home, NOT A Shell PROP, AND ON THIS REALM ONLY.
                               Every other realm's masthead spans main's full 1206px and the design agrees. Home does
                               not: app.css's own .home rule sizes it at max-width 1080px with margin 0 auto, and the design
                               puts the masthead INSIDE that wrapper -- .home .masthead and .home h1 (in app.css's HOME'S SEASON BLOCK)
                               are DESCENDANT selectors. Passed as Shell's masthead prop the element renders as main's
                               child instead, so both rules matched nothing: the masthead measured 1206px against the
                               design's 1080, at x=76 against x=139, with its own padding 30/23/20 against 30/24/18 and
                               the h1's margin-bottom at 0 against 18. That is the whole of section 1 CASCADE, and the
                               audit counted 89 offsets below it as separate findings.
                               Neither portal:orphans nor portal:coverage could see it -- the classes exist and the rules
                               exist, they simply never meet. Same shape as the .mh-add defect in shell.js's own header.
                               SAFE HERE SPECIFICALLY: Shell renders the masthead slot as a ternary against null, Home
                               passes no exports so the ExportStrip cloneElement branch never applied to it, and the
                               .rise entrance stagger selects .masthead from the document wherever it sits.
                               DO NOT generalise this to another realm without measuring: on a realm with no 1080px
                               wrapper, moving the masthead inside the view changes nothing and costs the export seam. -->
                          <${Masthead} eyebrow=${html`<span class="job">Dioreo admin</span>`}
                                       title="What needs you" stats=${stats} />
                          <!-- 🔴 THE ORDER IS THE DESIGN'S AND THE PORTAL HAD TWO BLOCKS IN THE WRONG PLACE.
                               Measured 2026-09-03 21:34 EDT: the design draws masthead, then the staged strip,
                               then the clock, then the attention list, then what is live. The portal drew the
                               attention list SECOND and the staged strip fifteen hundred pixels down, which put
                               the resume 1,281px below where the design puts it and every block under it out of
                               step — portal:converge reported a flat +414px offset on eleven consecutive nodes.
                               COMPANION 5.9z.5's fourth ranked complaint about the old Home was that "nothing
                               staged" sat at the BOTTOM, the most actionable fact on the page reached last; the
                               design's answer was to lead with it. The portal had moved it up from the bottom
                               and stopped halfway.
                               The clock ahead of the list is the same argument: the clock is the season's STATE
                               and the list is its EXCEPTIONS, so the page answers "where are we" before "what is
                               wrong". Reordering only; every component is unchanged. -->
                          <${Resume} ops=${data.review?.ops || []} />
                          <${HomeClock} season=${data.season?.live} today=${today} />
                          <${AttentionList} rows=${rows} />
                          <${LiveNow} season=${data.season?.live} broadcast=${data.broadcast} today=${today} />
                      </div>`} />`;
}
