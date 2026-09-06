#!/usr/bin/env node
// scripts/portalOpenKind.mjs — when a control opens something, do the two sides open the SAME KIND of thing?
//
// 🔴 WHY THIS EXISTS, AND WHY NOTHING ELSE COULD HAVE FOUND IT. Every conformance figure in this repo compares a RENDERED FRAME. `portalDiff` shoots the page, `portalAudit` walks its DOM, `portalConverge` compares node rhythm — and all three see the page AS IT LOADS. `--open` reaches one named overlay at a time, on one realm, when somebody thinks to point it somewhere. So the question *"does this control open a MODAL, or mount a panel inline?"* has never been asked systematically, and it is not a styling detail: it is the difference between the page staying put behind a scrim and the page rearranging itself under you.
//
// 🔴 IT WAS FOUND BY HARKIRAT OPENING THE PORTAL AND SAYING IT LOOKED WRONG, 2026-09-05 22:48 EDT. Armory's `New DMZ build` opens a `role="dialog"` drawer over a scrim in the design, and mounts an inline `.bed` panel in the portal. Both sides were "conformed"; the resting pages match; the pixel floors never moved. **A cited row from 2026-08-31 kept the inline version, and the interaction it describes had never been compared against the design's — only reasoned about.**
//
// ⚠️ WHAT IT ASSERTS, deliberately narrow: for each control both sides offer, clicking it must produce the same KIND of surface. Kind is four buckets — `modal` (a scrim, or `role=dialog`/`aria-modal`), `inline` (new content, no scrim), `swap` (the page LOST more than it gained, which is the rack-collapse defect), and `none`. It does not compare the surface's contents; `portal:diff --open` does that, and this tool's job is to tell you WHERE to point it.
//
// ⚠️ WHAT IT CANNOT SEE: a control that needs a selection or typed input first, anything behind a data row (the trigger listing filters rows out on purpose — see the comment it inherits), and a realm's second view unless you pass --view. Those are stated rather than implied, because an instrument that does not say what it skipped reads as if it covered everything.
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MK = path.join(ROOT, 'docs/superpowers/mockups/2026-08-23-portal-interactive');
const PUBLIC = path.join(ROOT, 'portal', 'public');
const VIEWPORT = { w: 1282, h: 888 };

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d = null) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ALL = ['season', 'armory', 'broadcast', 'access', 'analytics', 'review', 'home'];
const REALMS = val('--realm') ? [val('--realm')] : ALL;

// The mockup page each realm maps to. Home is `index.html`; the rest are named.
const PAGE = { season: 'season.html', armory: 'armory.html', broadcast: 'broadcast.html', access: 'access.html', analytics: 'analytics.html', review: 'review.html', home: 'index.html' };

// 🔴 THE CLASSIFIER, AND IT IS THE WHOLE INSTRUMENT. Everything else here is plumbing.
// `swap` is listed FIRST because it is the defect that started this: a control that opens a form AND
// tears the page out from under it reads as "something opened" to any naive check.
export function classify(before, after) {
    if (after.modal > before.modal) return 'modal';
    if (after.nodes < before.nodes - 200) return 'swap';
    if (after.nodes > before.nodes + 20) return 'inline';
    if (after.text !== before.text) return 'inline';
    return 'none';
}

const PROBE = () => ({
    nodes: document.querySelectorAll('*').length,
    // A scrim or a dialog role is what makes a surface MODAL — the page behind it is inert and dimmed.
    modal: document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"],.scrim.on,.drawer.open,.ov.on').length,
    text: String(document.body.innerText || '').replace(/\s+/g, ' ').trim().length,
});

const LIST = () => {
    const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
    const out = [];
    for (const e of document.querySelectorAll('button,a,[role="button"],summary')) {
        if (e.offsetParent === null) continue;
        // Inherited verbatim from portalAudit's --triggers: a data row is not a control, and an
        // unfiltered inventory on Armory comes back as a hundred build names.
        if (e.closest('tr,li[data-id],[data-id],.bcard,.mtable tbody,.daylist,.explist,.exs')) continue;
        const t = norm(e.textContent) || norm(e.getAttribute('aria-label'));
        if (!t || t.length > 60) continue;
        // Only controls that plausibly OPEN something. A tab, a filter chip and a sort header all
        // change the page without opening a surface, and including them buries the signal.
        if (!/^(\+|new |add |post |grant |create |edit |compose |export)/i.test(t) && !/^(draw|returning draw|draw window|event|playlist|patch note)$/i.test(t)) continue;
        out.push(t);
    }
    return [...new Set(out)];
};

function serve(root) {
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
    const s = http.createServer((req, res) => {
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
        const f = path.join(root, rel);
        if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nope'); }
        res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(fs.readFileSync(f));
    });
    return new Promise((r) => s.listen(0, '127.0.0.1', () => r({ s, port: s.address().port })));
}

async function kindOf(page, label) {
    const before = await page.evaluate(PROBE);
    const clicked = await page.evaluate((want) => {
        const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
        const el = [...document.querySelectorAll('button,a,[role="button"],summary')]
            .filter((e) => e.offsetParent !== null)
            .find((e) => (norm(e.textContent) || norm(e.getAttribute('aria-label'))) === want);
        if (!el) return false;
        el.click();
        return true;
    }, label);
    if (!clicked) return { kind: 'missing', before, after: before };
    await page.evaluate(() => new Promise((r) => setTimeout(r, 1200)));
    const after = await page.evaluate(PROBE);
    return { kind: classify(before, after), before, after };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    // 🔴 THE FALSIFIER RUNS FIRST AND THE PROGRAM REFUSES WITHOUT IT. Four instruments in this repo
    // shipped green while blind; the classifier is this one's entire claim, so it proves it can tell
    // the four kinds apart on constructed input before it reports on any real page.
    const b = { nodes: 1000, modal: 0, text: 500 };
    const cases = [
        ['modal', { nodes: 1120, modal: 1, text: 600 }, 'modal'],
        ['inline', { nodes: 1120, modal: 0, text: 600 }, 'inline'],
        ['swap', { nodes: 400, modal: 0, text: 200 }, 'swap'],
        ['none', { nodes: 1000, modal: 0, text: 500 }, 'none'],
    ];
    const wrong = cases.filter(([, after, want]) => classify(b, after) !== want);
    if (wrong.length) {
        console.log(`\n❌ portal:openkind is VACUOUS — the classifier misreads ${wrong.map((w) => w[0]).join(', ')}.\n`);
        process.exit(1);
    }
    console.log('\nportal:openkind — the classifier separates modal · inline · swap · none on planted input\n');

    const { findChrome } = require('./lib/chromePath.cjs');
    const puppeteer = require('puppeteer-core');
    const mkq = has('--no-seed') ? '' : '?demo=1';
    const mk = await serve(MK);
    const pt = await serve(PUBLIC);
    const browser = await puppeteer.launch({ executablePath: findChrome(), args: ['--no-sandbox'] });
    const rows = [];
    try {
        for (const realm of REALMS) {
            const open = async (url) => {
                const p = await browser.newPage();
                await p.setViewport({ width: VIEWPORT.w, height: VIEWPORT.h });
                await p.goto(url, { waitUntil: 'load' });
                await p.evaluate(() => document.fonts.ready);
                await p.evaluate(() => new Promise((r) => setTimeout(r, 2400)));
                return p;
            };
            const mkPage = await open(`http://127.0.0.1:${mk.port}/${PAGE[realm]}${mkq}`);
            const ptPage = await open(`http://127.0.0.1:${pt.port}/harness.html${mkq ? mkq + '&' : '?'}b=${Date.now()}#/${realm}`);
            const mkControls = await mkPage.evaluate(LIST);
            const ptControls = await ptPage.evaluate(LIST);
            // 🔴 THE FIRST RUN PAIRED NOTHING ON THE CREATE CHIPS AND SAID SO ONLY IN AN ASIDE. The portal
            // appends its keyboard shortcut to the label -- `New DMZ build D` against the design's `New DMZ
            // build` -- so an exact match dropped both chips out of the comparison while the run still exited
            // with a finding about a different control. That is a silent under-report on exactly the control
            // that motivated the tool. Labels are compared with a trailing single-letter shortcut stripped.
            const bare = (t) => t.replace(/\s+[A-Z]$/, '').trim();
            const ptBy = new Map(ptControls.map((c) => [bare(c), c]));
            const shared = mkControls.filter((c) => ptBy.has(bare(c)));
            for (const label of shared) {
                // A fresh page per control: an already-open surface changes what the next click means.
                const m = await open(`http://127.0.0.1:${mk.port}/${PAGE[realm]}${mkq}`);
                const t = await open(`http://127.0.0.1:${pt.port}/harness.html${mkq ? mkq + '&' : '?'}b=${Date.now()}#/${realm}`);
                const a = await kindOf(m, label);
                const c = await kindOf(t, ptBy.get(bare(label)));
                rows.push({ realm, label, mk: a.kind, pt: c.kind, agree: a.kind === c.kind });
                await m.close(); await t.close();
            }
            const mkBare = new Set(mkControls.map(bare));
            const onlyMk = mkControls.filter((c) => !ptBy.has(bare(c)));
            const onlyPt = ptControls.filter((c) => !mkBare.has(bare(c)));
            console.log(`  ${realm.padEnd(10)} ${String(shared.length).padStart(2)} shared control(s)` +
                (onlyMk.length ? ` · mockup-only: ${onlyMk.join(', ')}` : '') +
                (onlyPt.length ? ` · portal-only: ${onlyPt.join(', ')}` : ''));
            await mkPage.close(); await ptPage.close();
        }
    } finally {
        await browser.close(); mk.s.close(); pt.s.close();
    }

    const bad = rows.filter((r) => !r.agree);
    console.log(`\n  ${rows.length} control(s) compared across ${REALMS.length} realm(s).\n`);
    if (bad.length) {
        console.log('  realm      control                        mockup    portal');
        for (const r of bad) console.log(`  ❌ ${r.realm.padEnd(9)} ${r.label.slice(0, 28).padEnd(30)} ${r.mk.padEnd(9)} ${r.pt}`);
        console.log(`\n  ${bad.length} control(s) open a DIFFERENT KIND of surface on the two sides.`);
        console.log('  ⚠️ A disagreement is not automatically a defect — a portal-ahead decision can be deliberate.');
        console.log('     Adjudicate each against docs/reference/portal-decision-ledger.md, and if it IS cited,');
        console.log('     make sure the row says so about the INTERACTION and not only about the styling.\n');
        process.exit(1);
    }
    console.log('  ✅ every shared control opens the same KIND of surface on both sides.');
    console.log('  ⚠️ Kind only — a modal on both sides can still hold different content. Point');
    console.log('     `portal:diff --open "<label>"` at anything this says agrees.\n');
}
