// portal/ui/composer.js — ESM. The in-page composer: the adopted design's own "add to the season" surface.
//
// 🔴 IT IS A MODAL DRAWER, AND IT WAS INLINE UNTIL 2026-09-06 01:22 EDT. Harkirat's decision: every creation form in this portal is a modal drawer, so the six that exist read as one act rather than six layouts. Broadcast's PostForm is the worked example. ⚠️ THE ARGUMENT THIS REPLACES WAS REAL AND IS NOT DISMISSED — the composer sat above the Track so the thing you describe and the picture of where it lands were on screen together, which is what the live ghost below is for. The ghost survives the move: the dialog is 880px on a 1282px page, so the lanes run past it on both sides and a marker appearing at a date is still visible while you type. What did NOT survive is the scrollIntoView that brought the inline form into view; a fixed dialog has nowhere to scroll to, so the effect and its comment went with the layout they described.
//
// 🔴 AND THE FORM FOLLOWS THE RECORD. A draw has one date; an event has a window. The fields change with the type rather than showing a union of every type's fields with the irrelevant ones greyed out — that shape is how a form starts lying about what the record holds.
//
// composerReason/composerFields come from composer.logic.js, loaded as a classic script — see track.js's header for why every .logic.js sibling here loads that way.
import { h } from '../vendor/preact.mjs';
import { html } from '../vendor/htm-preact.mjs';
import { useState, useEffect, useRef } from '../vendor/preact-hooks.mjs';
import { fetchJson } from './httpClient.js';
import { DiscordCard } from './v2Render.js';
import { Drawer } from './overlay.js';

const DAY = { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' };
const fmtDay = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString(undefined, DAY);

// 🔴 THE DATE IS PARSED BY THE SERVER, WHICH IS THE POINT RATHER THAN AN IMPLEMENTATION DETAIL. `chrono-node` has understood "in 3 weeks" for this bot since /manage was built, and the portal was the one surface that made you click through a calendar instead. Shipping a second parser to the browser would put two implementations behind one promise — the echo would show what the CLIENT resolved while the server stored what chrono resolved — so this asks /api/parse-date, which calls the bot's own parseAdminDate. See portal/api/dates.js.
//
// ⚠️ Debounced, and every reply is checked against the value that is in the field NOW. Typing "sep" then "sep 21" fires two requests, and nothing guarantees they come back in that order; without the guard the slower "sep" reply overwrites the newer "sep 21" answer and the echo contradicts the field it sits under.
function SmartDate({ id, label, value, iso, placeholder, onChange }) {
    const latest = useRef(value);
    latest.current = value;
    useEffect(() => {
        const raw = String(value || '').trim();
        if (!raw) { onChange(value, null); return undefined; }
        const t = setTimeout(() => {
            fetchJson(`/api/parse-date?q=${encodeURIComponent(raw)}`)
                .then((d) => { if (latest.current === value) onChange(value, d.iso || null); })
                .catch(() => {});
        }, 220);
        return () => clearTimeout(t);
    }, [value]);

    const raw = String(value || '').trim();
    return html`
        <!-- The design wraps only the NAME field in nw-f; a date field is a bare div, and the extra class
             carried the form's own column padding onto two boxes that are already inside nw-dates. -->
        <div>
            <label class="nw-l" for=${id}>${label}</label>
            <input class="nw-i nw-smart" id=${id} type="text" autocomplete="off" spellcheck="false"
                   placeholder=${placeholder} value=${value}
                   onInput=${(e) => onChange(e.target.value, null)} />
            <!-- ⚠️ NOT the generic hint class. The sheet draws this specific line — nw-date-echo, with ok and
                 bad states — because it is a RESULT, not a hint: it reports what the server resolved
                 and whether it resolved at all, and it had been rendering in the generic muted grey that
                 says neither. -->
            <!-- The design creates this line ONCE and rewrites its class, so an untouched date field still
                 carries an empty echo. Rendering it only when there is text made the element itself a
                 state, which is a different shape from the one the stylesheet reserves space for. -->
            ${html`
                <span class=${['nw-date-echo', !raw ? '' : (iso ? 'ok' : 'bad')].filter(Boolean).join(' ')}>
                    ${!raw ? '' : (iso ? `${fmtDay(iso)}  ·  ${iso}` : 'not a date yet')}
                </span>`}
        </div>
    `;
}

// ⚠️ "PASTE ANYTHING NEEDS TO BE MORE INTUITIVE." The intuitive version is not a better drawer — it is not being a drawer. The field sits inside the composer, beside the form it replaces, and parses as you type: one thing to look at, and the demonstration and the control are the same object.
//
// 🔴 THE PARSING IS THE BOT'S OWN, over HTTP. utils/adminParser.js has ingested pasted lists for /manage since it was built, including the traps already paid for there — a date written "July 16, 2026" splitting across two comma fields, a bulleted Notes paste arriving as one physical line. A browser reimplementation would preview rows the bot would then read differently, which is the one thing a preview must not do. ⚠️ THE RAW TEXT IS PASSED ALONG WITH THE PARSED ROWS, because the two callers need different halves. Staging into the LIVE season builds one op per row from the parsed values; staging into the DRAFT sends the text, because core/ops/season.js's draft bulk ops parse server-side and resolve draw thumbnails while they are at it — reconstructing that text from the rows would be a second, lossier serializer for a string this component already has.
function PasteZone({ kind, onStageAll }) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [rows, setRows] = useState([]);
    const latest = useRef('');
    latest.current = text;

    useEffect(() => {
        if (!open || !text.trim()) { setRows([]); return undefined; }
        const t = setTimeout(() => {
            fetchJson('/api/parse-bulk', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ kind, text }),
            }).then((d) => { if (latest.current === text) setRows(d.rows || []); }).catch(() => {});
        }, 280);
        return () => clearTimeout(t);
    }, [text, kind, open]);

    const ok = rows.filter((r) => r.ok);
    if (!open) {
        return html`<div class="pz shut"><button type="button" class="pz-open" onClick=${() => setOpen(true)}>Or paste a list instead</button></div>`;
    }
    return html`
        <div class="pz">
            <button type="button" class="pz-open" onClick=${() => { setOpen(false); setText(''); setRows([]); }}>Close the paste box</button>
            <textarea class="pz-in" rows="4" spellcheck="false" value=${text}
                      placeholder=${kind === 'draw' || kind === 'returning'
                          ? 'Crimson Moonlight, Fennec, Sep 3\nJudgment Day, AK117, Sep 10'
                          : 'Clan Wars — Sep 3 to Sep 12\nDouble CP Weekend — Sep 5'}
                      onInput=${(e) => setText(e.target.value)}></textarea>
            <div class="pz-out">
                ${rows.length ? html`
                    <div class="pz-rows">
                        ${rows.map((r, i) => html`
                            <div class=${'pz-r' + (r.ok ? '' : ' bad')} key=${i}>
                                <i class="pz-d"></i>
                                <span class="pz-k">${kind}</span>
                                <span class="pz-n">${r.name || 'unnamed'}</span>
                                <span class="pz-w">${r.start ? (r.end && r.end !== r.start ? `${r.start} → ${r.end}` : r.start) : 'no date found'}</span>
                            </div>`)}
                    </div>
                    <div class="pz-act">
                        <!-- 🔴 A LINE THE PARSER COULD NOT READ IS SHOWN, NEVER DROPPED. A paste where three of eight lines fell out silently is exactly the failure a preview exists to prevent, and the count says both numbers so the difference is unmissable. -->
                        <span class="pz-sum">${ok.length} of ${rows.length} ${rows.length === 1 ? 'line' : 'lines'} understood</span>
                        <button class="pill lead" disabled=${!ok.length}
                                onClick=${() => onStageAll(ok, text)}>Stage ${ok.length}</button>
                    </div>` : null}
            </div>
        </div>
    `;
}

// 🔴 IT SAYS WHAT THE RECORD WILL BE, IN THE SENTENCE THE BOT WOULD USE — not a second copy of the form's own fields. The composer already draws a ghost onto the Track (below), which answers WHERE; this answers WHAT, because the Track cannot show a name or tell a one-date release from a window that happens to be a day long.
//
// ⚠️ IT RENDERS NOTHING UNTIL THERE IS SOMETHING TRUE TO SAY. `.nwhost .nw-prev:empty{display:none}` is in the adopted sheet, so an empty preview must be genuinely EMPTY rather than a wrapper holding a placeholder — a "nothing yet" line would reserve 76px of the composer forever and defeat the rule.
function ComposePreview({ state, type }) {
    const ghost = composeGhostFor(state, type);
    const name = (state.name || '').trim();
    // 🔴 A DATE ALONE IS NOT SOMETHING TRUE TO SAY. With the first date pre-filled the way the design pre-fills it, this rendered a card titled "Name" for a record nobody had named yet — 153px of preview above a form still on its first field, where the design shows none. The rule this file already states ("nothing until there is something true to say") needed the name in its condition.
    if (!ghost || !type || !name) return html`<div class="nw-prev"></div>`;
    const window = ghost.shape === 'point' || ghost.end === ghost.start
        ? fmtDay(ghost.start)
        : `${fmtDay(ghost.start)} → ${fmtDay(ghost.end)}`;
    // ⚠️ THE CARD, NOT A SENTENCE. The first version of this read the record back as prose, which is a second way of saying what the fields above already say. What nothing else on the page can say is what it will look like in Discord — the surface every one of these records exists for.
    return html`
        <div class="nw-prev">
            <${DiscordCard} accent=${type.hex} title=${name || type.nameLabel || 'Unnamed'}
                            sub=${type.label}
                            rows=${[[ghost.shape === 'point' ? 'Releases' : 'Runs', window]]} />
        </div>
    `;
}

// The items a draw carries, in the bot's own shorthand, previewed as it is typed.
//
// 🔴 THE PARSING IS THE BOT'S, OVER HTTP — the same argument SmartDate makes for dates. `parseItemLine` in utils/adminParser.js is what /manage's add-draw modal has read this shorthand with since it was built, including the trap already paid for there (a "-#" comment line must be matched before the tier branch, or the note is title-cased and filed under a nonsense tier). A browser copy would preview tiers the bot then resolves differently. See portal/api/dates.js.
//
// ⚠️ THE PREVIEW SITS BESIDE THE BOX, NOT UNDER IT. What this answers is "did the first word read as a tier", which is a question about the line you are looking at — under the box it would be off the fold by the fifth item, which is where the answer stops being free.
function ItemsField({ text, rows, errors, onChange }) {
    const latest = useRef(text);
    latest.current = text;
    useEffect(() => {
        const raw = String(text || '');
        if (!raw.trim()) { onChange(raw, [], []); return undefined; }
        const t = setTimeout(() => {
            fetchJson('/api/parse-items', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ text: raw }),
            }).then((d) => { if (latest.current === text) onChange(text, d.items || [], d.errors || []); }).catch(() => {});
        }, 240);
        return () => clearTimeout(t);
    }, [text]);

    return html`
        <div class="nw-items">
            <div class="nw-f">
                <label class="nw-l" for="nw-items">Items</label>
                <textarea class="nw-i nw-ta" id="nw-items" rows="6" spellcheck="false"
                          placeholder=${'m Character Name\nl Gun Name\ne Emote Name'}
                          value=${text} onInput=${(e) => onChange(e.target.value, rows, errors)}></textarea>
                <p class="nw-note">One per line. The first word is the tier — <b>m</b> mythic, <b>l</b> legendary,${' '}
                    <b>e</b> epic, <b>lg</b> legacy — and the rest is the name.</p>
            </div>
            <div class="nw-f">
                <label class="nw-l">What that reads as</label>
                ${rows.length || errors.length ? html`
                    <div class="pz-rows">
                        ${rows.map((r, i) => html`
                            <div class="pz-r" key=${'i' + i}>
                                <i class="pz-d"></i>
                                <span class="tiers">${r.tier === 'comment' ? null : html`<b class=${'t-' + r.tier}>${r.tier}</b>`}</span>
                                <span class="pz-n">${r.tier === 'comment' ? html`<em>${r.name}</em>` : r.name}</span>
                            </div>`)}
                        ${errors.map((e) => html`
                            <div class="pz-r bad" key=${'e' + e.line}>
                                <i class="pz-d"></i>
                                <span class="pz-k">line ${e.line}</span>
                                <span class="pz-n">${e.text}</span>
                                <span class="pz-w">not read</span>
                            </div>`)}
                    </div>`
                : html`<p class="nw-note">Nothing typed yet. A draw can be staged with no items and have them
                    filled in later, but the tiers are what the Discord card is built from.</p>`}
            </div>
        </div>
    `;
}

// 🔴 THE PREVIEW IS THE BROKEN-LINK DETECTOR, and that is the whole reason it is an image rather than a tidy chip saying "1 URL". Every thumbnail in this project is re-hosted on Cloudinary when it commits, so a link that is already dead when it is typed produces a draw with no image and no complaint — the exact failure the season record's own banner fields were given a broken-state for. An `img` that cannot load says so at the moment somebody can still fix it.
function ThumbField({ value, onChange }) {
    const [broken, setBroken] = useState(false);
    const url = String(value || '').trim();
    // Cleared on every change, or a URL corrected after a failure keeps reading as broken.
    useEffect(() => { setBroken(false); }, [url]);
    return html`
        <div class="nw-f">
            <label class="nw-l" for="nw-thumb">Thumbnail URL</label>
            <input class="nw-i" id="nw-thumb" type="text" autocomplete="off" spellcheck="false"
                   placeholder="https://… — blank reuses the cached image for this title"
                   value=${value} onInput=${(e) => onChange(e.target.value)} />
            ${url ? html`
                <div class=${'thumbprev' + (broken ? ' bad' : '')}>
                    <img src=${url} alt="" onError=${() => setBroken(true)} onLoad=${() => setBroken(false)} />
                    ${broken ? html`<span class="tp-bad">That link did not load. It would commit as a draw with no image.</span>`
                        : html`<span class="tp-ok">Loads. It is re-hosted on Cloudinary when this commits.</span>`}
                </div>`
            : html`<p class="nw-note">Blank reuses whatever is already cached for this exact title —${' '}
                the same rule /manage follows.</p>`}
        </div>
    `;
}

// The kinds whose pasted lines utils/adminParser.js actually has a bulk grammar for. A patch note has none, and the box used to render for it anyway: pasting there ran the CALENDAR parser and staged publications from rows it had read as events. A control that offers a grammar the parser does not have is worse than no control, because the preview looks like a confirmation.
const PASTEABLE = ['draw', 'returning', 'event', 'playlist'];

export function Composer({ types, initialType, onStage, onStageMany, onCancel, onLive }) {
    // The design opens with the first date already set to today — its Track ghost reads "+ Aug 24" and the echo under the field reads it back resolved. An empty field is not the same offer: it asks the reader to supply a date the page already knows.
    const todayISO = () => new Date().toISOString().slice(0, 10);
    const BLANK = { name: '', aText: '', aIso: null, bText: '', bIso: null,
        items: '', itemRows: [], itemErrors: [], note: '', thumb: '', description: '', urls: '', doubleCP: false };
    const [state, setState] = useState({ ...BLANK, type: initialType || null,
        // The composer opens with today already in it, which is what makes the Track's live ghost appear the moment it mounts rather than waiting for a keystroke.
        aText: todayISO(), aIso: todayISO() });
    const type = types.find((t) => t.key === state.type) || null;

    // 🔴 THE SIGNATURE MOMENT, and the one thing /manage structurally cannot do: it answers "when" with a line of text, and this draws the item where it will land, in its own lane, before it is staged. The composer does not own the Track, so it reports and the page draws.
    //
    // ⚠️ ONE EFFECT. There were two, with the same body and near-identical dep arrays — the second was added for the open-with-a-date case the first already covered, so every keystroke reported the ghost twice.
    //
    // ⚠️ The ISO date is reported, never the typed text. `aText` is only what the field shows so a repaint does not throw away half-typed words; `aIso` is what the server resolved. A ghost placed from the raw text would jump around while somebody types "sep" on the way to "sep 21".
    useEffect(() => { if (onLive) onLive(composeGhostFor(state, type)); }, [state.type, state.name, state.aIso, state.bIso]);

    const reason = composerReason(state, type);
    const set = (patch) => setState((prev) => ({ ...prev, ...patch }));

    // Switching type keeps the name and drops everything else: the name is about the thing, and every other field belongs to a record shape that just changed. Carrying a draw's item list into a playlist would hand the next payload a field its schema does not declare.
    const pickType = (key) => setState((prev) => ({ ...BLANK, type: key, name: prev.name }));

    // ⚠️ THE MASTHEAD'S ADD CHIPS WERE DEAD ONCE THE COMPOSER WAS OPEN. They call setShowAdd(key), which lands here as `initialType` — and `useState(initialType)` reads its argument once and ignores every later value, so pressing "Playlist" while composing a draw looked like a switch and did nothing. Adopting the new value is the same act as pressing this composer's own type chip, so it goes through pickType rather than a second code path with its own idea of what a switch means.
    useEffect(() => {
        if (initialType && initialType !== state.type) pickType(initialType);
    }, [initialType]);

    // ⚠️ THE REASON IS THE FOOTER'S FIRST CHILD, not a line under the offending field. It is the answer to "why can I not press this", so it belongs where the question is asked — beside the button it explains.
    const actions = html`
        <span class="nw-why">${reason || 'Ready to stage.'}</span>
        <button class="btn" onClick=${onCancel}>Cancel</button>
        <button class="btn go" disabled=${Boolean(reason)}
                onClick=${() => onStage(state.type, composerFields(state, type))}>
            ${type ? `Stage ${type.single || String(type.label).toLowerCase()}` : 'Stage it'}</button>`;

    return html`
        <${Drawer} wide title="Add to the season" onClose=${onCancel} actions=${actions}
                   eyebrow=${type ? `${type.opName || 'season.add'} · tier 1` : 'Nothing picked yet'}>
            <div class="nw">
                <div class="nw-types" role="group" aria-label="What are you adding">
                    ${types.map((t) => html`
                        <button type="button" key=${t.key} class=${'nw-chip' + (state.type === t.key ? ' on' : '')}
                                style=${`--c:${t.hex}`} aria-pressed=${state.type === t.key ? 'true' : 'false'}
                                onClick=${() => pickType(t.key)}>
                            <span class="nw-dot"></span>${t.label}
                            <em>${t.shape === 'point' ? 'one date' : 'a window'}</em>
                        </button>`)}
                </div>
                ${type && onStageMany && PASTEABLE.includes(type.key) ? html`
                    <div class="nw-paste">
                        <${PasteZone} kind=${type.key} onStageAll=${(rows, raw) => onStageMany(type.key, rows, raw)} />
                    </div>` : null}
                <div class="nw-form">
                    ${!type ? html`
                        <p class="nw-hint">Pick what you are adding. The form follows the record — a release asks for
                            one date, a window asks for two.</p>`
                    : html`
                        <div class="nw-f nw-f-name">
                            <label class="nw-l" for="nw-name">${type.nameLabel || 'Name'}</label>
                            <input class="nw-i" id="nw-name" type="text" autocomplete="off" spellcheck="false"
                                   placeholder=${type.placeholder || ''} value=${state.name}
                                   onInput=${(e) => set({ name: e.target.value })} />
                        </div>
                        <div class=${'nw-dates' + (type.shape === 'point' && !type.windowable ? ' one' : '')}>
                            <${SmartDate} id="nw-a" label=${type.shape === 'point' ? (type.dateLabel || 'Releases') : 'Opens'}
                                          value=${state.aText} iso=${state.aIso} placeholder="sep 21, in 3 weeks, tomorrow"
                                          onChange=${(aText, aIso) => set({ aText, aIso })} />
                            ${type.shape === 'span' ? html`
                                <${SmartDate} id="nw-b" label="Closes" value=${state.bText} iso=${state.bIso}
                                              placeholder="end of the month"
                                              onChange=${(bText, bIso) => set({ bText, bIso })} />` : null}
                            ${type.windowable ? html`
                                <${SmartDate} id="nw-b" label="Buyable until (optional)" value=${state.bText} iso=${state.bIso}
                                              placeholder="leave blank for a release date only"
                                              onChange=${(bText, bIso) => set({ bText, bIso })} />` : null}
                        </div>
                        ${type.windowable ? html`
                            <p class="nw-note">A closing date stages a second change — the draw <b>window</b> on the
                                calendar, opening on the release date. Blank stages the draw alone.</p>` : null}
                        ${type.shape === 'point' && !type.windowable ? html`
                            <p class="nw-note">${type.pointNote || 'This has no end date — the record stores one date.'}</p>` : null}
                        ${type.windowable ? html`
                            <${ThumbField} value=${state.thumb} onChange=${(thumb) => set({ thumb })} />
                            <${ItemsField} text=${state.items} rows=${state.itemRows} errors=${state.itemErrors}
                                           onChange=${(items, itemRows, itemErrors) => set({ items, itemRows, itemErrors })} />
                            <div class="nw-f">
                                <label class="nw-l" for="nw-note">Note (optional)</label>
                                <input class="nw-i" id="nw-note" type="text" autocomplete="off"
                                       placeholder="Character bundle only, no weapon this time"
                                       value=${state.note} onInput=${(e) => set({ note: e.target.value })} />
                                <p class="nw-note">Stored as the draw's own subtext line, the same as a${' '}
                                    <b>-#</b> line in the list above.</p>
                            </div>` : null}
                        ${type.key === 'patchnote' ? html`
                            <div class="nw-f">
                                <label class="nw-l" for="nw-desc">Additional info</label>
                                <textarea class="nw-i nw-ta" id="nw-desc" rows="4" value=${state.description}
                                          placeholder=${'# Weapon name\nAttachment\nb: buffed something\nn: nerfed something'}
                                          onInput=${(e) => set({ description: e.target.value })}></textarea>
                                <p class="nw-note">Rendered under the images.${' '}
                                    <b>b:</b>, <b>n:</b> and <b>f:</b> become the buff, nerf and fix marks.</p>
                            </div>
                            <div class="nw-f">
                                <label class="nw-l" for="nw-urls">Images</label>
                                <textarea class="nw-i nw-ta" id="nw-urls" rows="4" spellcheck="false" value=${state.urls}
                                          placeholder=${'One URL per line — the first five are slot 1, the next five slot 2'}
                                          onInput=${(e) => set({ urls: e.target.value })}></textarea>
                                <p class="nw-note">${splitPatchUrls(state.urls).urls1.length + splitPatchUrls(state.urls).urls2.length} of 10 used.${' '}
                                    ${splitPatchUrls(state.urls).over ? html`<b>The extra ${splitPatchUrls(state.urls).over} would be dropped.</b>` : null}${' '}
                                    Each one is re-hosted on Cloudinary when this commits.</p>
                            </div>` : null}
                        ${type.key === 'event' ? html`
                            <div class="nw-f">
                                <label class="nw-l">Preset</label>
                                <div class="nw-types" role="group" aria-label="Event presets">
                                    <button type="button" class=${'nw-chip' + (state.doubleCP ? ' on' : '')}
                                            style="--c:var(--ev)" aria-pressed=${state.doubleCP ? 'true' : 'false'}
                                            onClick=${() => set({ doubleCP: !state.doubleCP,
                                                name: !state.doubleCP && !state.name.trim() ? 'Double CP Weekend' : state.name })}>
                                        <span class="nw-dot"></span>Double CP${' '}
                                        <em>marks the window</em>
                                    </button>
                                </div>
                                <p class="nw-note">A stored flag, not a title — <b>/calendar</b> draws the Double CP mark
                                    from it, so an event named for it without the flag is unmarked.</p>
                            </div>` : null}`}
                </div>
                <${ComposePreview} state=${state} type=${type} />
            </div>
        <//>
    `;
}
