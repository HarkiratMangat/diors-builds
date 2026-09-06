// scripts/armoryRealm.test.js — the Armory's three build-out decisions, asserted rather than described.
//
// 🔴 THE RACK, THE WEAPON SEARCH AND THE TWO DRAWER GATES ARE ALL ARITHMETIC OVER A BUILD LIST, which is why they
// live in portal/ui/armory.logic.js and not inside the components. A grouping that only a browser can compute is a
// grouping nothing checks, and the failure mode of every one of these is SILENT: a teaser naming the wrong build, a
// search that quietly drops the weapon you typed, a Stage button enabled over an edit that changes nothing. None of
// those throws, and none of them is visible to a screenshot diff.
//
// ⚠️ EVERY FIXTURE HERE IS BUILT SO THE NAIVE ANSWER IS WRONG. Alphabetical order disagrees with rank order; the
// search corpus contains a weapon whose name is a substring of another's; the no-op edit fixture changes an
// attachment STRING without changing the attachment COUNT. A fixture where the right answer and the lazy answer
// coincide is a vacuous pass, and a vacuous pass is permanent.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let failures = 0;
const say = console.log.bind(console);
function check(name, fn) {
    try { fn(); say(`  ✓ ${name}`); }
    catch (e) { failures++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}

say('armoryRealm — the category rack, the weapon search, and what stops a drawer staging');

const ROOT = path.join(__dirname, '..');
const {
    rackCategories, weaponOptions, matchWeapons, bestRankIndex, rankOf,
    addFormBlockers, editedFields, editorBlockers, CATEGORY_CHIP_ORDER,
} = require('../portal/ui/armory.logic');

// ── THE FIXTURE ───────────────────────────────────────────────────────────────────────────────
//
// Two categories, deliberately in the WRONG relative order for both a naive sort and the data's own order: SMG is
// second in CATEGORY_CHIP_ORDER and first alphabetically, and the list below leads with an SMG so insertion order
// cannot accidentally produce the right answer either.
const B = (over) => ({ mode: 'MP', category: 'AR', weaponName: 'AK117', buildName: 'Standard Build',
    attachments: ['a', 'b'], accent: '#8899AA', ...over });

const BUILDS = [
    B({ category: 'SMG', weaponName: 'Fennec', buildName: 'Close Quarters', categoryRank: 'top3' }),
    B({ category: 'SMG', weaponName: 'Fennec', buildName: 'Long Fennec' }),
    B({ category: 'SMG', weaponName: 'QQ9', buildName: 'Standard Build', categoryRank: 'best' }),
    B({ category: 'AR', weaponName: 'AK117', buildName: 'Aggressive Flex', categoryRank: 'best', isMeta: true }),
    B({ category: 'AR', weaponName: 'AK117', buildName: 'Long Range' }),
    B({ category: 'AR', weaponName: 'Zombra', buildName: 'Standard Build', categoryRank: 'top5' }),
    B({ category: 'AR', weaponName: 'AK', buildName: 'Standard Build' }),
];

// ── D5 · THE RACK GROUPS BY CATEGORY ──────────────────────────────────────────────────────────

check('the rack is one row per category PRESENT, in the mockup\'s display order and no other', () => {
    const cats = rackCategories(BUILDS);
    assert.deepStrictEqual(cats.map((c) => c.category), ['AR', 'SMG'],
        'AR before SMG is CATEGORY_CHIP_ORDER, which is neither alphabetical nor the order the builds arrive in');
    assert.strictEqual(CATEGORY_CHIP_ORDER.indexOf('AR') < CATEGORY_CHIP_ORDER.indexOf('SMG'), true);
    assert.strictEqual(cats.length, 2, 'a category with no builds must not draw an empty row');
    assert.deepStrictEqual(cats.map((c) => c.count), [4, 3]);
    assert.deepStrictEqual(cats.map((c) => c.weapons), [3, 2]);
    assert.strictEqual(cats[0].label, 'Assault', 'the header prints the chip label, not the stored enum');
});

check('a category the order table has never heard of is appended, never dropped', () => {
    const cats = rackCategories([...BUILDS, B({ category: 'MELEE', weaponName: 'Baseball Bat' })]);
    assert.deepStrictEqual(cats.map((c) => c.category), ['AR', 'SMG', 'MELEE'],
        'MELEE is absent from CATEGORY_CHIP_ORDER; a build nobody can find is worse than a row in the wrong place');
});

check('weapon groups inside a category are ordered by their BEST rank, not alphabetically', () => {
    const ar = rackCategories(BUILDS)[0];
    assert.deepStrictEqual(ar.groups.map((g) => g.weapon), ['AK117', 'Zombra', 'AK'],
        'alphabetical would be AK, AK117, Zombra — so this can fail, which is the point of the fixture');
    assert.deepStrictEqual(ar.groups.map((g) => g.tier), ['best', 'top5', null]);
    // A weapon's position is its BEST claim: AK117 has one Best build and one unranked one.
    assert.strictEqual(ar.groups[0].builds.length, 2);
    assert.strictEqual(bestRankIndex(ar.groups[0].builds), 0);
});

check('the class names the tier emits are the ones app.css actually declares', () => {
    const css = fs.readFileSync(path.join(ROOT, 'portal', 'ui', 'app.css'), 'utf8');
    const keys = rackCategories(BUILDS).flatMap((c) => c.groups.map((g) => g.tierKey));
    assert.deepStrictEqual([...new Set(keys)].sort(), ['best', 'top3', 'top5', 'unranked'],
        'the fixture must exercise more than one tier, or the css check below proves almost nothing');
    for (const k of new Set(keys)) {
        assert.ok(css.includes(`.t-${k}`), `.t-${k} is emitted by RANK_KEY and declared nowhere in app.css`);
    }
});

check('the closed header names the top-ranked build, which is the only reason a closed header is readable', () => {
    const [ar, smg] = rackCategories(BUILDS);
    assert.strictEqual(ar.teaser, 'AK117 · Aggressive Flex', 'the BEST build of the best weapon, not the first row');
    assert.strictEqual(ar.teaserRank, 'Best in category');
    assert.strictEqual(smg.teaser, 'QQ9 · Standard Build');
    // A category with nothing ranked still has to say something, and "Unranked" is true.
    const flat = rackCategories([B({ category: 'LMG', weaponName: 'Holger' })])[0];
    assert.strictEqual(flat.teaserRank, 'Unranked');
    assert.strictEqual(flat.teaser, 'Holger · Standard Build');
});

check('a DMZ build ranks on its RANGE field, so it does not silently pile into Unranked', () => {
    const dmz = rackCategories([
        B({ mode: 'DMZ', category: 'SMG', weaponName: 'Fennec', dmzRangeRank: 'best-close' }),
        B({ mode: 'DMZ', category: 'SMG', weaponName: 'QQ9' }),
    ])[0];
    assert.strictEqual(rankOf({ mode: 'DMZ', dmzRangeRank: 'best-close' }), 'best', 'the tier is the part before the hyphen');
    assert.deepStrictEqual(dmz.groups.map((g) => g.weapon), ['Fennec', 'QQ9']);
    assert.strictEqual(dmz.groups[0].tier, 'best');
});

// 🔴 THE DEFAULT IS COLLAPSED, AND THE MECHANISM IS THAT THE OPEN SET IS STORED RATHER THAN THE CLOSED ONE. This runs
// the real functions out of armory.js against a stub sessionStorage rather than asserting on their source text: the
// claim is behavioural ("an untouched armory has nothing open"), and a source match would pass on a file that stored
// the closed set under the same names.
check('an armory nobody has touched opens with every category CLOSED', () => {
    const src = fs.readFileSync(path.join(ROOT, 'portal', 'ui', 'armory.js'), 'utf8');
    const key = /const COPEN_KEY = '([^']+)';/.exec(src);
    const load = /(function loadCOpen\(\)[^\n]+)/.exec(src);
    const save = /(function saveCOpen\(set\)[^\n]+)/.exec(src);
    assert.ok(key && load && save, 'armory.js no longer defines COPEN_KEY / loadCOpen / saveCOpen on one line each');
    const store = new Map();
    const sandbox = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
    const run = new Function('sessionStorage', `${load[1]}\n${save[1]}\nconst COPEN_KEY='${key[1]}';return { loadCOpen, saveCOpen };`)(sandbox);

    assert.strictEqual(run.loadCOpen().size, 0, 'an empty store must mean nothing is open, with no seeding step');
    // The falsifier: the failed design stores the CLOSED set, and under it an empty store means everything is OPEN.
    // That difference is exactly what a category appearing later inherits.
    run.saveCOpen(new Set(['AR']));
    assert.deepStrictEqual([...run.loadCOpen()], ['AR'], 'what was opened must survive a reload');
    assert.ok(!run.loadCOpen().has('SMG'),
        'a category nobody opened must still be closed — this is the state a closed-set store cannot express for a category it never enumerated');
    // Unreadable storage (a private window, a cleared profile) must fall back to the DEFAULT, never to open.
    const broken = new Function('sessionStorage', `${load[1]}\nconst COPEN_KEY='x';return loadCOpen;`)({ getItem: () => '{not json' });
    assert.strictEqual(broken().size, 0);
});

check('the rack renders no cards for a closed category, which is the whole point of opening closed', () => {
    const src = fs.readFileSync(path.join(ROOT, 'portal', 'ui', 'armory.js'), 'utf8');
    assert.ok(/\$\{open \? c\.groups\.map/.test(src),
        'the trow-body renders its weapon groups unconditionally again — a closed rack would carry the whole catalogue in the DOM');
    assert.ok(src.includes('aria-expanded=${open'), 'the category header lost its aria-expanded state');
    assert.ok(/<button type="button" class="trow-h"/.test(src),
        'the category header is a div wearing role="button" again; a real button is what carries Enter, Space and forms mode for free');
});

// ── D5 · THE WEAPON SEARCH ────────────────────────────────────────────────────────────────────

check('picking a weapon yields EVERY build of it, which is the comparison pick-two could not express', () => {
    const opts = weaponOptions(BUILDS);
    const ak = opts.find((o) => o.weapon === 'AK117');
    assert.strictEqual(ak.builds.length, 2);
    assert.deepStrictEqual(ak.builds.map((b) => b.buildName), ['Aggressive Flex', 'Long Range']);
    assert.strictEqual(ak.category, 'AR');
    // Most builds first: the weapon this view exists for is the one with siblings.
    assert.ok(opts[0].builds.length >= opts[opts.length - 1].builds.length);
});

check('a weapon with ONE build is offered and says so, rather than being hidden for being uninteresting', () => {
    const zombra = weaponOptions(BUILDS).find((o) => o.weapon === 'Zombra');
    assert.strictEqual(zombra.builds.length, 1, 'the single-build case is what the "nothing to line it up against" copy is for');
    assert.ok(matchWeapons(weaponOptions(BUILDS), 'zomb', []).some((o) => o.weapon === 'Zombra'));
});

check('the search matches a SUBSTRING and is case-blind, so "117" finds the AK117', () => {
    const opts = weaponOptions(BUILDS);
    assert.deepStrictEqual(matchWeapons(opts, '117', []).map((o) => o.weapon), ['AK117']);
    assert.deepStrictEqual(matchWeapons(opts, 'FEN', []).map((o) => o.weapon), ['Fennec']);
    // "AK" is a substring of "AK117" AND a whole weapon name here, so a prefix-only or exact matcher fails this.
    assert.deepStrictEqual(matchWeapons(opts, 'ak', []).map((o) => o.weapon).sort(), ['AK', 'AK117']);
    assert.deepStrictEqual(matchWeapons(opts, '', []), [], 'an empty box offers nothing rather than everything');
    assert.deepStrictEqual(matchWeapons(opts, 'nothinghere', []), []);
});

check('an already-picked weapon leaves the list, so no row in it is un-choosable', () => {
    const opts = weaponOptions(BUILDS);
    assert.deepStrictEqual(matchWeapons(opts, 'ak', ['AK117']).map((o) => o.weapon), ['AK']);
    assert.strictEqual(matchWeapons(opts, 'ak', ['AK117', 'AK']).length, 0);
});

// ── D1 · WHAT STOPS A DRAWER STAGING ──────────────────────────────────────────────────────────

check('the add drawer refuses until the two fields the op REQUIRES are there, and names them', () => {
    assert.deepStrictEqual(addFormBlockers({ weaponName: '', category: 'AR' }), ['a weapon name']);
    assert.deepStrictEqual(addFormBlockers({ weaponName: '   ', category: 'AR' }), ['a weapon name'],
        'whitespace is not a weapon name');
    assert.deepStrictEqual(addFormBlockers({ weaponName: 'AK117', category: '' }), ['a category']);
    assert.deepStrictEqual(addFormBlockers({ weaponName: 'AK117', category: 'AR' }), []);
    // The gunsmith code deliberately never blocks: correctGunsmithCode CORRECTS look-alike characters server-side, so
    // a client-side refusal would refuse exactly the input the server was about to fix.
    assert.deepStrictEqual(addFormBlockers({ weaponName: 'AK117', category: 'AR', shareCode: 'nonsense' }), []);
});

check('the edit drawer refuses a no-op, because a staged no-op is work manufactured for the commit screen', () => {
    const build = B({ weaponName: 'AK117', buildName: 'Aggressive Flex', attachments: ['Muzzle', 'Barrel'] });
    const same = { ...build, attachments: [...build.attachments] };
    assert.deepStrictEqual(editedFields(build, same), []);
    assert.deepStrictEqual(editorBlockers(build, same), ['a change — every field still matches the live build']);
    assert.deepStrictEqual(editorBlockers(build, { ...same, isMeta: true }), []);
});

check('THE COUNT-ONLY COMPARISON CAN FAIL: a swapped attachment is a real edit at an unchanged length', () => {
    const build = B({ attachments: ['Muzzle', 'Barrel'] });
    const swapped = { ...build, attachments: ['Muzzle', 'No Stock'] };
    assert.strictEqual(swapped.attachments.length, build.attachments.length,
        'this falsifier is vacuous unless the two lists are the same length');
    assert.deepStrictEqual(editedFields(build, swapped), ['attachments']);
    assert.deepStrictEqual(editorBlockers(build, swapped), []);
});

check('an empty weapon name blocks the edit ahead of the no-op check, so the reader sees the fixable reason', () => {
    const build = B({ weaponName: 'AK117' });
    assert.deepStrictEqual(editorBlockers(build, { ...build, weaponName: '' }), ['a weapon name']);
});

check('every field loadout.edit writes is watched, so a change to one of them can never read as no change', () => {
    const build = B({ weaponName: 'AK117', shareCode: '1C2B4A8B9A', imageKey: 'AK117-1', description: 'x' });
    for (const [k, v] of Object.entries({ weaponName: 'AK47', buildName: 'Other', category: 'SMG', mode: 'DMZ',
        shareCode: '9Z8Y7X6W5V', imageKey: 'AK117-2', isMeta: true, isToxic: true,
        categoryRank: 'best', dmzRangeRank: 'best-close', description: 'y' })) {
        assert.deepStrictEqual(editedFields(build, { ...build, [k]: v }), [k], `${k} is not watched by editedFields`);
    }
});

// ── THE DRAWERS ARE DRAWERS ───────────────────────────────────────────────────────────────────
//
// ⚠️ A SOURCE ASSERTION, AND IT IS THE RIGHT SHAPE FOR THIS ONE CLAIM: "these two forms mount in the shared modal
// drawer" is a statement about which component wraps them, and the thing that would silently undo it is somebody
// reinstating the inline panel. The behavioural half — inert, focus restore, Escape — is Drawer's own, and
// portalHarnessRender/portalA11y already own it.
check('both Armory forms mount in the shared Drawer, in the overlay slot rather than inside main', () => {
    const src = fs.readFileSync(path.join(ROOT, 'portal', 'ui', 'armory.js'), 'utf8');
    assert.ok(src.includes("import { useOverlay, Drawer } from './overlay.js';"), 'Drawer is no longer imported');
    assert.strictEqual((src.match(/<\$\{Drawer\}/g) || []).length, 2, 'the add form and the build editor are the two drawers');
    assert.ok(!src.includes('class="panel bform"'), 'the add form is an inline panel again');
    assert.ok(!src.includes('id="build-editor"'), 'the build editor is an inline panel again');
    // 🔴 WHERE THEY RENDER IS LOAD-BEARING: Drawer marks `.app > main` inert, so a drawer rendered inside the view
    // slot would mark ITSELF inert along with the page behind it.
    const overlay = src.slice(src.indexOf('overlaySlot=${html`'), src.indexOf('exports=${exportScopes}'));
    assert.ok(overlay.includes('AddBuildForm') && overlay.includes('BuildEditor'),
        'a drawer moved back into the view slot, where Drawer\'s own inert call would disable it');
    assert.ok(src.includes('.bed-side'), 'the drawer lost the record/preview column the design puts on its right');
});

say(failures ? `\n✗ ${failures} failed` : '\n✅ armoryRealm: the rack groups by category and opens closed, the search returns a weapon\'s whole sibling set, and neither drawer stages nothing');
process.exit(failures ? 1 : 0);
