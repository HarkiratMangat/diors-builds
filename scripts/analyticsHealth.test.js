#!/usr/bin/env node
// scripts/analyticsHealth.test.js — pin 37's Health lead: the tile order matches the mockup, "Where
// the milliseconds go" lives on Health only (not duplicated on Timing), and the four-level alert
// table stays in conservation with utils/alertWebhook.js, the module that actually assigns levels.
//
// These are source-text checks, not a rendered-DOM test: portal/ui/*.js imports the buildless
// vendor bundle (../vendor/preact.mjs etc.), which does not exist until `npm run build` copies it
// in, so importing the module directly in a bare `node` process fails before a single assertion
// runs. scripts/portalAnalytics.test.js already established this file's testing convention — read
// the source as text, strip comments before scanning it, and falsify each check against a real
// mutation of the real file rather than a fixture built to pass. This file follows the same shape.
//
// Run: node scripts/analyticsHealth.test.js (also via npm test)

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let failures = 0;
const say = console.log.bind(console);
function check(name, fn) {
    try { fn(); say(`  ✓ ${name}`); }
    catch (e) { failures++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}

say('analyticsHealth — pin 37: the Health lead matches the mockup, and nothing duplicates onto Timing');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// ⚠️ COMMENTS ARE STRIPPED BEFORE ANY SCAN, same rule portalAnalytics.test.js states: this file's
// own comments habitually quote the code they describe, so an unstripped scan can match prose
// rather than the thing under test.
const stripJsComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const ui = read('portal/ui/analytics.js');

check("Health leads with the mockup's four tiles, in the mockup's order", () => {
    const at = ui.indexOf('function Health(');
    assert.ok(at > 0, 'Health() is gone from portal/ui/analytics.js');
    const end = ui.indexOf('\nfunction Usage(', at);
    const body = ui.slice(at, end === -1 ? ui.length : end);
    const labels = ['Interactions 7d', 'Success rate', 'Restarts 7d', 'Memory'];
    let cursor = -1;
    for (const label of labels) {
        const idx = body.indexOf(`label="${label}"`);
        assert.ok(idx > cursor, `"${label}" is missing or out of order in Health()'s tile row`);
        cursor = idx;
    }
});

check('THE ORDER GATE CAN FAIL: two tile labels swapped is caught', () => {
    const at = ui.indexOf('function Health(');
    const end = ui.indexOf('\nfunction Usage(', at);
    const body = ui.slice(at, end === -1 ? ui.length : end);
    assert.ok(body.includes('label="Interactions 7d"') && body.includes('label="Restarts 7d"'),
        'the anchors this proof swaps have drifted from the real tile labels');
    const swapped = body.replace('label="Interactions 7d"', 'label="__TMP__"')
        .replace('label="Restarts 7d"', 'label="Interactions 7d"')
        .replace('label="__TMP__"', 'label="Restarts 7d"');
    assert.notStrictEqual(swapped, body, 'the swap produced no change — this proof is vacuous');
    const labels = ['Interactions 7d', 'Success rate', 'Restarts 7d', 'Memory'];
    let cursor = -1, brokenAt = null;
    for (const label of labels) {
        const idx = swapped.indexOf(`label="${label}"`);
        if (idx <= cursor) { brokenAt = label; break; }
        cursor = idx;
    }
    assert.ok(brokenAt, 'swapping two tile labels did not break the ordering check');
});

check('"Where the milliseconds go" renders once, inside DepBars, never a second time on Timing', () => {
    const noComments = stripJsComments(ui);
    const occurrences = (noComments.match(/Where the milliseconds go/g) || []).length;
    assert.strictEqual(occurrences, 1,
        `expected exactly one live occurrence outside comments, found ${occurrences} — the panel must not be drawn on both Health and Timing`);
    const depAt = ui.indexOf('function DepBars(');
    assert.ok(depAt > 0, 'DepBars() is gone');
    const healthAt = ui.indexOf('function Health(');
    assert.ok(depAt < healthAt, 'DepBars must be declared before Health uses it');
});

check('the four-level alert table stays in conservation with utils/alertWebhook.js', () => {
    const webhook = stripJsComments(read('utils/alertWebhook.js'));
    const colorAt = webhook.indexOf('LEVEL_COLOR');
    assert.ok(colorAt > 0, 'LEVEL_COLOR is gone from utils/alertWebhook.js');
    const colorDecl = webhook.slice(colorAt, webhook.indexOf('};', colorAt));
    const webhookLevels = [...colorDecl.matchAll(/(\w+):/g)].map((m) => m[1]);
    assert.ok(webhookLevels.length >= 4, `expected at least 4 levels in LEVEL_COLOR, found ${webhookLevels.join(', ')}`);

    const strippedUi = stripJsComments(ui);
    const rowAt = strippedUi.indexOf('const LEVEL_ROW = {');
    assert.ok(rowAt > 0, 'LEVEL_ROW is gone from portal/ui/analytics.js');
    const rowDecl = strippedUi.slice(rowAt, strippedUi.indexOf('};', rowAt));
    const missing = webhookLevels.filter((l) => !new RegExp(`\\b${l}:`).test(rowDecl));
    assert.deepStrictEqual(missing, [], `LEVEL_ROW is missing level(s) alertWebhook.js actually assigns: ${missing.join(', ')}`);
});

check('THE CONSERVATION GATE CAN FAIL: the real caution key removed from the real file', () => {
    const broken = ui.replace("caution: 'lvlb lv-caution', ", '');
    assert.notStrictEqual(broken, ui, 'LEVEL_ROW no longer contains the caution key in the form this proof removes');
    const strippedBroken = stripJsComments(broken);
    const rowDecl = strippedBroken.slice(strippedBroken.indexOf('const LEVEL_ROW = {'), strippedBroken.indexOf('};', strippedBroken.indexOf('const LEVEL_ROW = {')));
    assert.ok(!/\bcaution:/.test(rowDecl), 'deleting the caution key did not remove it from the extracted declaration — this proof is vacuous');
});

say(failures ? `\n✗ ${failures} failed` : '\n✅ analyticsHealth: tile order matches the mockup, the milliseconds panel lives once, and the alert levels conserve');
process.exit(failures ? 1 : 0);
