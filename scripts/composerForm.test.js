// scripts/composerForm.test.js
//
// The composer's form, after it became a modal drawer and grew the fields /manage always had.
//
// 🔴 EVERY CHECK HERE IS ABOUT A FIELD THAT USED TO BE HARDCODED OR ABSENT. The portal could create a draw with no items and no thumbnail and a patch note with an empty body, because `buildSeasonAddOp` wrote `items: []`, `description: ''`, `urls1: []`, `urls2: []` into the payload and nothing collected them. Those are not rendering bugs — they are records saved wrong — so they are tested at the payload, which is the only place the difference is visible without a browser.
const assert = require('assert');
const { Readable } = require('stream');

let failures = 0;
function check(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); }
    catch (e) { failures++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}

const { composerReason, composerFields, splitPatchUrls } = require('../portal/ui/composer.logic');
const { buildSeasonAddOp, buildSeasonAddOps } = require('../portal/ui/season.logic');

const DRAW = { key: 'draw', shape: 'point', windowable: true };
const EVENT = { key: 'event', shape: 'span' };
const PATCH = { key: 'patchnote', shape: 'point' };
const base = { type: 'draw', name: 'Crimson Moonlight', aText: '2026-09-21', aIso: '2026-09-21', bText: '', bIso: null,
    items: '', itemRows: [], itemErrors: [], note: '', thumb: '', description: '', urls: '', doubleCP: false };

// ── D2: one composer entry, one or two ops ────────────────────────────────────────────────────
check('a draw with no closing date stages exactly ONE op', () => {
    const ops = buildSeasonAddOps('draw', composerFields(base, DRAW));
    assert.strictEqual(ops.length, 1);
    assert.strictEqual(ops[0].type, 'draw.add');
    assert.strictEqual(ops[0].payload.date, '2026-09-21');
    assert.ok(!('windowEnd' in ops[0].payload), 'windowEnd is not a field the draw schema declares');
    assert.ok(!('startDate' in ops[0].payload), 'a draw has one date and no start');
});

check('a draw WITH a closing date stages the draw AND its calendar window', () => {
    const state = { ...base, bText: 'oct 5', bIso: '2026-10-05' };
    const ops = buildSeasonAddOps('draw', composerFields(state, DRAW));
    assert.strictEqual(ops.length, 2, 'the window is a second op, not a second field');
    assert.strictEqual(ops[0].type, 'draw.add');
    assert.strictEqual(ops[1].type, 'calendar.add');
    // The category is the one KIND_TO_CALENDAR_CATEGORY gives `drawwindow`, never a literal at the call site.
    assert.strictEqual(ops[1].payload.category, 'Draw');
    assert.strictEqual(ops[1].payload.title, 'Crimson Moonlight', 'one entry, one title — that is the point');
    assert.strictEqual(ops[1].payload.startDate, '2026-09-21', 'the window opens on the release, never on today');
    assert.strictEqual(ops[1].payload.endDate, '2026-10-05');
});

check('THE TWO-OP CHECK CAN FAIL: a returning draw takes the same path', () => {
    const ops = buildSeasonAddOps('returning', composerFields({ ...base, type: 'returning', bIso: '2026-10-05' },
        { key: 'returning', shape: 'point', windowable: true }));
    assert.strictEqual(ops.length, 2);
    assert.strictEqual(ops[0].payload.category, 'returning');
});

// ── Pin 11: the draw form's missing fields ────────────────────────────────────────────────────
check('items reach the payload, and the note is stored as the comment item /manage stores', () => {
    const state = { ...base, itemRows: [{ tier: 'mythic', name: 'Ghost' }, { tier: 'legendary', name: 'Fennec' }],
        note: 'Character bundle only' };
    const op = buildSeasonAddOp('draw', composerFields(state, DRAW));
    assert.deepStrictEqual(op.payload.items, [
        { tier: 'mythic', name: 'Ghost' },
        { tier: 'legendary', name: 'Fennec' },
        { tier: 'comment', name: 'Character bundle only' },
    ], 'the note is an item with tier "comment" — utils/adminParser.js\'s own shape for a "-#" line');
});

check('a blank thumbnail is ABSENT from the payload, not an empty string', () => {
    // core/ops/draws.js spreads the payload straight onto the subdocument, and an empty string is a stored value that means "no image", where an absent key means "reuse whatever is cached for this title".
    assert.ok(!('thumbnailUrl' in buildSeasonAddOp('draw', composerFields(base, DRAW)).payload));
    const withThumb = buildSeasonAddOp('draw', composerFields({ ...base, thumb: '  https://x/y.png  ' }, DRAW));
    assert.strictEqual(withThumb.payload.thumbnailUrl, 'https://x/y.png');
});

// ── Pin 13: the patch-note form's missing fields ──────────────────────────────────────────────
check('a patch note carries its description and both image slots', () => {
    const state = { ...base, type: 'patchnote', name: 'Season 8', description: 'b: buffed the AK',
        urls: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((u) => `https://i/${u}.png`).join('\n') };
    const op = buildSeasonAddOp('patchnote', composerFields(state, PATCH));
    assert.strictEqual(op.type, 'patchnote.addSeason');
    assert.strictEqual(op.payload.titleOverride, 'Season 8');
    assert.strictEqual(op.payload.releaseDate, '2026-09-21');
    assert.strictEqual(op.payload.description, 'b: buffed the AK');
    assert.strictEqual(op.payload.urls1.length, 5, 'the first five are slot 1, as /manage splits them');
    assert.strictEqual(op.payload.urls2.length, 2);
});

check('splitPatchUrls reports what would be DROPPED rather than silently truncating', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `https://i/${i}.png`).join('\n');
    const { urls1, urls2, over } = splitPatchUrls(twelve);
    assert.strictEqual(urls1.length, 5);
    assert.strictEqual(urls2.length, 5);
    assert.strictEqual(over, 2, 'the form says so on screen; a silent drop is the failure a preview prevents');
    assert.deepStrictEqual(splitPatchUrls('').urls1, []);
});

check('an event carries its Double CP flag as a stored field, not as a title', () => {
    const op = buildSeasonAddOp('event', composerFields({ ...base, type: 'event', bIso: '2026-10-05', doubleCP: true }, EVENT));
    assert.strictEqual(op.payload.isDoubleCP, true);
    assert.strictEqual(buildSeasonAddOp('event',
        composerFields({ ...base, type: 'event', bIso: '2026-10-05' }, EVENT)).payload.isDoubleCP, false);
});

// ── harden lens: the button says WHY it is disabled, and a blank optional field is not a reason ─
check('a blank draw window is a complete answer, and does not hold the button', () => {
    assert.strictEqual(composerReason(base, DRAW), null);
});

check('a TYPED closing date that does not resolve holds the button and says which one', () => {
    const r = composerReason({ ...base, bText: 'sometime after the thing', bIso: null }, DRAW);
    assert.strictEqual(r, 'That closing date does not resolve to a day yet.');
});

check('a window that closes before the draw releases is refused by name', () => {
    const r = composerReason({ ...base, bText: 'sep 1', bIso: '2026-09-01' }, DRAW);
    assert.strictEqual(r, 'The window closes before the draw releases.');
});

check('THE REASON CHECK CAN FAIL: the span rules are untouched', () => {
    assert.strictEqual(composerReason({ ...base, type: 'event', bText: '', bIso: null }, EVENT), 'Set a closing date.');
    assert.strictEqual(composerReason({ ...base, name: '  ' }, DRAW), 'Give it a name.');
});

// ── D2: the creation kind is gone from the surface, not just from the builder ──────────────────
check('drawwindow is no longer a COMPOSE_TYPE, and no longer an ADD_CHIP', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'portal/ui/season.js'), 'utf8');
    const composeBlock = src.slice(src.indexOf('const COMPOSE_TYPES = ['), src.indexOf('const ADD_CHIPS = ['));
    const chipBlock = src.slice(src.indexOf('const ADD_CHIPS = ['), src.indexOf('];', src.indexOf('const ADD_CHIPS = [')));
    // The falsifier: these two blocks must actually have been found, or every assertion below is vacuous.
    assert.ok(composeBlock.includes("key: 'draw'") && composeBlock.length > 200, 'COMPOSE_TYPES was not located');
    assert.ok(chipBlock.includes("key: 'draw'"), 'ADD_CHIPS was not located');
    assert.ok(!composeBlock.includes("key: 'drawwindow'"), 'a draw window is a property of a draw, not a kind you pick');
    assert.ok(!chipBlock.includes("key: 'drawwindow'"), 'the masthead still offers the removed kind');
    assert.ok(!chipBlock.includes("key: 'patchnote'"), 'the record panel CTA is the ONE entry point (Pin 13b)');
    assert.ok(composeBlock.includes("key: 'patchnote'"), 'patchnote is still a kind — only its chip moved');
});

// ── the new route ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ THE ROUTE IS DRIVEN, NOT DESCRIBED. Testing `parseItemLine` alone would prove the parser works and say nothing about the endpoint the drawer actually calls — which is where the last three portal defects of this shape lived (a stub whose regex never matched, a route registered for one method and stubbed for the other). `requireAdmin` is replaced in the module cache because auth is not what is under test here.
const asyncChecks = [];
function checkAsync(name, fn) { asyncChecks.push(fn().then(() => console.log(`  ✓ ${name}`),
    (e) => { failures++; console.error(`  ✗ ${name}\n      ${e.message}`); })); }

checkAsync('POST /api/parse-items answers { items, errors } in the bot\'s own tier vocabulary', async () => {
    let captured = null;
    const authPath = require.resolve('../portal/auth');
    const saved = require.cache[authPath];
    require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { requireAdmin: (fn) => fn } };
    delete require.cache[require.resolve('../portal/api/dates')];
    const routes = [];
    require('../portal/api/dates').register((method, re, handler) => routes.push({ method, re, handler }));
    if (saved) require.cache[authPath] = saved; else delete require.cache[authPath];
    const hit = routes.find((r) => r.method === 'POST' && r.re.test('/api/parse-items'));
    assert.ok(hit, 'POST /api/parse-items is not registered');
    const req = Readable.from([JSON.stringify({ text: 'm ghost\nl fennec\n-# bundle only\n-#\n' })]);
    const res = { writeHead() {}, end(text) { captured = JSON.parse(text); } };
    await hit.handler(req, res, new URL('http://x/api/parse-items'));
    assert.ok(captured, 'the route answered nothing');
    assert.deepStrictEqual(captured.items, [
        { tier: 'mythic', name: 'Ghost' },
        { tier: 'legendary', name: 'Fennec' },
        // ⚠️ NOT title-cased, and that is the parser's own documented behaviour rather than an oversight: a "-#" line is a free-text note, and toTitleCase mangles a sentence. The first draft of this test asserted "Bundle only" and the code was right.
        { tier: 'comment', name: 'bundle only' },
    ], 'the tiers and the title-casing are utils/adminParser.js\'s, not a browser copy');
    // A line that leaves no name behind is REPORTED, never dropped — the same contract /api/parse-bulk keeps.
    assert.deepStrictEqual(captured.errors, [{ line: 4, text: '-#' }]);
});

Promise.all(asyncChecks).then(() => process.exit(failures ? 1 : 0));
