// scripts/portalChrome.test.js — the shared chrome's pure halves, and the one invariant that keeps a native dialog out of the portal.
//
// The chrome is the part every realm renders inside, so a defect here is eight defects. These are the pieces that can be checked without a browser: how the command bar ranks what you typed, whether ⌘K knows to stand down behind a modal, and whether a typed confirmation actually gates.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { paletteHits, paletteBlocked } = require('../portal/ui/palette.logic');
const { typedConfirmReady } = require('../portal/ui/overlay.logic');
const { permsAfter, describePending } = require('../portal/ui/access.logic');
const { composerReason, composerFields } = require('../portal/ui/composer.logic');
const { windowDays, clampWindow, zoomWindow, panWindow } = require('../portal/ui/season.logic');

let failures = 0;
function check(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); }
    catch (e) { failures++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}

console.log('portalChrome — the command bar, the modal guard, the typed gate');

// ── THE COMMAND BAR ──────────────────────────────────────────────────────────────────────────
const CMDS = [
    { label: 'Rack', local: true },
    { label: 'Coverage', local: true },
    { label: 'Add a build', local: true, keywords: ['new', 'create'] },
    { label: 'Access' },
    { label: 'Analytics' },
    { label: 'Sign out', keywords: ['logout', 'end session'] },
];

check('an empty query offers everything, in the order it was declared', () => {
    assert.deepStrictEqual(paletteHits(CMDS, '').map((c) => c.label), CMDS.map((c) => c.label));
    assert.deepStrictEqual(paletteHits(CMDS, '   ').map((c) => c.label), CMDS.map((c) => c.label));
});

check('a query that matches nothing returns nothing, so the empty state is reachable', () => {
    assert.deepStrictEqual(paletteHits(CMDS, 'zzzz'), []);
});

check('matching is case-insensitive in both directions', () => {
    assert.deepStrictEqual(paletteHits(CMDS, 'ACCESS').map((c) => c.label), ['Access']);
    assert.deepStrictEqual(paletteHits([{ label: 'ADD A BUILD' }], 'add').map((c) => c.label), ['ADD A BUILD']);
});

// 🔴 THE WHOLE POINT OF RANKING. "a" appears inside half of these labels, so an unranked filter answers a one-letter query with a list whose first row is whatever happened to be declared first.
check('a prefix match outranks a mere containment', () => {
    const hits = paletteHits([{ label: 'Clear the filters' }, { label: 'Armory' }], 'ar').map((c) => c.label);
    assert.deepStrictEqual(hits, ['Armory', 'Clear the filters'], 'Armory starts with the query; Clear only contains it');
});

check('a keyword match is the last tier, behind both label tiers', () => {
    const cmds = [{ label: 'Sign out', keywords: ['logout'] }, { label: 'Logbook' }];
    assert.deepStrictEqual(paletteHits(cmds, 'log').map((c) => c.label), ['Logbook', 'Sign out']);
});

check('being on this realm is a tiebreak, not an override', () => {
    // 'season' PREFIXES the global entry (rank 0) and is merely CONTAINED in the local one (rank 1 - 0.5), so the global still wins: locality is worth half a tier, never a whole one.
    const cmds = [{ label: 'Season' }, { label: 'Clamp to the season', local: true }];
    assert.deepStrictEqual(paletteHits(cmds, 'season').map((c) => c.label), ['Season', 'Clamp to the season']);
    // At the SAME tier — both prefixes — local wins.
    const same = [{ label: 'Season' }, { label: 'Search this page', local: true }];
    assert.deepStrictEqual(paletteHits(same, 'sea').map((c) => c.label), ['Search this page', 'Season']);
});

check('a command with no label and no keywords never matches, rather than matching everything', () => {
    assert.deepStrictEqual(paletteHits([{}], 'x'), []);
});

// ── ⌘K BEHIND A MODAL ────────────────────────────────────────────────────────────────────────
//
// This is the case a browser pass would not have caught either: the shortcut appears to work, the input takes focus, and nothing can be typed into it because the header is inert. The guard is the only thing standing between that and a page that looks broken.
const fakeDoc = (sel) => ({ querySelector: (q) => (q === sel ? {} : null) });

check('the command bar opens normally when no drawer is open', () => {
    assert.strictEqual(paletteBlocked(fakeDoc(null)), false);
});

check('the command bar is BLOCKED while a drawer is open — inert does not stop a document keydown', () => {
    assert.strictEqual(paletteBlocked(fakeDoc('.drawer.open')), true);
});

check('a missing or hostless document is not treated as blocked', () => {
    assert.strictEqual(paletteBlocked(null), false);
    assert.strictEqual(paletteBlocked({}), false);
});

// ── THE TYPED CONFIRMATION ───────────────────────────────────────────────────────────────────
check('the exact word opens the gate', () => {
    assert.strictEqual(typedConfirmReady('1139845545754632283', '1139845545754632283'), true);
});

check('surrounding whitespace is forgiven; a wrong character is not', () => {
    assert.strictEqual(typedConfirmReady('  AB12 ', 'AB12'), true);
    assert.strictEqual(typedConfirmReady('ab12', 'AB12'), false, 'case must matter');
    assert.strictEqual(typedConfirmReady('AB1', 'AB12'), false);
    assert.strictEqual(typedConfirmReady('AB123', 'AB12'), false);
});

// 🔴 THE VACUOUS PASS THIS EXISTS TO PREVENT. If an expectation goes missing — a caller that forgets `typed`, a changeset whose confirmText never got written — an empty-equals-empty comparison would return true and quietly turn a tier-3 drawer into a one-click destructive button.
check('an ABSENT expectation is never satisfied', () => {
    assert.strictEqual(typedConfirmReady('', ''), false);
    assert.strictEqual(typedConfirmReady('', null), false);
    assert.strictEqual(typedConfirmReady('anything', undefined), false);
});

// ── NO NATIVE DIALOGS, EVER AGAIN ────────────────────────────────────────────────────────────
//
// 🔴 A CONSERVATION GATE, NOT A STYLE RULE. board.js kept a native confirm() through the entire overlay build precisely because it WORKED — nothing was broken, so nothing looked. A browser dialog cannot carry a tier, cannot name the operation, cannot be made modal on the portal's own terms and cannot be styled at all, which is why the shared drawer exists; the count of native dialogs in portal/ui must be zero and stay zero.
check('no native confirm/alert/prompt survives anywhere in portal/ui', () => {
    const dir = path.join(__dirname, '..', 'portal', 'ui');
    const offenders = [];
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js'))) {
        fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((line, i) => {
            if (/^\s*(\/\/|\*|<!--)/.test(line.trim()) || line.includes('-->')) return;
            const m = line.match(/(?<![.\w$])(confirm|alert|prompt)\s*\(/);
            if (m) offenders.push(`portal/ui/${f}:${i + 1}  ${m[0]}`);
        });
    }
    assert.deepStrictEqual(offenders, [], 'a native dialog cannot say a tier or name an operation:\n  ' + offenders.join('\n  '));
});

check('THE DIALOG GATE CAN FAIL: a bare confirm( is caught and a namespaced one is not', () => {
    const hit = (s) => /(?<![.\w$])(confirm|alert|prompt)\s*\(/.test(s);
    assert.ok(hit('if (confirm(\'sure?\')) go();'), 'a bare native call must be caught');
    assert.ok(!hit('overlay.confirm({ title: 1 })'), 'the shared drawer must not be a false positive');
    assert.ok(!hit('confirmDiscard(c)'), 'a function whose NAME contains confirm must not be a false positive');
});

// ── THE ACCESS GRID'S RECOMPUTED PERMISSION LIST ─────────────────────────────────────────────
//
// The grid stages toggles and then writes the WHOLE list, because /api/access/grant replaces it. That makes the recomputation the one place a permission can be silently gained or lost.
check('a toggle on adds the scope and a toggle off removes it', () => {
    assert.deepStrictEqual(permsAfter(['manage.draws'], { 'manage.calendar': true }).sort(),
        ['manage.calendar', 'manage.draws']);
    assert.deepStrictEqual(permsAfter(['manage.draws', 'bot'], { bot: false }), ['manage.draws']);
});

check('no pending changes leaves the list exactly as it was', () => {
    assert.deepStrictEqual(permsAfter(['bot', 'manage'], {}), ['bot', 'manage']);
    assert.deepStrictEqual(permsAfter(['bot'], null), ['bot']);
});

// 🔴 A LIVE DOCUMENT CAN ALREADY HOLD A DUPLICATE. parsePermissionsInput accepts "manage, manage.draws", so a token can appear twice in models/AdminUser.js's array — and adding one with concat would make it three. Every duplicate is invisible in the grid and permanent.
check('the result is a SET, so an existing duplicate cannot be multiplied', () => {
    assert.deepStrictEqual(permsAfter(['bot', 'bot'], { bot: true }), ['bot']);
    assert.deepStrictEqual(permsAfter(['bot', 'bot'], { bot: false }), []);
});

check('turning a scope on that is already held changes nothing', () => {
    assert.deepStrictEqual(permsAfter(['manage'], { manage: true }), ['manage']);
});

check('the confirmation names the acts, split by direction, sorted', () => {
    const d = describePending({ b: true, a: false, c: true }, (k) => k.toUpperCase());
    assert.deepStrictEqual(d, { granted: ['B', 'C'], revoked: ['A'] });
    assert.deepStrictEqual(describePending({}, null), { granted: [], revoked: [] });
});

// ── THE COMPOSER ─────────────────────────────────────────────────────────────────────────────
const POINT = { key: 'draw', shape: 'point' };
const SPAN = { key: 'event', shape: 'span' };
const ready = { name: 'Clan Wars', aText: 'sep 21', aIso: '2026-09-21', bText: 'sep 30', bIso: '2026-09-30' };

check('the reason names what is missing, one thing at a time', () => {
    assert.strictEqual(composerReason({}, null), 'Pick what you are adding.');
    assert.strictEqual(composerReason({ name: '   ' }, POINT), 'Give it a name.');
    assert.strictEqual(composerReason({ name: 'x' }, POINT), 'Set a date.');
});

// 🔴 AN UNPARSED VALUE IS A DIFFERENT FAILURE FROM AN EMPTY ONE, and saying so is the whole point of parsing as you type: "set a date" reads as though you had not typed anything, which is wrong and unhelpful when you typed something the parser refused.
check('a typed-but-unresolved date says so, rather than reading as empty', () => {
    assert.strictEqual(composerReason({ name: 'x', aText: 'tuesdayish', aIso: null }, POINT),
        'That first date does not resolve to a day yet.');
    assert.strictEqual(composerReason({ ...ready, bText: 'whenever', bIso: null }, SPAN),
        'That second date does not resolve to a day yet.');
});

check('a window that closes before it opens is refused', () => {
    assert.strictEqual(composerReason({ ...ready, aIso: '2026-09-30', bIso: '2026-09-21' }, SPAN), 'It closes before it opens.');
    assert.strictEqual(composerReason({ ...ready, aIso: '2026-09-21', bIso: '2026-09-21' }, SPAN), null, 'the same day is a valid one-day window');
});

check('a complete point and a complete span both clear', () => {
    assert.strictEqual(composerReason({ name: 'Draw', aIso: '2026-09-21' }, POINT), null);
    assert.strictEqual(composerReason(ready, SPAN), null);
});

// 🔴 A POINT'S DATE IS THE END DATE. buildSeasonAddOp reads a draw's date from `endDate` — its schema field is `date` and there is no start — so putting the one date in `startDate` would stage a draw with no date at all, and the op would fail validation somewhere far from here.
check('a point puts its one date where the op reads it', () => {
    assert.deepStrictEqual(composerFields({ name: ' Crimson ', aIso: '2026-09-21' }, POINT),
        { title: 'Crimson', startDate: '', endDate: '2026-09-21' });
});

check('a span fills both ends', () => {
    // isDoubleCP rides on every event since the composer drawer gained the Double CP preset (2026-09-06 01:49 EDT); false is the honest default, not an absence.
    assert.deepStrictEqual(composerFields(ready, SPAN),
        { title: 'Clan Wars', startDate: '2026-09-21', endDate: '2026-09-30', isDoubleCP: false });
});

// ── THE TRACK'S VISIBLE WINDOW ───────────────────────────────────────────────────────────────
const FULL = { start: '2026-08-01', end: '2026-09-30' };   // 60 days

check('the span is measured in whole days', () => {
    assert.strictEqual(windowDays(FULL), 60);
    assert.strictEqual(windowDays({ start: '2026-08-01', end: '2026-08-02' }), 1);
});

// 🔴 PANNING PAST THE ENDS WOULD SHOW EMPTY AXIS on a plot whose own subject is "what is in this season". The clamp SLIDES a window that fits back inside rather than squashing it — losing days on a pan is the kind of quiet wrongness nobody reports because the picture still looks plausible.
check('a window that fits is slid back inside, never narrowed', () => {
    const out = clampWindow({ start: '2026-07-20', end: '2026-08-09' }, FULL);   // 20 days, starting early
    assert.strictEqual(out.start, '2026-08-01');
    assert.strictEqual(windowDays(out), 20, 'the span survives the clamp');
    const late = clampWindow({ start: '2026-09-25', end: '2026-10-15' }, FULL);
    assert.strictEqual(late.end, '2026-09-30');
    assert.strictEqual(windowDays(late), 20);
});

check('a window wider than the season becomes the season', () => {
    assert.deepStrictEqual(clampWindow({ start: '2026-01-01', end: '2026-12-31' }, FULL), FULL);
});

// ⚠️ A THREE-DAY FLOOR, because barGeometry divides by the window and a one-day span makes every bar the full width — the same collapse a season with no bpEnd produced, from the other direction.
check('zooming in stops at a floor rather than collapsing the axis', () => {
    let win = FULL;
    for (let i = 0; i < 30; i++) win = zoomWindow(win, 0.625, FULL);
    assert.ok(windowDays(win) >= 3, `floor held at ${windowDays(win)} days`);
});

check('zooming out never exceeds the season, and FIT is reachable', () => {
    let win = zoomWindow(FULL, 0.5, FULL);
    for (let i = 0; i < 10; i++) win = zoomWindow(win, 1.6, FULL);
    assert.deepStrictEqual(win, FULL);
});

// The anchor is what makes repeated zooming feel like moving rather than jumping: zoom with the pointer over a bar and that bar stays under the pointer.
check('the zoom anchor decides which edge holds still', () => {
    const left = zoomWindow(FULL, 0.5, FULL, 0);
    assert.strictEqual(left.start, FULL.start, 'anchored at 0, the start does not move');
    const right = zoomWindow(FULL, 0.5, FULL, 1);
    assert.strictEqual(right.end, FULL.end, 'anchored at 1, the end does not move');
});

check('panning moves the window and stops at the edges', () => {
    const win = { start: '2026-08-10', end: '2026-08-20' };
    assert.deepStrictEqual(panWindow(win, 5, FULL), { start: '2026-08-15', end: '2026-08-25' });
    const hitLeft = panWindow(win, -100, FULL);
    assert.strictEqual(hitLeft.start, FULL.start);
    assert.strictEqual(windowDays(hitLeft), 10, 'the span survives hitting the edge');
});

// ── THE MODULE-PARSE GATE ────────────────────────────────────────────────────────────────────
//
// 🔴 `node --check` PARSES AS COMMONJS, so it is a FALSE GREEN on these files. A stray backtick inside an HTML comment inside an html`` template closes the template early; the result parses fine as a script and fails as a module, which means the CommonJS check passes and the browser gets a SyntaxError. It has fired five times on this branch, twice inside the comment documenting the previous occurrence. buildPortal now parses every ESM file the way the browser will; this proves that check is not vacuous.
const { spawnSync } = require('child_process');
const parsesAsModule = (src) => spawnSync(process.execPath, ['--input-type=module', '--check'], { input: src, encoding: 'utf8' }).status === 0;

check('THE MODULE GATE CAN FAIL: a backtick inside an HTML comment in a template is caught', () => {
    const good = 'export const a = html`<div><!-- a plain comment --></div>`;';
    const bad = 'export const a = html`<div><!-- a comment with a ' + String.fromCharCode(96) + 'chip' + String.fromCharCode(96) + ' in it --></div>`;';
    assert.strictEqual(parsesAsModule(good), true, 'the clean form must pass, or the gate proves nothing');
    assert.strictEqual(parsesAsModule(bad), false, 'the backtick form must fail — this is the trap the gate exists for');
});

// 🔴 AN EVEN NUMBER OF BACKTICKS IS THE CASE THE PARSE GATE CANNOT SEE, and it is worse than the odd one. Two backticks inside an HTML comment CLOSE the template and REOPEN it, so the prose between them becomes an expression: the file parses cleanly as a module, the build passes, and the page renders blank with `Cannot read properties of null (reading 'bed')` — the class name I had quoted. The odd case fails loudly at parse time; this one ships. A source rule is the only thing that catches both.
check('no backtick appears inside an HTML comment in a template', () => {
    const dir = path.join(__dirname, '..', 'portal', 'ui');
    const offenders = [];
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js'))) {
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        for (const m of src.matchAll(/<!--[\s\S]*?-->/g)) {
            if (!m[0].includes('`')) continue;
            offenders.push(`portal/ui/${f}:${src.slice(0, m.index).split('\n').length}`);
        }
    }
    assert.deepStrictEqual(offenders, [], 'a backtick here closes the surrounding template — say the class name in plain words:\n  ' + offenders.join('\n  '));
});

// 🔴 THE GATE FOR A MISTAKE THAT PARSES. A *.logic.js sibling loads as a classic script and exports nothing, so importing one is valid module syntax that throws at LOAD — the page renders blank and the build reports success. Made twice: season.js, and tips.js on 2026-08-26. `scripts/buildPortal.js`'s assertNoLogicImport refuses the build now; this is its falsifier.
check('no ESM file imports a .logic.js sibling as a module', () => {
    const fs = require('fs'), path = require('path');
    const UI = path.join(__dirname, '..', 'portal', 'ui');
    // ⚠️ COMMENTS STRIPPED FIRST: three files name this trap in the comment that records it, and the first version of this check flagged all three. A gate that cannot tell code from prose punishes the files that document the bug best.
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    const files = fs.readdirSync(UI).filter((f) => f.endsWith('.js') && !f.endsWith('.logic.js'));
    const offenders = files.filter((f) => /import\s[^;]*?from\s+'\.\/[\w.-]+\.logic\.js'/.test(strip(fs.readFileSync(path.join(UI, f), 'utf8'))));
    assert.deepStrictEqual(offenders, [], `${offenders.join(', ')} imports a classic script as a module — it exports nothing and the page will render blank`);
    // The strip must not have blanked the files, or this check is vacuous.
    assert.ok(files.some((f) => /import\s/.test(strip(fs.readFileSync(path.join(UI, f), 'utf8')))), 'stripping removed the imports too — this check now sees nothing');
});

check('THE LOGIC-IMPORT GATE CAN FAIL: an import of a .logic sibling is caught', () => {
    const bad = "import { tipPlacement } from './tips.logic.js';";
    const good = "import { Shell } from './shell.js';";
    const rule = /import\s[^;]*?from\s+'\.\/[\w.-]+\.logic\.js'/;
    assert.ok(rule.test(bad), 'the trap form must match, or the gate proves nothing');
    assert.ok(!rule.test(good), 'an ordinary module import must NOT match, or the gate bans the normal case');
});

check('THE BACKTICK-IN-COMMENT GATE CAN FAIL: an even pair inside a comment is caught', () => {
    const tick = String.fromCharCode(96);
    const bad = '<!-- the ' + tick + '.bed' + tick + ' class is the split -->';
    assert.ok([...bad.matchAll(/<!--[\s\S]*?-->/g)].some((m) => m[0].includes(tick)));
    assert.ok(![...'<!-- the .bed class is the split -->'.matchAll(/<!--[\s\S]*?-->/g)].some((m) => m[0].includes(tick)));
});

check('every ESM file the build emits parses as a module', () => {
    const dir = path.join(__dirname, '..', 'portal', 'ui');
    const bad = fs.readdirSync(dir)
        .filter((f) => f.endsWith('.js') && !f.endsWith('.logic.js'))
        .filter((f) => !parsesAsModule(fs.readFileSync(path.join(dir, f), 'utf8')));
    assert.deepStrictEqual(bad, [], 'these would reach the browser as a SyntaxError: ' + bad.join(', '));
});

process.exit(failures ? 1 : 0);
