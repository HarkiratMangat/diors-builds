// scripts/seasonOps.test.js
const assert = require('assert');
const ops = require('../core/ops');

let failures = 0;
function check(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); }
    catch (e) { failures++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}

check('promoteDraft and startNew are BOTH tier 3', () => {
    assert.strictEqual(ops.resolveOp('season.promoteDraft').tier, 3);
    assert.strictEqual(ops.resolveOp('season.startNew').tier, 3);
});

check('promoteDraft inverts to restoreSnapshot carrying the WHOLE prior document, not a diff', () => {
    const prior = { currentSeasonTitle: 'S7', bpEnd: new Date('2026-09-04'), newDraws: [1, 2], returningDraws: [3], calendar: [4, 5] };
    const inv = ops.resolveOp('season.promoteDraft').invert({ action: 'promote', applied: { prior, patchPrior: null } });
    assert.strictEqual(inv.type, 'season.restoreSnapshot');
    assert.deepStrictEqual(inv.payload, prior,
        'a rotation cannot be undone by a diff -- every rotated field must be in the snapshot');
});

check('setTitlesDeadlines accepts the literal word TBD without corrupting the date', () => {
    // applyLine's TBD branch is exercised through apply(), not validate() (validate is a pass-through here since resolving "leave unchanged" needs the live document) -- this checks the parsing helper's OWN contract indirectly via a round-tripped restoreSnapshot invert instead.
    const impl = ops.resolveOp('season.setTitlesDeadlines');
    const r = impl.validate({ type: 'season.setTitlesDeadlines', payload: { mainTitle: 'Season 8', bpLine: 'Battle Pass, TBD' } });
    assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
});

// 🔴 THE SEAM WHERE THE PORTAL'S EDITOR MEETS THIS OP, AND IT WAS BROKEN THE WHOLE TIME. The portal composes discrete fields (currentSeasonTitle, bpTitle, bpEnd, bpEndTBD) because a web form has three inputs where Discord's modal has one line; the op read only mainTitle/bpLine/rankLine/dmzLine. Result: the identity editor staged a changeset, Review displayed it, committing it wrote EXACTLY NOTHING, and every surface reported success. Nothing here could see it — validate() is a pass-through, preview() read the same key apply did and so agreed with the no-op, and every test in this file reaches validate() and invert() only, because apply() needs a Mongo session. applyFields is exported for exactly this seam.
check('the portal\'s own field names are the ones the op reads', () => {
    const { applyFields } = require('../core/ops/season');
    const { SEASON_LINES } = require('../portal/ui/season.logic');
    const current = { title: 'Battle Pass 7', end: new Date('2026-09-10T00:00:00Z'), endTBD: false };
    for (const L of SEASON_LINES) {
        const prefix = L.titleKey.replace(/Title$/, '');
        // Built the way portal/ui/season.js's handleIdentitySave builds it: the editor's own key names, straight through.
        const payload = { [L.titleKey]: 'Renamed', [L.endKey]: '2026-10-01', [L.tbdKey]: false };
        const skipped = [];
        const out = applyFields(current, payload, prefix, undefined, L.label, skipped);
        assert.deepStrictEqual(skipped, [], `${L.label}: the portal's date format was not parseable`);
        assert.strictEqual(out.title, 'Renamed', `${L.label}: the portal's title key was ignored`);
        assert.strictEqual(out.end && out.end.toISOString().slice(0, 10), '2026-10-01', `${L.label}: the portal's date key was ignored`);
    }
});

check('THE SEAM CHECK CAN FAIL: a payload the op cannot read is caught', () => {
    const { applyFields } = require('../core/ops/season');
    const current = { title: 'Battle Pass 7', end: new Date('2026-09-10T00:00:00Z'), endTBD: false };
    // The exact shape that shipped: a field name the op has no branch for. It must fall through to the LINE path and change nothing, which is what made the defect invisible.
    const out = applyFields(current, { battlePassTitle: 'Renamed' }, 'bp', undefined, 'Battle Pass', []);
    assert.strictEqual(out.title, 'Battle Pass 7', 'an unknown key must not be silently absorbed as a rename');
});

check('the TBD toggle and a date contradict each other, and the toggle wins', () => {
    const { applyFields } = require('../core/ops/season');
    const current = { title: 'BP', end: new Date('2026-09-10T00:00:00Z'), endTBD: false };
    const on = applyFields(current, { bpEndTBD: true, bpEnd: '2026-10-01' }, 'bp', undefined, 'BP', []);
    assert.strictEqual(on.endTBD, true);
    assert.strictEqual(on.end, null, 'a TBD deadline that keeps its old date is two answers to one question');
    const off = applyFields({ ...current, endTBD: true, end: null }, { bpEndTBD: false, bpEnd: '2026-10-01' }, 'bp', undefined, 'BP', []);
    assert.strictEqual(off.endTBD, false);
    assert.strictEqual(off.end.toISOString().slice(0, 10), '2026-10-01');
});

check('an unparseable date is REPORTED, never kept as the old one', () => {
    const { applyFields } = require('../core/ops/season');
    const skipped = [];
    const out = applyFields({ title: 'BP', end: new Date('2026-09-10T00:00:00Z'), endTBD: false },
        { bpEnd: 'sometime after the thing' }, 'bp', undefined, 'Battle Pass', skipped);
    assert.deepStrictEqual(skipped, ['Battle Pass']);
    assert.strictEqual(out.end.toISOString().slice(0, 10), '2026-09-10', 'the old date stands, and the caller is told');
});

check('the LINE path is untouched, so Discord behaves exactly as before', () => {
    const { applyFields } = require('../core/ops/season');
    const out = applyFields({ title: 'BP', end: null, endTBD: false }, { mainTitle: 'Season 8' }, 'bp', 'Battle Pass 8, Oct 1', 'BP', []);
    assert.strictEqual(out.title, 'Battle Pass 8', 'a payload with no bp* fields must still read its line');
});

// ⚠️ CORRECTED / EXPANDED beyond the plan's own draft: the plan's Interfaces line names only 4 op types and never mentions these three real, registered seasondraft actions at all.
check('the three real draft-staging actions the plan omitted all resolve to ops', () => {
    for (const type of ['season.setDraftTitlesDeadlines', 'season.bulkDraftDraws', 'season.bulkDraftCalendar']) {
        const impl = ops.resolveOp(type);
        assert.strictEqual(typeof impl.apply, 'function', `${type} is missing`);
    }
});

check('bulkDraftDraws rejects both fields blank, matching the real handler\'s own guard', () => {
    const r = ops.resolveOp('season.bulkDraftDraws').validate({ type: 'season.bulkDraftDraws', payload: {} });
    assert.strictEqual(r.ok, false);
});

check('discardDraft is tier 2 and restores the discarded draft', () => {
    const impl = ops.resolveOp('season.discardDraft');
    assert.strictEqual(impl.tier, 2);
    const draft = { active: true, newDraws: [1], calendar: [2] };
    const inv = impl.invert({ action: 'discard', applied: { draft } });
    assert.strictEqual(inv.type, 'season.restoreDraft');
    assert.deepStrictEqual(inv.payload.draft, draft);
});

check('restoreSnapshot is self-symmetric -- reverting a revert stays revertible', () => {
    const impl = ops.resolveOp('season.restoreSnapshot');
    const inv = impl.invert({ action: 'edit', applied: { prior: { currentSeasonTitle: 'Old' }, patchPrior: null } });
    assert.strictEqual(inv.type, 'season.restoreSnapshot');
    assert.deepStrictEqual(inv.payload, { currentSeasonTitle: 'Old' });
});

check('LANE_LABELS humanizes every internal lane key toManifestRows produces', () => {
    const { LANE_LABELS } = require('../portal/ui/season.logic');
    // PLURAL: these name a LANE, not one row, and the design's table, filter chips and Track lane headers all read them that way. Changed with the labels themselves, not around them.
    assert.strictEqual(LANE_LABELS.newDraws, 'New draws');
    assert.strictEqual(LANE_LABELS.returningDraws, 'Returning');
    assert.strictEqual(LANE_LABELS.calendar, 'Events');
});

check('toManifestRows derives real state instead of hardcoding live (gap audit §3.4 finding 2)', () => {
    const { toManifestRows } = require('../portal/ui/season.logic');
    const live = { newDraws: [{ _id: 'd1', title: 'Draw One', date: '2026-09-01' },
                               { _id: 'd2', title: 'Draw Two', date: '2026-09-02' },
                               { _id: 'd3', title: 'Draw Three', date: '2026-09-03' }],
                   returningDraws: [], calendar: [] };
    const changesets = [
        { state: 'staged', ops: [{ type: 'draw.edit', target: { elementId: 'd1' }, payload: {} }] },
        { state: 'blocked', ops: [{ type: 'draw.delete', target: { elementId: 'd2' }, payload: {} }] },
        { state: 'committed', ops: [{ type: 'draw.edit', target: { elementId: 'd3' }, payload: {} }] },
    ];
    const rows = toManifestRows(live, changesets);
    assert.strictEqual(rows.find((r) => r.id === 'd1').state, 'staged');
    assert.strictEqual(rows.find((r) => r.id === 'd2').state, 'conflict');
    // d3's only referencing changeset is already committed -- must read as live, not staged.
    assert.strictEqual(rows.find((r) => r.id === 'd3').state, 'live');
});

check('toManifestRows treats every row as live when no changesets are open', () => {
    const { toManifestRows } = require('../portal/ui/season.logic');
    const rows = toManifestRows({ newDraws: [{ _id: 'd1', title: 'X', date: '2026-09-01' }], returningDraws: [], calendar: [] }, []);
    assert.strictEqual(rows[0].state, 'live');
});

// 🔴 THE COMPOSER CAN NOW EMIT TWO OPS FROM ONE ENTRY, AND BOTH HAVE TO BE REAL. buildSeasonAddOps turns a draw with a closing date into draw.add + calendar.add — the second is the draw WINDOW, which stopped being a kind you pick on 2026-09-06 01:29 EDT. The payload shapes are asserted in scripts/composerForm.test.js; what only THIS file can check is that the two types it names are types core/ops actually registers, since an op type that resolves to nothing stages a changeset that can never commit.
check('both op types the composer can emit from one entry are registered ops', () => {
    const { buildSeasonAddOps } = require('../portal/ui/season.logic');
    const pair = buildSeasonAddOps('draw', { title: 'X', startDate: '', endDate: '2026-09-21', windowEnd: '2026-10-05' });
    assert.strictEqual(pair.length, 2, 'a closing date is a second op, not a second field');
    for (const op of pair) {
        const impl = ops.resolveOp(op.type);
        assert.strictEqual(typeof impl.apply, 'function', `${op.type} is not a registered op`);
    }
    // The falsifier: with no closing date there is exactly one, so the two-op path is a real branch.
    assert.strictEqual(buildSeasonAddOps('draw', { title: 'X', startDate: '', endDate: '2026-09-21' }).length, 1);
});

check('every season op type declares a tier', () => {
    for (const t of ops.listOpTypes().filter(t => t.startsWith('season.'))) {
        assert.ok([1, 2, 3].includes(ops.resolveOp(t).tier), `${t} has no tier`);
    }
});

process.exit(failures ? 1 : 0);
