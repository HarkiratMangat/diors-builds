// portal/ui/shell.js — ESM. The chrome every realm renders inside: top bar, nav rail, masthead, view switcher, and the Manifest slot.
//
// 🔴 THE MANIFEST LAYER NEVER SWITCHES (spec §8.1/§8.2) — only `view` (the top half) does. This is enforced structurally here, not just by convention: Shell always renders `manifestSlot` in the SAME place regardless of `view`, and the tab switcher below only ever changes `view`.
//
// 🔴 THE NAV IS A RAIL, NOT A BAR, and that is a correction rather than a preference. `01-season-spine.html` is the FULL-STYLE mockup — one page, designed completely — and its chrome is a 76px left icon rail plus a thin top bar carrying only the wordmark, a breadcrumb and identity. Mockups 02–06 are COMPILED-STYLE sheets: several pages stacked into one file for review, wrapped in a document-navigation bar. The horizontal five-realm bar that shipped here is almost exactly 06's *document* nav — review scaffolding built as product. Measured before removing it: 863px of content in a 359px viewport. See the redesign spec §0.
import { h, cloneElement } from '../vendor/preact.mjs';
import { html } from '../vendor/htm-preact.mjs';
import { Icon } from './icons.js';
import { useState, useEffect, useRef } from '../vendor/preact-hooks.mjs';
import { CommandBar } from './palette.js';
import { useOverlay } from './overlay.js';
import { ExportStrip, ExportDrawer } from './exportPanel.js';
import { StagedTray } from './tray.js';
import { installTips } from './tips.js';
import { fetchJson } from './httpClient.js';
// ⚠️ `refusalOf` is NOT imported: it is an `async.logic.js` global, loaded as a script on every page — the same shape `season.js` uses it in. The build's named-import check refused the import, correctly.
/* global refusalOf */

// Five PLACES TO WORK. Review is deliberately not among them — see Rail below.
const REALMS = ['season', 'armory', 'broadcast', 'access', 'analytics'];

// 🔴 THE ID IS NOT THE LABEL, AND THE MIGRATION RENDERED THE ID. `realm` is a key — lowercase, URL-shaped, the thing `--r-season` and `#/season` are built from — and every reader-facing surface here was printing it raw: a rail reading "season armory broadcast", a breadcrumb reading "season", a panel titled "season", and a command bar offering "Search season, or run a command". The mockup's own REALMS array carries a `label` beside the id for exactly this reason, and COMPANION §2307 is explicit that the word `realm` and its ids stay in the CODE while anything a person reads names the page — "Could not load Season", "Search Access, or run a command".
//
// ⚠️ ONE MAP, used by the rail, the crumb, the panel title and the command bar. A second copy is how two surfaces come to disagree about what a place is called, which is the same failure `portalClassProps.mjs` exists to prevent one layer down. 🔴 Home is "Portal Home" because a crumb reading "Home" beside a rail with no home entry says less than it looks like it does — and that is now the ONLY reason. ⚠️ **This comment also claimed it is "what the mockup's own breadcrumb says on index.html", and that is FALSE: `index.html` contains no crumb at all.** The pixel diff pairs the mockup's plain `span` reading "Home" against this `span.crumb` reading "Portal Home" and reports it as region 14 — measured 2026-09-03 23:11 EDT, by the §L ⑥ agent's prompt to treat every comment as an unverified claim. The DECISION stands on its surviving half; the evidence it cited never existed. A comment that offers two reasons and is wrong about one is the shape that costs most, because the true half makes the false half read as checked.
const REALM_LABEL = {
    season: 'Season', armory: 'Armory', broadcast: 'Broadcast', access: 'Access',
    analytics: 'Analytics', review: 'Review', home: 'Portal Home',
};
export const realmLabelOf = (r) => REALM_LABEL[r] || (r ? r[0].toUpperCase() + r.slice(1) : '');

// One 24×24 stroke glyph per realm. Inline rather than an icon font or sprite sheet: six paths is less bytes than either, and the portal serves no external assets (the door is the only page a stranger reaches and it must request nothing). `stroke: currentColor` in shell.css means the active/hover colour transition covers the icon for free.
const REALM_ICON = {
    season: 'M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z',
    armory: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 2v4M12 18v4M2 12h4M18 12h4M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
    broadcast: 'M4 10v4a1 1 0 0 0 1 1h3l5 4V5L8 9H5a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11',
    access: 'M15 7a4 4 0 1 1-3.9 5H8v2H6v2H3v-3l8.1-8.1A4 4 0 0 1 15 7zM16 10.5h.01',
    analytics: 'M3 17l4-6 4 3 4-7 3 4M3 21h18',
    // The approved design's own glyph for Review — lines shortening to a check. Kept verbatim rather than re-drawn, so the rail reads the same here as in the mockup it came from.
    review: 'M4 6h16M4 12h10M4 18h7M15 17l2.5 2.5L22 15',
    home: 'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5',
};

function RealmIcon({ realm }) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round"><path d=${REALM_ICON[realm] || REALM_ICON.season} /></svg>`;
}

// `badges` is realm -> count of the signed-in admin's own staged changesets. Absent rather than zero when there is nothing staged — a permanent "0" is noise.
//
// 🔴 REVIEW SITS BELOW A RULE, NOT AS A SIXTH REALM, and that is the approved design's own decision rather than a layout preference: five realms are PLACES TO WORK, Review is the WAY OUT. The rule says that without a label nobody would read at 9px. It first shipped reachable only through the tray — which requires staged work to exist — so the commit screen was unreachable from a page with nothing staged, which is exactly when you want to check that nothing is staged.
//
// 🔴 AND THE STAGED COUNT BELONGS HERE, not on Season. It is a property of the CHANGESET, so an Armory edit putting a badge on Season is the surface disagreeing with its own data. The rail's realm entries. `--c` per realm is the adopted design's own mechanism — the accent is a property of the realm, applied as a custom property rather than a class, so hover/active/current states all read from one value. 🔴 THE PORTAL STAGED FROM SIX REALMS AND ACKNOWLEDGED IT NOWHERE BUT A TOAST. `.count-bump` and `.staged-pulse` have had rules in the adopted stylesheet since it was adopted and no code has ever applied either — the mockup applies them from `Shell.pulseTray()`, and nothing was ported. This is that function. It lives here because this module owns both targets: the rail's staged count and the tray.
//
// ⚠️ IT IS CALLED FROM ONE PLACE, DELIBERATELY. `composeClient.js`'s `stageOps` is the single funnel every staging path in the portal goes through, which is the same reason the mockup put its call inside `Store.add` — an acknowledgement remembered at each call site is one a new surface forgets.
//
// 🔴 AND THE BADGE CANNOT SIMPLY BE BUMPED WHEN THE STAGE RETURNS, WHICH THE MOCKUP DID NOT HAVE TO SOLVE. Its store is synchronous, so the count is already updated by the time it pulses. Here a stage is a network round trip followed by a refetch and a re-render, and when the count goes 0→1 the badge NODE DOES NOT YET EXIST at return time — decorating it then decorates nothing, which looks exactly like a rule that does not work. So the tray, which no stage re-renders, is pulsed immediately, and the badge is pulsed as soon as it is on the page.
//
// ⚠️ IT DOES NOT WAIT FOR THE NUMBER TO CHANGE, and that was the first version's bug. Staging into an EXISTING changeset adds an op and leaves the changeset COUNT alone — a real and common case — so a "wait until the count differs" trigger would never fire for it, silently, which is the same class of defect as the missing acknowledgement itself.
//
// ⚠️ THE CLASS SURVIVES THE RE-RENDER because preact reuses the node and only writes `class` when the vnode's own class prop changed; this badge's is the constant "cnt", so the count's text updates underneath an animation that keeps playing.
//
// ⚠️ setTimeout rather than requestAnimationFrame on purpose: rAF does not fire in a background tab (COMPANION §14 — that is how ruler masking silently never ran), and a stage kicked off before switching tabs would then acknowledge nothing on return. It gives up quietly after ~1.5s: a stage in a realm whose badge never appears has nothing to acknowledge, and that is not an error.
const BADGE_SEL = '.rail .realm.out .cnt';
function replay(sel, cls) {
    const el = typeof document !== 'undefined' && document.querySelector(sel);
    if (!el) return false;
    el.classList.remove(cls);
    void el.offsetWidth;   // without the reflow, removing and re-adding in one frame replays nothing
    el.classList.add(cls);
    return true;
}
export function pulseTray() {
    if (typeof document === 'undefined') return;
    replay('.tray', 'staged-pulse');
    if (replay(BADGE_SEL, 'count-bump')) return;
    let waited = 0;
    const tick = () => {
        if (replay(BADGE_SEL, 'count-bump')) return;
        if ((waited += 50) < 1500) setTimeout(tick, 50);
    };
    setTimeout(tick, 50);
}

export function Rail({ realm, realms, badges = {} }) {
    const visible = realms || REALMS;
    const places = visible.filter((r) => r !== 'review');
    const canReview = !realms || visible.includes('review');
    const staged = Object.values(badges).reduce((n, v) => n + (Number(v) || 0), 0);
    return html`
        <nav class="rail" aria-label="Realms">
            ${places.map((r) => html`
                <a class="realm" href=${'#/' + r} style=${`--c:var(--r-${r})`}
                   aria-current=${r === realm ? 'page' : null}>
                    <${RealmIcon} realm=${r} />${realmLabelOf(r)}
                </a>`)}
            ${canReview ? html`
                <!-- 🔴 BELOW A RULE, NOT A SIXTH REALM. Five realms are places to work; Review is the
                     way out, and the rule says so without a label nobody would read at 9px. The
                     staged count is a property of the CHANGESET, so it belongs here rather than on
                     whichever realm happened to stage the work. -->
                <span class="rail-rule" aria-hidden="true"></span>
                <a class=${'realm out' + (staged ? ' has' : '')} href="#/review" style="--c:var(--r-review)"
                   aria-current=${realm === 'review' ? 'page' : null}>
                    <${RealmIcon} realm="review" />Review
                    ${staged ? html`<span class="cnt" aria-label=${`${staged} staged`}>${staged}</span>` : null}
                </a>` : null}
        </nav>
    `;
}

// The masthead every realm shares: an identity block and a stat cluster. `lead` marks the one stat that is the page's headline; `--c` tints it with whatever that number is about.
//
// Deliberately NO "ANSWERS: …" tag and no explanatory paragraph — those appear only in the compiled review sheets and are reviewer annotation, not product copy (Harkirat, 2026-08-23 14:47 EDT). 🔴 A NUMBER THAT CHANGED AND A NUMBER THAT DID NOT LOOKED IDENTICAL. Staging a change updates a masthead figure silently, so the one signal that your action landed was a digit you were not looking at. The adopted sheet has drawn this since it was adopted — `.mh-stats .v.rolling` and a `.fdelta` badge that drifts up — and nothing emitted either.
//
// ⚠️ IT REPORTS THE DELTA, NOT THE VALUE. "+3" says what just happened; the figure beside it already says where you are. And it fires only on a CHANGE from a real previous number — a first paint is not an event, and animating one would make every page load look like something had happened.
//
// ⚠️ REDUCED MOTION IS HONOURED HERE AND NOT ONLY IN CSS. The sheet already stops the animation, but the badge would still appear and vanish; skipping the whole thing is the same answer said once. `zero` is not "the value is 0" — it is "this figure is a STAGED count that is currently zero", which the design dims with .stg-clear because a staged column at rest is good news rather than an absent number. The caller knows which stat it is; this component would have to guess.
function Figure({ value, zero = false }) {
    const prev = useRef(null);
    const [delta, setDelta] = useState(null);
    const [rolling, setRolling] = useState(false);
    useEffect(() => {
        const n = Number(value), was = prev.current;
        prev.current = Number.isFinite(n) ? n : null;
        if (!Number.isFinite(n) || !Number.isFinite(was) || was === n) return undefined;
        if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
        const d = n - was;
        setRolling(true);
        setDelta(d);
        const a = setTimeout(() => setRolling(false), 420);
        const b = setTimeout(() => setDelta(null), 1400);
        return () => { clearTimeout(a); clearTimeout(b); };
    }, [value]);

    return html`
        <span class=${'v' + (rolling ? ' rolling' : '') + (zero ? ' stg-clear' : '')}>${value}</span>
        ${delta === null ? null : html`
            <span class=${'fdelta ' + (delta > 0 ? 'up' : 'down')} aria-hidden="true">
                ${delta > 0 ? '+' : '−'}${Math.abs(delta)}
            </span>`}
    `;
}

// 🔴 `actions` IS A GRID CHILD OF `.masthead`, NOT A CHILD OF `.mh-id`, AND MOVING IT THERE FIXED A VISIBLE DEFECT NO GATE COULD SEE. `.mh-add` has carried `grid-column / grid-row / justify-self:end` since the mockup, and inside `.mh-id` every one of those declarations was inert — the element was not a grid item. So the ADD row right-aligned to `.mh-id`'s edge instead of the masthead's: measured on Season at 1282, the ADD row ended at x=995 while `.mh-take`, the export line directly beneath it, ended at x=1260. Two right-aligned rows, 265px apart, one above the other. `portal:orphans` was quiet because the class exists and has a rule; `portal:coverage` was quiet because the rule has an element. A consumer whose producer is in the wrong parent is this port's signature defect, and it is invisible to every scanner that asks only whether both ends exist.
//
// ⚠️ `aside` AND `stats` OCCUPY THE SAME GRID AREA AND ARE MUTUALLY EXCLUSIVE ON PURPOSE. Season has no stat block -- COMPANION 16.31 point 3: the clock *"replaces the masthead's stat block, which he called useless"*, so it takes that column rather than sitting under the title in the left one. Expressing it as one slot rather than two stacked ones is what makes "replaces" true in the layout instead of only in the prose.
export function Masthead({ title, sub, stats = [], actions = null, eyebrow = null, aside = null, take = null, below = null }) {
    return html`
        <div class="masthead">
            <div class="mh-id">
                ${eyebrow}
                <h1>${title}</h1>
                ${sub ? html`<span class="job">${sub}</span>` : null}
            </div>
            <!-- ⚠️ THE WRAPPER IS A PORTAL ADDITION AND IT IS A GRID CHILD. The design puts the clock
                 in the masthead grid itself, carrying the mh-stats and sclock classes on one element; wrapping it added a
                 box between the grid and the thing the grid was placing. Under the conformance flag the
                 aside renders bare so the two mastheads have the same skeleton. -->
            ${aside || null}
            ${!aside && stats.length ? html`
                <div class="mh-stats">
                    ${stats.map((s) => html`
                        <span class=${'stat' + (s.tone ? ' ' + s.tone : '') + (s.lead ? ' lead' : '')}
                              style=${s.accent ? `--c:${s.accent}` : null}>
                            <${Figure} value=${s.value} zero=${s.tone === 'stg' && !s.value} /> <span class="k">${s.label}</span>
                        </span>`)}
                </div>` : null}
            ${actions}
            ${take}
            <!-- season.html's nwHost section is the LAST CHILD OF THE MASTHEAD, which is where its width
                 comes from: 1206 minus the masthead's own 23px gutters is the 1160 the composer measures.
                 Rendered anywhere else it inherits a different box — in the context band it came out at
                 920, and every chip, input and note inside it was 240px short of the design's. -->
            ${below}
        </div>
    `;
}

// 🔴 CREATION WAS BURIED ON EVERY REALM THAT HAD IT. Measured 2026-08-26: Armory's and Broadcast's only "new" affordance was a command-palette entry plus a button inside the Bulk view, and Access's grant form sat at the foot of a grid — so the one thing an admin opens the portal to DO was reachable only by knowing it was there. The masthead is where the page says what it is; it is also where it should offer the verb.
//
// ⚠️ THE ACCESS KEY IS ANNOUNCED, NOT JUST BOUND. A shortcut nobody can see is a shortcut nobody uses, which is why the <kbd> is part of the control rather than a tooltip — the mockup makes the same call in season.html. The key is rendered from the same `hint` that is bound, so the two cannot drift. ⚠️ `hint` IS OPTIONAL AND THE KEY BINDING IS EXTRACTED, so a realm that offers SEVERAL create verbs gets the same shortcut behaviour as one that offers a single button. Armory needs two — MP and DMZ are different records with different rules — and the first version of that group was transplanted from the mockup as bare chips, which silently dropped the announced access key and the text-field guard this component had been built with an hour earlier. Two create idioms in one console, one of them worse.
export function useCreateKey(hint, onClick) {
    useEffect(() => {
        if (!hint || !onClick) return undefined;
        const onKey = (e) => {
            if (e.key.toLowerCase() !== hint.toLowerCase() || e.metaKey || e.ctrlKey || e.altKey) return;
            const t = e.target;
            // ⚠️ A bare letter is a TEXT CHARACTER first. Firing while somebody is typing a build name would swallow the letter and open a second composer over the one they are filling in.
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            e.preventDefault();
            onClick();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [hint, onClick]);
}

export function MastheadNew({ label, hint, onClick, tip }) {
    useCreateKey(hint, onClick);

    return html`
        <button type="button" class="pill lead mh-new" onClick=${onClick} data-tip=${tip || null}>
            <span class="mh-plus" aria-hidden="true">+</span>${' '}${label}${' '}
            ${hint ? html`<kbd aria-label=${`Keyboard shortcut: ${hint.toUpperCase()}`}>${hint.toUpperCase()}</kbd>` : null}
        </button>
    `;
}

// ⚠️ A ZERO-HEIGHT CELL, ON PURPOSE. Analytics has no create verb, so its masthead's second row would collapse and the export popover it anchors would jump to the page edge. `.mh-anchor{height:0}` reserves the POSITION without reserving space — the mockup's own solution, kept because the alternative is a hidden button that a screen reader still finds.
export function MastheadAnchor({ id }) {
    return html`<div class="mh-anchor" id=${id || null} aria-hidden="true"></div>`;
}

// ── THE ACCOUNT PANEL ─────────────────────────────────────────────────────────────────────────
//
// 🔴 THE PORTAL HAD NO WAY TO SIGN OUT. `POST /auth/logout` has existed in portal/auth.js since the door was built and no surface has ever called it — so an admin console that hands out 12-hour cookies offered no way to end one, on a shared machine or anywhere else. That is a missing function, not a missing panel, and it is the reason this exists.
//
// 🔴 AND IT IS BUILT FROM WHAT THE PORTAL ACTUALLY KNOWS, WHICH IS LESS THAN THE MOCKUP ASSUMED. The approved design leads with a Discord banner, an avatar and a display name, because "the fastest possible answer to whose session this is, is the face the person already recognises". The portal has no face: `GET /auth/csrf` returns `discordId`, `isOwner` and `visibleRealms`, and nothing in this codebase stores a username or an avatar hash. Rendering the mockup's markup anyway would produce `url(undefined)` — a real request, from a page whose whole premise is that it asks for nothing it did not say it would. So the head is quiet on purpose: `--banner`/`--av-src` are set to `none` (a VALID value, so the CSS falls through to its designed `--sunk` ground rather than being dropped as invalid-at-computed-value-time and painting transparent), the disc carries Discord's own mark, and the identity is the id — whole, as the design insists, in the one slot whose type size fits nineteen digits.
//
// ⚠️ The OWNER badge is ABSENT for a non-owner rather than reading "ADMIN", the same rule the commit chip follows: a badge every account carries states nothing, and "Dioreo admin" above it already says what the account is. D3 — a session's Discord avatar as a CDN url, or null when there is no hash yet (a session created before this field existed, or an account with no custom avatar — Discord's own default-avatar CDN path needs the id's snowflake bits, which is the lookup endpoint's job (portal/api/access.js's defaultAvatarUrl), not the identity chip's). Callers fall back to an initial letter rather than guessing.
function avatarUrlOf(session) {
    if (!session || !session.avatarHash) return null;
    return `https://cdn.discordapp.com/avatars/${session.discordId}/${session.avatarHash}.png?size=64`;
}
function initialOf(session) {
    const src = (session && (session.globalName || session.username)) || (session && session.discordId) || '?';
    return String(src).slice(0, 1).toUpperCase();
}

// ⚠️ "SESSION · 12 HOURS" STATES THE POLICY; THIS STATES A FACT ABOUT THE READER. models/PortalSession.js expires a row 12 hours after `createdAt` via a Mongo TTL index, so the deadline is real and knowable — /auth/csrf now sends it. Absent (an older session, or a fetch that predates the field) reads as an em dash rather than a guessed countdown. ⚠️ IT IS A COUNTDOWN, so it reads in the live voice rather than as another grey label. The account panel's other rows are facts that do not move; this one is the only thing on that panel that is running down while you look at it.
function sessionLeft(expiresAt) {
    if (!expiresAt) return '—';
    const left = new Date(expiresAt).getTime() - Date.now();
    if (!Number.isFinite(left) || left <= 0) return 'expired';
    const hrs = Math.floor(left / 3600000), mins = Math.floor((left % 3600000) / 60000);
    return hrs ? `expires in ${hrs}h ${String(mins).padStart(2, '0')}m` : `expires in ${mins}m`;
}

// 🔴 COPYING SAID NOTHING, AND ON FAILURE IT DID NOTHING AT ALL. Both routes to the id — this menu item and the command bar's "Copy my Discord ID" — were a bare `navigator.clipboard?.writeText(...)`: no acknowledgement on success, and the optional chain swallows the whole action in an insecure context or when permission is refused, so a reader clicks, nothing happens, and there is no way to tell a silent success from a silent failure. Every other completing action in this portal says so. Found by the states harness, which could not reach a toast state that the account menu was supposed to be able to produce.
function copyIdWithFeedback(chrome, id) {
    const say = (m) => (chrome && chrome.say ? chrome.say(m) : null);
    try {
        const p = navigator.clipboard && navigator.clipboard.writeText(String(id));
        if (!p) return say('This browser will not let the portal use the clipboard — select the id and copy it by hand.');
        p.then(() => say('Discord ID copied.')).catch(() => say('The clipboard refused — select the id and copy it by hand.'));
    } catch {
        say('The clipboard refused — select the id and copy it by hand.');
    }
}

function Account({ session, staged, onSignOut, chrome }) {
    const [open, setOpen] = useState(false);
    // One minute is the right cadence for a twelve-hour clock: faster is a spinning number nobody reads, slower and the last minute of a session is a lie. Only while the panel is open — a closed panel ticking is a timer nobody can see.
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!open) return undefined;
        const id = setInterval(() => setTick((n) => n + 1), 60000);
        return () => clearInterval(id);
    }, [open]);
    useEffect(() => {
        if (!open) return undefined;
        const away = (e) => { if (!e.target.closest || !e.target.closest('.who')) setOpen(false); };
        const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', away);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
    }, [open]);

    if (!session) return null;
    const id = String(session.discordId);
    const realms = (session.visibleRealms || []).filter((r) => r !== 'review');
    const reach = session.isOwner ? 'everything' : `${realms.length} realm${realms.length === 1 ? '' : 's'}`;
    const avatarUrl = avatarUrlOf(session);

    return html`
        <span class="who">
            <button class="whobtn" aria-expanded=${open ? 'true' : 'false'} aria-haspopup="menu"
                    onClick=${(e) => { e.stopPropagation(); setOpen(!open); }}>
                <span class="av" data-src=${avatarUrl ? '' : null}
                      style=${avatarUrl ? `--av-src:url(${avatarUrl})` : null} aria-hidden="true">${avatarUrl ? '' : initialOf(session)}</span>
                <span class="id" title=${id}>…${id.slice(-4)}</span>
                <span class="cv" aria-hidden="true"></span>
            </button>
            <div class="umenu" role="menu" aria-label="Account" hidden=${!open}>
                <div class="ubanner" style="--banner:none" aria-hidden="true"></div>
                <div class="uid">
                    <!-- D3 — the real Discord avatar and name, replacing a grey disc and the literal string
                         "Dioreo admin" that named nobody. globalName is the display line; the muted line
                         beneath is the @username, matching how Discord itself distinguishes the two. A session
                         with no avatarHash yet (predates this field) falls back to an initial letter rather
                         than an icon that could be anyone's. -->
                    <span class="uav" data-src=${avatarUrl ? '' : null}
                          style=${`--av-src:${avatarUrl ? `url(${avatarUrl})` : 'none'}`} aria-hidden="true">
                        ${avatarUrl ? null : html`<b class="uinit">${initialOf(session)}</b>`}
                    </span>
                    <span class="un"><b>${session.globalName || session.username || 'Dioreo admin'}</b>
                        <span>${session.username ? `@${session.username}` : id}</span></span>
                    ${session.isOwner ? html`<span class="rolebadge">OWNER</span>` : null}
                </div>
                <div class="usec">
                    <div class="ustat"><span>Session</span><b class="live">${sessionLeft(session.sessionExpiresAt)}</b></div>
                </div>
                <div class="usec">
                    <!-- The reach is a NOTE on the row it qualifies rather than a stat of its own: "what you can do"
                         is a property of this account, not a measurement beside the session clock. -->
                    <button class="mi" role="menuitem" onClick=${() => { setOpen(false); location.hash = '#/access'; }}>
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6 13.4 4v3.8c0 3-2.2 5.4-5.4 6.6-3.2-1.2-5.4-3.6-5.4-6.6V4z" /></svg>
                        What you can do<span class="mnote">${reach}</span>
                    </button>
                    <!-- 🔴 THE ID IS WHOLE. The chip in the bar shows the last four, and eliding the MIDDLE of a
                         snowflake removes the only part that distinguishes it from any other — so the preview could
                         not confirm it was the right id, which is the entire reason anybody looks before pasting one
                         into a grant. Nineteen digits fit, and a preview that cannot be checked is worse than none. -->
                    <button class="mi" role="menuitem" onClick=${() => { setOpen(false); copyIdWithFeedback(chrome, id); }}>
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5h8v8H5z" /><path d="M3 11V3h8" /></svg>
                        Copy ID<span class="mid">${id}</span>
                    </button>
                </div>
                <div class="usec last">
                    <button class="mi danger" role="menuitem" onClick=${() => { setOpen(false); onSignOut(staged); }}>
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3H4v10h6" /><path d="M8 8h6M12 6l2 2-2 2" /></svg>
                        Sign out
                    </button>
                </div>
            </div>
        </span>
    `;
}

// The header bar. The command bar is THE bar rather than a launcher for one: it used to be a 44px ⌘K chip in a header with ~700px of unused space, which is a keyboard shortcut wearing a button's clothes — it advertised a feature instead of being one.
//
// ⚠️ The commit chip is ABSENT at zero rather than reading "0 staged". A chip that is always there is a permanent third copy of the tray and the rail badge; one that appears only when there is something to act on is the same fact at the moment it becomes actionable.
function Header({ realm, view, session, staged, commands, onSignOut, chrome }) {
    return html`
        <header id="hdr">
            <button class="mk" title="Home" onClick=${() => { location.hash = '#/home'; }}><span class="glyph"></span>DIOREO<b>/</b>PORTAL</button>
            <!-- 🔴 THE SEPARATOR IS AN ICON HERE AND A GLYPH IN THE DESIGN, and it is the audit's FIRST
                 cascade finding on every Season view: top 17 to 21, height 17 to 11, with 1445 offsets
                 reported beneath it. The icon is the better call and it stays — reference_never_text_glyphs
                 _for_icons exists because a text chevron inherits font metrics nothing controls, which is
                 exactly the 6px this measures. So it stands down for the comparison rather than being
                 given up, and comes back with the rest of the re-apply queue. -->
            <!-- 🔴 THE DESIGN SETS THIS SEPARATOR AS A TEXT CHEVRON AND THE PORTAL DOES NOT, DELIBERATELY.
                 reference_never_text_glyphs_for_icons: a glyph inherits font metrics nothing here controls, so it
                 lands differently on every stack. Lucide is already inlined in this package. Kept with the drawer's
                 close in overlay.js — the two are one rule, and an SVG here beside a glyph there is two habits. -->
            <span class="crumb">${realmLabelOf(realm)}${view
                ? html` <b class="crumb-sep"><${Icon} name="chevron-right" cls="sm" /></b> ${view}` : null}</span>
            <span class="sp"></span>
            <${CommandBar} commands=${commands} realmLabel=${realm === 'home' ? null : realmLabelOf(realm)} />
            <span class="sp"></span>
            ${staged ? html`
                <a class="hdr-commit" href="#/review"><b>${staged}</b>${' '}<span>staged · review</span></a>` : null}
            <${Account} session=${session} staged=${staged} onSignOut=${onSignOut} chrome=${chrome} />
        </header>
    `;
}

// Everything the command bar can do that is true on EVERY realm: go somewhere, and end the session. A realm adds its own verbs through `commands`; it never has to re-declare navigation, and it cannot accidentally ship a page whose bar knows less than the page next door.
//
// ⚠️ THE VIEW SWITCHES ARE DERIVED, NOT DECLARED. Shell already receives `viewOptions`/`onSetView` to draw the tab strip, so the palette reads the same two values — which means the bar and the tabs can never offer different views, and a realm that adds a view gets it in the palette for free rather than by remembering to.
function chromeCommands({ realm, session, viewOptions, onSetView, staged, onSignOut, chrome }) {
    const out = [];
    if (viewOptions) {
        for (const v of viewOptions) {
            out.push({ label: v, group: 'view', local: true, accent: `var(--r-${realm})`,
                       keywords: ['view', 'switch', 'tab'], run: () => onSetView(v) });
        }
    }
    const visible = (session?.visibleRealms || REALMS);
    out.push({ label: 'What needs you', group: 'home', accent: 'var(--warn)',
               keywords: ['home', 'start', 'overview', 'dashboard'], run: () => { location.hash = '#/home'; } });
    for (const r of visible.filter((x) => x !== 'review' && x !== realm)) {
        // ⚠️ A FOURTH COPY OF THE CAPITALISATION RULE LIVED HERE, inline — and it would have said "Review" correctly and "Portal Home" never. One map, `realmLabelOf`, or the palette and the rail eventually disagree about what a place is called.
        out.push({ label: realmLabelOf(r), group: 'realm', accent: `var(--r-${r})`,
                   keywords: ['go', 'open', 'realm'], run: () => { location.hash = '#/' + r; } });
    }
    if (realm !== 'review') {
        out.push({ label: staged ? `Review & commit — ${staged} staged` : 'Review & commit', group: 'commit',
                   accent: 'var(--r-review)', keywords: ['commit', 'staged', 'changeset', 'apply'],
                   run: () => { location.hash = '#/review'; } });
    }
    if (session) {
        out.push({ label: 'Copy my Discord ID', group: 'account', accent: 'var(--ink3)',
                   keywords: ['id', 'clipboard', 'snowflake'],
                   run: () => copyIdWithFeedback(chrome, session.discordId) });
        out.push({ label: 'Sign out', group: 'account', accent: 'var(--danger-ink)',
                   keywords: ['logout', 'log out', 'leave', 'end session'], run: () => onSignOut(staged) });
    }
    return out;
}

// `busy`/`busyNote` are the two host hooks the adopted sheet's async rules need: .is-refreshing paints a hairline along the top edge WITHOUT blanking the data underneath, and .is-slow renders its note from data-slow. Both belong on <main>, which is the only element that already carries position:relative and spans every realm's content. 🔴 THREE MARKS ARE DRAWN ON EVERY REALM AND NONE OF THEM IS EXPLAINED ANYWHERE. Solid is live, dashed is staged, hatched is a conflict — the Track's bars, the Board's cards, the composer's ghost and the Manifest's state pills all speak it, and a reader meets it with no key. "Shape carries state" only works if somebody is told what the shapes mean once.
//
// ⚠️ IT SITS IN THE VIEW BAR, NOT IN A PANEL OF ITS OWN. A legend is read once and then ignored, so it belongs where the eye already goes and takes no vertical space — and it is rendered only where a realm actually draws the marks, because a key for a mark that is absent teaches the reader that the page is missing something. 🔴 IT SAID "LIVE" AND THE DESIGN SAYS "SAVED", AND IT NAMED ALL THREE STATES ALWAYS. Two rules this portal states about its own keys were both broken here: the vocabulary (Broadcast's own key already renders "saved / staged" and the design's key emitter uses the same three words) and "name only what is on screen" — a season with nothing staged sent a reader hunting for a dashed mark that is not drawn. `states` is the set actually present; the boolean form still works and means all three.
const KEY_STATES = [['saved', 'l'], ['staged', 's'], ['conflict', 'c']];
function StateKey({ states }) {
    const on = Array.isArray(states) ? states : KEY_STATES.map(([k]) => k);
    const shown = KEY_STATES.filter(([k]) => on.includes(k));
    if (!shown.length) return null;
    // ⚠️ THE CLASS IS WRITTEN OUT, NOT COMPUTED. `class=${cls}` renders identically and is invisible to the orphan scanner, which reads source rather than a running page — so `.c` became a rule with no emitter the moment the key started naming only the states present. Three literals cost nothing.
    const has = (k) => shown.some(([label]) => label === k);
    return html`
        <span class="key" aria-label="What the marks mean">
            ${has('saved') ? html`<span class="l"><i></i>saved</span>` : null}
            ${has('staged') ? html`<span class="s"><i></i>staged</span>` : null}
            ${has('conflict') ? html`<span class="c"><i></i>conflict</span>` : null}
        </span>
    `;
}

export function Shell({ realm, session, view, viewOptions, onSetView, viewSlot, contextSlot, manifestSlot, noticeSlot, footSlot, traySlot, overlaySlot, masthead, badges = {}, stagedOps = null, onDiscardAll = null, tools = null, commands = [], busy = '', busyNote = '', exports: exportScopes = null, exportLabel = '', overlayFor = null, stateKey = false, modeOptions = null, mode = null, onSetMode = null, modeLabel = 'Mode', realmKey = null, meta = null }) {
    const staged = Object.values(badges).reduce((n, v) => n + (Number(v) || 0), 0);
    // 🔴 THE STAGED TRAY IS SHELL-OWNED, MOUNTED 2026-09-04 21:10 EDT, FOR THE SAME REASON THE RAIL IS. The design floats it on every page; the portal had it on no page. Its predecessor was a per-realm `traySlot` that ONE realm passed and nothing ever filled — a shared surface wired realm by realm is a shared surface five realms forget, which is the `badges` defect in another file. `stagedOps` is the ops array every realm already holds; a realm that passes none renders no tray, which is the correct empty state. 🔴 FOURTEEN `data-tip` ATTRIBUTES WERE WRITTEN AND NOTHING READ THEM. The Track's lane headers, its drag handles, the deadline rail and Review's rollback note all carry one, and the portal had no tooltip runtime at all — so every one of those sentences was markup nobody could reach, while `.tip` and `.tip .sub` sat defined and unused in the adopted sheet. An orphan check asks whether a class has a RULE; these had one, which is exactly why it stayed invisible. Installed from the Shell because every realm renders one, and the installer is idempotent. ⚠️ THE DISCARD LIVES HERE, NOT IN SIX REALMS. The tray is shared chrome and its one destructive verb has one meaning everywhere, so a per-realm handler would be six chances to get it slightly different — which is the defect the tray itself is being fixed for. A realm that needs its own may still pass `onDiscardAll`. 🔴 IT DISCARDS CHANGESETS, NOT OPS, because that is what the endpoint takes; the ids are de-duplicated so a five-op changeset is one request rather than five. A refusal is surfaced rather than swallowed — a discard that silently does nothing is worse than one that fails out loud. 🔴 THE PAGE RESERVES ROOM FOR THE TRAY, because the tray is `position:fixed` and would otherwise sit ON TOP of whatever is at the foot of the realm — measured in the design's own comment as covering Broadcast's "+ Post announcement". The design reserves `tray height + 34`; without it the portal measured 49px shorter than the design on every realm, which is that padding exactly. ⚠️ AN OBSERVER, NOT A ONE-SHOT. The design's own note: the tray's height depends on webfont metrics and on its own collapsed state, both of which settle AFTER the frame that renders it, so a single rAF measures the wrong box often enough to leave the overlap live.
    useEffect(() => {
        const main = document.querySelector('main');
        if (!main || typeof ResizeObserver !== 'function') return undefined;
        const apply = () => {
            const t = document.querySelector('.tray');
            const need = t ? t.getBoundingClientRect().height + 34 : 0;
            if (need > 0) main.style.paddingBottom = `${need}px`; else main.style.removeProperty('padding-bottom');
        };
        const ro = new ResizeObserver(apply);
        const t = document.querySelector('.tray');
        if (t) ro.observe(t);
        apply();
        return () => ro.disconnect();
    }, [stagedOps]);
    useEffect(() => { installTips(); }, []);
    // 🔴 THE PAGE ARRIVED ALL AT ONCE AND THE DESIGN STAGGERS IT. One orchestrated entrance — the masthead, then the context strip, then each panel, 55ms apart — is the design's own line ("chrome, then the lanes cascading, then the flags") and the class it needs, `.rise`, was carried over into the stylesheet with nothing to put it on. Skipped entirely under reduced-motion, which is also why it can never affect a settled screenshot.
    useEffect(() => {
        // ⚠️ SEASON ONLY, BECAUSE THAT IS WHERE THE DESIGN DOES IT. Checked across all eight mockup pages: exactly one adds this class. Adding it everywhere was a redesign wearing a port's clothes — and it changed every realm's class signature, which is what an overlay pairs on.
        if (realm !== 'season') return;
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        // ⚠️ AFTER A FRAME. The effect fires when the Shell mounts and the context strip is a CHILD slot, so on the first pass the identity section does not exist yet and never received the class — visible in the overlay as a mockup-only element on a page that renders it.
        requestAnimationFrame(() => document.querySelectorAll('.masthead, .identity, .panel').forEach((el, i) => {
            el.classList.add('rise');
            el.style.animationDelay = `${i * 55}ms`;
        }));
    }, []);
    // The chrome keeps its OWN overlay rather than borrowing the realm's, because sign-out is not a realm's business and every realm would otherwise have to wire it. Both render into the same page; only one can be open, since running any command closes the palette that offered it.
    const chrome = useOverlay();

    // 🔴 CONFIRMED, AND THE FIRST VERSION WAS NOT — corrected 2026-09-04 21:57 EDT, hours after shipping. It was the ONE unconfirmed destructive control in a product built entirely around confirmation, sitting on six screens eight pixels from `Review & commit`, where a right-handed mouse rests. Its identical twin on Review has always been wrapped in a tier-1 danger confirm; the shared-chrome copy shipped without one. ⚠️ AND THE COMMENT ABOVE IT CLAIMED *"a refusal is surfaced rather than swallowed"* while the code read no response at all — a receipt for work that was not done, which is the exact class this repo keeps finding. It reads every answer now and names the first refusal. ⚠️ NO `location.reload()`. A reload throws away every unsaved field on the page — a composer row, two grant inputs, a typed tier-3 confirmation — which is a second destructive act hidden inside the first.
    async function discardAllStaged() {
        const ids = [...new Set((stagedOps || []).map((o) => o.changesetId).filter(Boolean))];
        if (!ids.length) return;
        const n = (stagedOps || []).length;
        chrome.confirm({
            op: 'changeset.discard', tier: 1, danger: true, confirmLabel: 'Discard all',
            title: `Discard all ${n} staged change${n === 1 ? '' : 's'}?`,
            body: html`<p class="dw-p">None of this ever reached Discord, so nothing changes for players.
                Every row you touched goes back to the value it had before.</p>`,
            onConfirm: async () => {
                for (const id of ids) {
                    const res = await fetchJson(`/api/changeset/${id}/discard`, {
                        method: 'POST', headers: { 'x-csrf-token': session?.csrfToken },
                    });
                    const refused = refusalOf(res);
                    if (refused) return chrome.say(`Not discarded — ${refused}`);
                }
                chrome.say(`${n} staged change${n === 1 ? '' : 's'} discarded.`);
                location.hash = location.hash || '#/home';
                setTimeout(() => location.reload(), 400);
            },
        });
    }

    // 🔴 SIGNING OUT IS CONFIRMED, AND THE CONFIRMATION SAYS WHAT HAPPENS TO STAGED WORK. The door page promises staged work is held against your account and comes back when you sign back in; a sign-out that says nothing invites the reader to assume the opposite, one click from the page that promised it. Staging is server-side (models/Changeset.js), so this is a statement of fact, not reassurance.
    function signOut(n) {
        chrome.confirm({
            op: 'session.end', tier: 1, confirmLabel: 'Sign out', danger: true,
            title: 'Sign out of the portal?',
            body: n
                ? html`<p class="dw-p">You have <b>${n} staged change${n === 1 ? '' : 's'}</b>. They stay staged against
                    your account and will be here when you sign back in — signing out ends this browser session only.</p>`
                : html`<p class="dw-p">Nothing is staged. Signing out just ends this browser session.</p>`,
            onConfirm: async () => {
                // requireAdmin verifies CSRF on every non-GET, so the token rides along; the route clears the cookie and 302s to the door.
                await fetch('/auth/logout', { method: 'POST', headers: { 'x-csrf-token': session.csrfToken } }).catch(() => {});
                location.href = '/';
            },
        });
    }

    const allCommands = chromeCommands({ realm, session, viewOptions, onSetView, staged, onSignOut: signOut, chrome }).concat(commands);

    // Lifted out of ExportStrip so the drawer can render outside `main` while the button that opens it

    // stays in the masthead — see ExportDrawer's own comment for the two things nesting it cost.

    const [exportOpen, setExportOpen] = useState(false);


    return html`
        <div class="app" data-realm=${realm}>
            <${Header} realm=${realm} view=${view} session=${session} staged=${staged} chrome=${chrome}
                       commands=${allCommands} onSignOut=${signOut} />
            <${Rail} realm=${realm} realms=${session?.visibleRealms} badges=${badges} />
            <main class=${busy} data-slow=${busyNote || null}>
                <!-- 🔴 THE EXPORT STRIP IS A CHILD OF THE MASTHEAD, NOT A BAND UNDER IT. The design puts
                     .mh-take at grid-row 3 INSIDE .masthead; here it was a sibling, so the masthead measured
                     188px against the design's 246 and every element on the page below it sat at a different
                     y — which a pixel diff reports as ONE region covering the whole page rather than as the
                     8px it actually is. cloneElement rather than a prop the realm passes, because the realm
                     does not have the strip: the Shell builds it from its own exports prop, and threading it back out
                     through seven call sites to hand it in again would be a worse seam than this one. -->
                ${masthead
                    ? (exportScopes && exportScopes.length
                        ? cloneElement(masthead, { take: html`<${ExportStrip} label=${exportLabel || 'Export'} scopes=${exportScopes} overlay=${overlayFor || chrome}
                                                                    open=${exportOpen} onToggle=${() => setExportOpen(!exportOpen)} />` })
                        : masthead)
                    : null}
                <!-- 🔴 THE EXPORT STRIP SITS UNDER THE MASTHEAD ON EVERY REALM THAT HAS ONE, not inside a realm's own
                     view. Export was reachable only through the Manifest's selection bar, so taking a backup of a whole
                     season meant ticking every row of it — and retention rendered nowhere at all, which made "a copy is
                     kept" a sentence in a dialog rather than something anybody could look at. -->

                <!-- 🔴 THE CONTEXT STRIP — COMPANION §10.4's SECOND BAND, WHICH THE SHELL DID NOT HAVE.
                     The composition is masthead, then a context strip that is "a slim bar, never a panel",
                     then the view layer with the strongest treatment, then a recessive Manifest. Three of
                     those four existed here. With nowhere to put the second one, Season put its identity
                     record AND its draft zone INSIDE the view panel, above the Track — so the realm's own
                     subject started 530px below an 806px fold while a paragraph about a season that does
                     not exist sat above it. Measured against season.html the same day: the mockup draws the
                     Track at y=256 and the portal drew the draft block there, which was the single largest
                     region in the whole page diff.
                     ⚠️ IT IS A BAND, NOT A PANEL, and the distinction is the rule. It sits BETWEEN the
                     export strip and the view panel as a sibling of both, so the adjacent-sibling rule (panel plus panel) still pairs
                     the view layer with the Manifest and the Manifest stays recessive. Anything put here
                     must earn a permanent place above the realm's subject; if it is only sometimes present,
                     it belongs inside the view. -->
                ${contextSlot || null}
                <!-- 🔴 NO WRAPPER DIV AROUND EITHER PANEL. the adjacent-sibling rule in app.css (panel plus panel) is what makes the
                     Manifest RECESSIVE — transparent ground, quieter header — which is COMPANION §10.4's whole
                     composition rule: masthead, context strip, view layer, then the mechanism beneath the picture.
                     Two wrapper divs, id view-layer and id manifest-layer, made the panels non-siblings,
                     so the adjacent-sibling selector never matched and the Manifest rendered at the SAME weight as
                     the view layer on every realm — measured rgb(23,30,36) against the mockup's transparent. The
                     stylesheet was carried over and the markup that activates it was not; the ids had no CSS rule
                     and no reader anywhere. Keep these two panels DOM siblings. -->
                ${viewOptions ? html`
                    <section class="panel" aria-label=${`${realmLabelOf(realm)} view`}>
                        <div class="ph">
                            <!-- ⚠️ panelTitle USED TO BE A PROP AND NOTHING EVER PASSED IT. Filed as dead code
                                 alongside tools, which turned out to have a real home (the zoomer). This one
                                 does not: every realm's panel is titled with the realm, the adopted mockups
                                 title them the same way, and a prop that exists so a caller COULD disagree with
                                 that is an invitation rather than a feature. -->
                            <span class="t">${realmLabelOf(realm)}</span>
                            <!-- ⚠️ THE MODE GROUP SITS AHEAD OF THE VIEWS BECAUSE IT IS A LARGER STATEMENT THAN THEY ARE.
                                 A view says which way you are looking at a set; a mode says which set. Reading the bar
                                 left to right then answers "which armory · seen how", which is the order the two
                                 questions actually occur in. It renders only for a realm that passes modeOptions, so no
                                 other realm grows an empty control. -->
                            ${modeOptions ? html`
                                <div class="modesw" role="tablist" aria-label=${modeLabel}>
                                    ${modeOptions.map((m) => html`
                                        <button key=${m} role="tab" data-arm=${m} aria-selected=${m === mode ? 'true' : 'false'}
                                                onClick=${() => onSetMode(m)}>${m}</button>`)}
                                </div>` : null}
                            <div class="seg" role="tablist" aria-label="View">
                                ${viewOptions.map((v) => html`
                                    <button role="tab" aria-selected=${v === view ? 'true' : 'false'} onClick=${() => onSetView(v)}>${v}</button>`)}
                            </div>
                            <!-- ⚠️ ORDER IS THE DESIGN'S, AND IT WAS WRONG. The bar reads title · views · the
                                 view's own controls · what the marks mean · where you are — so the Track's zoom
                                 group sits with the views it changes, and the two explanatory pieces close the
                                 row. the tools slot used to render LAST, which put the zoom group after the key. -->
                            ${tools}
                            ${stateKey ? html`<${StateKey} states=${Array.isArray(stateKey) ? stateKey : null} />` : null}
                            <!-- A realm may add ONE key of its own beside the shared one. The shared key explains SHAPE
                                 (saved/staged/conflict), which every realm draws; a realm key explains marks only that
                                 realm draws. It is a slot rather than a prop of named states, because the only rule that
                                 matters is the one the realm has to enforce itself: name a state only while it is on screen. -->
                            ${realmKey}
                            <!-- The meta line closes the bar: one short right-aligned sentence saying where in the
                                 data you are. Every design draws one and the Shell had no slot for it, so Broadcast
                                 hand-rolled a span inside the tools slot and Season simply had none. -->
                            ${meta ? html`<span class="sp">${meta}</span>` : null}
                        </div>
                        ${viewSlot}
                    </section>`
                : viewSlot}
                <!-- A notice sits BETWEEN the view layer and the Manifest, which is where the design draws it:
                     it is a consequence of what the view just showed, and putting it INSIDE the view panel made
                     the panel 45px taller than the design's and pushed the Manifest down by the same amount. -->
                ${noticeSlot || null}
                ${manifestSlot}
                <!-- 🔴 THE FOOT IS AFTER THE MANIFEST, AND ON SEASON THAT IS WHERE TIER 3 BELONGS. The one-way
                     strip was rendered inside viewSlot, which put seven irreversible operations at y=1694 on a
                     4,395px page — ABOVE the inventory they destroy, and 1,300px before the page ends. The mockup
                     puts it last (y=3535 of 4038) and CLAUDE.md's own description says tier 3 lives "at the foot
                     of Season"; the code disagreed with both. Nothing above the fold could show it: the whole
                     ordering lives below 888px, which is exactly as far as the page diff could see until now.
                     ⚠️ Deliberately NOT a .panel — OneWay's root is section.ow, so it does not enter the
                     adjacent-sibling chain that makes the Manifest recessive. -->
                ${footSlot || null}
            </main>
            <${StagedTray} ops=${stagedOps} onDiscardAll=${onDiscardAll || discardAllStaged} busy=${Boolean(busy)}
                           inert=${exportOpen} />
            ${traySlot || null}
            ${overlaySlot || null}
            ${exportScopes && exportScopes.length && exportOpen
                ? html`<${ExportDrawer} scopes=${exportScopes} overlay=${overlayFor || chrome} onClose=${() => setExportOpen(false)} />` : null}
            ${chrome.render()}
        </div>
    `;
}

// Every realm's initial-load error state renders through this one component instead of duplicating the same inline <p> (simplify Simplification #6).
export function NoAccess() {
    return html`<p class="empty" style="padding:24px">You do not have access to this realm.</p>`;
}

export function Door({ forbidden }) {
    // 🔴 THREE DOOR STATES READ IDENTICALLY (spec §10) — a stranger, a never-granted account and a revoked admin all see this page. `forbidden` adds ONE line and changes nothing else, because telling a stranger which of the three they are is telling them something about the account they just tried.
    //
    // The door has no rail, no tray and no realm: it is the only surface a signed-OUT person can reach, so it must not imply the app is already open behind it. And what it says about the OAuth request has to be literally what the request asks for — if this list ever stops matching portal/auth.js's scope, this page is lying to a stranger, which is the one thing it exists not to do.
    return html`
        <main class="door">
            <div class="doorcard">
                <span class="doormk"><span class="glyph"></span>DIOREO<b>/</b>PORTAL</span>
                ${forbidden ? html`
                    <div class="dfail">
                        <${Icon} name="triangle-alert" cls="lg" />
                        <span><b>That account is not an admin.</b> Signing in worked; you have no permissions here.
                            Ask the owner to grant you access, then sign in again.</span>
                    </div>` : null}
                <!-- ⚠️ THE ONE FACT A STRANGER IS OWED, and the page did not state it: nothing about their
                     account exists here yet. It reads in the muted absent-value voice the rest of the console
                     uses, because it is a fact rather than a warning. -->
                <p class="doorstate">Signed in as <span class="none">nobody</span></p>
                <h1>Sign in with Discord</h1>
                <p>The portal is for Dioreo's admins. It uses your Discord account — there is no separate password to
                   create, and none to lose.</p>

                <a class="dbtn" href="/auth/login">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5c1.6.4 2.9 1 4.2 1.8a16.6 16.6 0 0 0-14.7 0A17 17 0 0 1 8.9 3.5L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.9 8.5.2 12.5.5 16.4a19.9 19.9 0 0 0 6 3l1.2-1.9c-.7-.2-1.3-.5-1.9-.9l.4-.3a14.2 14.2 0 0 0 11.6 0l.5.3c-.6.4-1.3.7-2 .9l1.2 1.9a19.8 19.8 0 0 0 6-3c.5-4.6-.6-8.6-3.2-12zM8.5 14.2c-1.2 0-2.1-1.1-2.1-2.4S7.3 9.4 8.5 9.4s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>
                    Continue with Discord
                </a>

                <div class="dnote">
                    <svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1.5"></rect><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"></path></svg>
                    <span>Being signed in is not the same as being allowed. Every request re-checks your permissions
                        server-side — the portal never trusts this browser about what you may see or do.</span>
                </div>
                <div class="dnote">
                    <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"></circle><path d="M8 5v3.5L10 10"></path></svg>
                    <span>A session lasts 12 hours and lives in this browser only. <b>Your staged work does not</b> — it
                        is held against your account, so signing out or losing this tab does not discard it, and signing
                        back in returns you to it.</span>
                </div>
                <div class="dnote">
                    <svg viewBox="0 0 16 16"><path d="M8 2l5 2v4c0 3-2.1 5.3-5 6-2.9-.7-5-3-5-6V4l5-2z"></path></svg>
                    <span>Dioreo reads only your Discord user ID and username — that is the whole request. It asks for
                        no email, no servers, no messages and no friends, and nothing is posted or changed on your
                        account.</span>
                </div>
            </div>
        </main>
    `;
}
