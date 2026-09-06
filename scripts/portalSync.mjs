#!/usr/bin/env node
// scripts/portalSync.mjs — the two pages side by side, CLICKING TOGETHER, with a notes column.
//
// 🔴 WHY THIS EXISTS. Every instrument in this repo hands Harkirat a NUMBER or a LIST, and his acceptance test has always been visual — §0.7d says the deliverable is the two pages LOOKED at. So the loop has been: he opens the portal, says a realm looks wrong, and then we spend rounds guessing WHICH part, because a screenshot is one frame and prose is a poor pointer. **He asked for this directly on 2026-09-05 22:56 EDT** — *"some way where i can literally look at the mockup and the portal side by side, like literally sync'd versions, where if i click 1 thing, it also triggers the click on the other side. Then i can just do that, and literally comment on top of it."*
//
// 🔴 ONE ORIGIN, AND THAT IS THE WHOLE REASON THIS IS A SERVER RATHER THAN AN HTML FILE. The mockup and the portal are different roots; two iframes from two ports are cross-origin, and the parent cannot read a cross-origin document, attach a listener to it, or mirror a click into it. Serving both under `/mk/` and `/pt/` from one origin makes them same-origin, which is what makes syncing possible at all.
//
// ⚠️ THE PORTAL SIDE IS THE HARNESS BY DEFAULT, and that is deliberate: the harness loads the mockup's OWN `fixtures.js`, so the two sides carry byte-identical data and a difference is a DESIGN difference. `--real` points the right frame at the live dev server instead, which is what to use when the question is "what do I actually see when I sign in" — but then data differences are expected and are not findings.
//
// ⚠️ WHAT IT IS NOT: it does not measure, score or adjudicate anything. It is a viewer. `portal:diff` says how much differs, `portal:audit` says what, `portal:openkind` says whether a control opens the same KIND of surface — this says *look*.
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MK = path.join(ROOT, 'docs/superpowers/mockups/2026-08-23-portal-interactive');
const PT = path.join(ROOT, 'portal', 'public');
const NOTES = path.join(ROOT, 'local', 'portal-sync-notes.md');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const PORT = Number(val('--port', '8910'));
const REAL = has('--real');

// Each realm's two addresses. The mockup is a page per realm; the portal is one SPA on a hash route.
const REALMS = {
    season: 'season.html', armory: 'armory.html', broadcast: 'broadcast.html',
    access: 'access.html', analytics: 'analytics.html', review: 'review.html', home: 'index.html',
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

function sendFile(res, root, rel) {
    const f = path.join(root, rel);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store, must-revalidate' });
    res.end(fs.readFileSync(f));
}

const SHELL = (realm) => `<!doctype html><html><head><meta charset="utf-8"><title>portal:sync — ${realm}</title>
<style>
  :root{--bg:#0B0E11;--panel:#141A1F;--rule:#232C34;--ink:#E6EDF3;--ink3:#80909D;--accent:#F2C230;--pin:#FF5D3B}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.5 'Space Grotesk',-apple-system,system-ui,sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}
  header{display:flex;align-items:center;gap:10px;padding:7px 13px;border-bottom:1px solid var(--rule);background:var(--panel);flex:none}
  header b{font-family:'Big Shoulders Display',sans-serif;font-size:17px;letter-spacing:.04em}
  select,button{background:#1B2229;color:var(--ink);border:1px solid var(--rule);border-radius:6px;padding:5px 9px;font:inherit;cursor:pointer}
  button.on{background:var(--accent);color:#111;border-color:var(--accent)}
  button.pin.on{background:var(--pin);border-color:var(--pin);color:#fff}
  .hint{font-size:11px;color:var(--ink3);margin-left:auto}
  .frames{flex:1;display:flex;min-height:0}
  .col{flex:1;display:flex;flex-direction:column;min-width:0;border-right:1px solid var(--rule)}
  .col h2{margin:0;padding:4px 12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);border-bottom:1px solid var(--rule);background:#10161B;flex:none}
  /* The frame is a real 1282 wide and SCALED, never resized: fitting it to the column puts both pages
     under their own 768px breakpoint and renders the mobile layout, which is deliberately unconformed. */
  .vp{flex:1;overflow:auto;position:relative}
  iframe{width:1282px;height:888px;border:0;background:#0B0E11;transform-origin:top left;display:block}
  .pins{position:absolute;inset:0;pointer-events:none;z-index:5}
  .pin-dot{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:var(--pin);color:#fff;font:700 11px/22px 'Space Grotesk',sans-serif;text-align:center;pointer-events:auto;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.6);border:2px solid #fff}
  body.pinning .vp{cursor:crosshair}
  #tray{position:fixed;right:0;top:38px;bottom:0;width:360px;background:var(--panel);border-left:1px solid var(--rule);box-shadow:-18px 0 40px rgba(0,0,0,.55);transform:translateX(100%);transition:transform .18s ease;z-index:40;display:flex;flex-direction:column}
  #tray.open{transform:none}
  #tray h2{margin:0;padding:6px 12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);border-bottom:1px solid var(--rule);display:flex;justify-content:space-between;align-items:center}
  #list{flex:1;overflow:auto;padding:6px 10px;font-size:12px}
  #list .n{padding:7px 8px;border-bottom:1px solid #1B2229;cursor:pointer;border-radius:5px}
  #list .n:hover{background:#1B2229}
  #list .n i{color:var(--pin);font-style:normal;font-weight:700}
  #list .n em{color:var(--ink3);font-style:normal}
  #open{position:fixed;right:14px;bottom:12px;z-index:39;background:var(--accent);color:#111;border:0;border-radius:20px;padding:9px 16px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.45)}
  #pop{position:fixed;z-index:60;width:300px;background:var(--panel);border:1px solid var(--pin);border-radius:9px;padding:10px;display:none;box-shadow:0 10px 34px rgba(0,0,0,.65)}
  #pop textarea{width:100%;background:#1B2229;color:var(--ink);border:1px solid var(--rule);border-radius:6px;padding:7px;font:inherit;min-height:74px;resize:vertical}
  #pop .who{font-size:11px;color:var(--ink3);margin-bottom:6px;word-break:break-word}
  #pop .row{display:flex;gap:6px;margin-top:7px}
</style></head><body>
<header>
  <b>DIOREO / SYNC</b>
  <select id="realm">${Object.keys(REALMS).map((r) => `<option${r === realm ? ' selected' : ''}>${r}</option>`).join('')}</select>
  <button id="pinbtn" class="pin">📍 pin mode OFF</button>
  <button id="sync" class="on">click-sync ON</button>
  <button id="scrollb" class="on">scroll-sync ON</button>
  <span class="hint" id="stat">wiring…</span>
  <span class="hint" style="margin-left:12px">pin either side — both are captured</span>
</header>
<div class="frames">
  <div class="col"><h2>Mockup — the approved design</h2><div class="vp" id="vpa"><iframe id="a" src="/mk/${REALMS[realm]}?demo=1"></iframe><div class="pins" id="pa"></div></div></div>
  <div class="col"><h2>Portal${REAL ? ' — LIVE dev server' : ''}</h2><div class="vp" id="vpb"><iframe id="b" src="${REAL ? 'http://127.0.0.1:8787/#/' + realm : '/harness.html?demo=1#/' + realm}"></iframe><div class="pins" id="pb"></div></div></div>
</div>
<button id="open">Pins &amp; log</button>
<div id="tray"><h2>Pins → local/portal-sync-notes.md <button id="close" style="padding:1px 7px">×</button></h2><div id="list"></div></div>
<div id="pop"><div class="who" id="popwho"></div><textarea id="poptext" placeholder="What is wrong here?"></textarea><div class="row"><button id="popsave" style="flex:1">Save pin</button><button id="popdel" style="color:#FF5D3B">Delete</button><button id="popcancel">Cancel</button></div></div>
<script>
const A=document.getElementById('a'),B=document.getElementById('b');
const VP={a:document.getElementById('vpa'),b:document.getElementById('vpb')};
const LAYER={a:document.getElementById('pa'),b:document.getElementById('pb')};
const stat=m=>document.getElementById('stat').textContent=m;
let clickSync=true,scrollSync=true,pinning=false,pins=[],seq=0,scale=1;

document.getElementById('sync').onclick=e=>{clickSync=!clickSync;e.target.classList.toggle('on',clickSync);e.target.textContent='click-sync '+(clickSync?'ON':'OFF');};
document.getElementById('scrollb').onclick=e=>{scrollSync=!scrollSync;e.target.classList.toggle('on',scrollSync);e.target.textContent='scroll-sync '+(scrollSync?'ON':'OFF');};
document.getElementById('pinbtn').onclick=e=>{pinning=!pinning;e.target.classList.toggle('on',pinning);e.target.textContent='📍 pin mode '+(pinning?'ON':'OFF');document.body.classList.toggle('pinning',pinning);};
document.getElementById('realm').onchange=e=>location.search='?realm='+e.target.value;
document.getElementById('open').onclick=()=>document.getElementById('tray').classList.toggle('open');
document.getElementById('close').onclick=()=>document.getElementById('tray').classList.remove('open');

function fit(){for(const f of [A,B]){const w=f.parentElement.clientWidth;if(!w)continue;scale=w/1282;f.style.transform='scale('+scale+')';f.style.height=Math.max(888,Math.ceil(f.parentElement.clientHeight/scale))+'px';}place();}
new ResizeObserver(fit).observe(document.querySelector('.frames'));
addEventListener('resize',fit);fit();setTimeout(fit,300);setTimeout(fit,1500);
document.addEventListener('visibilitychange',fit);

const desc=el=>{if(!el)return '(page)';const t=(el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,44);
  return el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\\s+/).slice(0,3).join('.'):'')+(t?' — "'+t+'"':'');};
const label=el=>{const t=(el.textContent||'').replace(/\\s+/g,' ').trim();return t.length&&t.length<=60?t:(el.getAttribute('aria-label')||'');};
const bare=s=>s.replace(/\\s+[A-Z]$/,'').trim().toLowerCase();
// 🔴 THE TWO SIDES SCROLL DIFFERENT ELEMENTS, MEASURED 2026-09-05 23:12 EDT, and assuming one of
// them is why scroll-sync silently did nothing. The MOCKUP scrolls main (4079 over 1330); the PORTAL
// harness scrolls the DOCUMENT (1518 over 1382) and its main does not scroll at all. Attaching to
// main on the portal side listened to an element that never fires scroll and then wrote scrollTop to
// an element that ignores it -- two no-ops that look exactly like a working feature.
// 🔴 WHICH SIDE YOU PIN IS NOT A DECISION YOU SHOULD HAVE TO MAKE, and being asked to make it is a
// design fault in the first version of this tool. Harkirat hit the case that proves it: the identity
// chip EXISTS on both sides and shows different things, so it is simultaneously broken here and
// copied-from there. The pin captures what BOTH sides show, so the note answers the question either
// way and the side you clicked becomes an implementation detail.
const seen=el=>((el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,70))||'(no text)';
function counterpart(el,od){
  if(!od)return '(other side unavailable)';
  const cls=(typeof el.className==='string'&&el.className.trim())?'.'+el.className.trim().split(/\\s+/).join('.'):'';
  let hit=cls?od.querySelector(el.tagName.toLowerCase()+cls):null;
  if(!hit&&cls)hit=od.querySelector('.'+el.className.trim().split(/\\s+/)[0]);
  if(!hit)return '(nothing with that class on the other side — it may be MISSING there)';
  return seen(hit);
}
const scroller=d=>{const c=[d.querySelector('main'),d.scrollingElement,d.documentElement,d.body];
  return c.find(e=>e&&e.scrollHeight>e.clientHeight+4)||d.scrollingElement||d.body;};

// Pins live ON the element, so they follow it when the page scrolls or re-renders.
function place(){
  for(const side of ['a','b']){LAYER[side].innerHTML='';}
  pins.forEach(p=>{
    if(!p.el||!p.el.isConnected)return;
    const r=p.el.getBoundingClientRect();
    const host=(p.side==='a'?A:B),vp=VP[p.side];
    const d=document.createElement('div');d.className='pin-dot';d.textContent=p.n;
    d.style.left=((r.left+r.width*p.fx)*scale-vp.scrollLeft+host.offsetLeft)+'px';
    d.style.top=((r.top+r.height*p.fy)*scale-vp.scrollTop)+'px';
    d.title=p.text||'(no note yet)';
    d.onclick=ev=>{ev.stopPropagation();openPop(p,ev.clientX,ev.clientY);};
    d.oncontextmenu=ev=>{ev.preventDefault();ev.stopPropagation();del(p);};
    d.title=(p.text||'(no note yet)')+'  —  click to edit, right-click to delete';
    LAYER[p.side].appendChild(d);
  });
  renderList();
}
function renderList(){
  const L=document.getElementById('list');L.innerHTML='';
  if(!pins.length){L.innerHTML='<div class="n"><em>No pins yet. Turn on pin mode and click anything that looks wrong.</em></div>';return;}
  pins.forEach(p=>{const d=document.createElement('div');d.className='n';
    d.innerHTML='<i>'+p.n+'</i> '+p.what+'<br><em>mk: '+(p.side==='a'?p.mine:p.theirs)+'</em><br><em>pt: '+(p.side==='a'?p.theirs:p.mine)+'</em><br>'+(p.text?p.text:'<em>(unsaved)</em>');
    const x=document.createElement('button');x.textContent='×';x.style.cssText='float:right;padding:0 7px;margin-left:6px';
    x.onclick=e=>{e.stopPropagation();del(p);};d.prepend(x);
    d.onclick=()=>{p.el.scrollIntoView({block:'center'});setTimeout(place,120);};L.appendChild(d);});
}
let editing=null;
// A pin you cannot remove makes the tool worse the longer you use it. Three ways out: right-click the
// dot, the x in the list, or Delete in the open editor. Removal is local -- anything already saved
// stays in the markdown file, which is an append-only record of what you said at the time.
function del(p){pins=pins.filter(q=>q!==p);if(editing===p){document.getElementById('pop').style.display='none';editing=null;}place();}
function openPop(p,x,y){
  editing=p;const pop=document.getElementById('pop');
  const mk=p.side==='a'?p.mine:p.theirs, pt=p.side==='a'?p.theirs:p.mine;
  document.getElementById('popwho').innerHTML='<b>'+p.what+'</b><br>mockup shows: <b>'+mk+'</b><br>portal shows: <b>'+pt+'</b>';
  document.getElementById('poptext').value=p.text||'';
  pop.style.display='block';pop.style.left=Math.min(x,innerWidth-320)+'px';pop.style.top=Math.min(y,innerHeight-220)+'px';
  document.getElementById('poptext').focus();
}
document.getElementById('popcancel').onclick=()=>{document.getElementById('pop').style.display='none';editing=null;};
document.getElementById('popdel').onclick=()=>{if(editing)del(editing);};
document.getElementById('popsave').onclick=async()=>{
  if(!editing)return;editing.text=document.getElementById('poptext').value.trim();
  document.getElementById('pop').style.display='none';
  await fetch('/note',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({realm:document.getElementById('realm').value,
      at:'pin #'+editing.n+' · '+editing.what+String.fromCharCode(10)+'**Mockup shows:** '+(editing.side==='a'?editing.mine:editing.theirs)+String.fromCharCode(10)+'**Portal shows:** '+(editing.side==='a'?editing.theirs:editing.mine),
      text:editing.text})});
  editing=null;place();
};

function wire(frame,other,side,name){
  const doc=frame.contentDocument;if(!doc||!doc.body)return false;
  if(doc.__synced)return true;doc.__synced=true;
  doc.addEventListener('click',ev=>{
    if(pinning){
      ev.preventDefault();ev.stopPropagation();
      const el=ev.target,r=el.getBoundingClientRect();
      const p={n:++seq,side,el,what:desc(el),text:'',mine:seen(el),theirs:counterpart(el,other.contentDocument),
        fx:r.width?(ev.clientX-r.left)/r.width:.5,fy:r.height?(ev.clientY-r.top)/r.height:.5};
      pins.push(p);place();
      const host=frame.getBoundingClientRect();
      openPop(p,host.left+ev.clientX*scale,host.top+ev.clientY*scale);
      return;
    }
    const el=ev.target.closest('button,a,[role="button"],[role="tab"],summary,label,th');
    if(!el||!clickSync)return;
    const want=bare(label(el));if(!want)return;
    const od=other.contentDocument;if(!od)return;
    const c=[...od.querySelectorAll('button,a,[role="button"],[role="tab"],summary,label,th')];
    const hit=c.find(x=>bare(label(x))===want)||c.find(x=>bare(label(x)).startsWith(want));
    if(hit){hit.click();stat('↔ "'+label(el)+'" clicked on both');}
    else stat('✗ "'+label(el)+'" has NO MATCH on the other side — that is itself a finding');
    setTimeout(place,300);
  },true);
  let lock=false;
  const onScroll=()=>{
    place();
    if(!scrollSync||lock)return;lock=true;
    const sc=scroller(doc),o=scroller(other.contentDocument);
    const ratio=sc.scrollTop/Math.max(1,sc.scrollHeight-sc.clientHeight);
    o.scrollTop=ratio*Math.max(0,o.scrollHeight-o.clientHeight);
    setTimeout(()=>{lock=false;},50);
  };
  // Both, because which one fires depends on WHICH element scrolls, and that differs per side.
  doc.addEventListener('scroll',onScroll,{passive:true,capture:true});
  const sc0=scroller(doc);if(sc0&&sc0!==doc.scrollingElement)sc0.addEventListener('scroll',onScroll,{passive:true});
  return true;
}
// 🔴 POLL, NEVER WAIT ON load. The first version wired inside Promise.all of two load listeners and
// attached them AFTER the frames had already fired load, so wire() never ran and both syncs were
// dead while the UI said they were on. A frame that is already complete has no event left to give.
let tries=0;
const boot=setInterval(()=>{
  const ok=wire(A,B,'a','mockup')&&wire(B,A,'b','portal');
  if(ok){clearInterval(boot);stat('synced — click anything, or turn on pin mode');fit();}
  else if(++tries>60){clearInterval(boot);stat('could not reach a frame — reload');}
},250);
for(const vp of Object.values(VP))vp.addEventListener('scroll',place,{passive:true});
</script></body></html>`;


const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'POST' && u.pathname === '/note') {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
            let n; try { n = JSON.parse(body); } catch { res.writeHead(400); return res.end('bad json'); }
            const stamp = new Date().toLocaleString('en-CA', { timeZone: 'America/New_York', hour12: false });
            fs.mkdirSync(path.dirname(NOTES), { recursive: true });
            if (!fs.existsSync(NOTES)) fs.writeFileSync(NOTES, '# Portal sync — what Harkirat saw\n\n*Written by `npm run portal:sync`. Each note records the realm and the last control clicked, so a finding points at something rather than describing it.*\n');
            fs.appendFileSync(NOTES, `\n## ${n.realm} — ${stamp} EDT\n**Last clicked:** ${n.at}\n\n${n.text}\n`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end('{"ok":true}');
        });
        return;
    }
    // 🔴 THE PORTAL IS SERVED AT THE ROOT AND THE MOCKUP UNDER A PREFIX, NOT THE OTHER WAY ROUND, AND THE FIRST VERSION HAD IT BACKWARDS. `harness.html`'s import map names ABSOLUTE `/ui/*.js` paths, so under a `/pt/` prefix every module resolved to `/ui/...` at the root — which fell through to the shell, returned 200 with `text/html`, and the frame rendered BLANK with no error anyone would see. A 200 that hands back the wrong content-type is the worst kind of not-found. The mockup's paths are all relative, so it is the side that can safely live under a prefix.
    if (u.pathname.startsWith('/mk/')) return sendFile(res, MK, decodeURIComponent(u.pathname.slice(4)));
    if (u.pathname === '/' || u.pathname === '') {
        const realm = REALMS[u.searchParams.get('realm')] ? u.searchParams.get('realm') : 'season';
        res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
        return res.end(SHELL(realm));
    }
    return sendFile(res, PT, decodeURIComponent(u.pathname.slice(1)));
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`\nportal:sync — http://127.0.0.1:${PORT}\n`);
    console.log(`  left  : the mockup, the approved design`);
    console.log(`  right : ${REAL ? 'the LIVE dev server on :8787 (real data — data differences are EXPECTED)' : 'the harness, on the mockup\'s own fixtures (a difference is a DESIGN difference)'}`);
    console.log(`  notes : local/portal-sync-notes.md\n`);
    console.log(`  ⚠️ Click-sync matches on the VISIBLE LABEL, so a control the two sides spell`);
    console.log(`     differently reports NO MATCH rather than clicking the wrong thing — that`);
    console.log(`     refusal is itself a finding worth noting.\n`);
});
