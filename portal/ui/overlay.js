// portal/ui/overlay.js — ESM. The three pieces of chrome every realm needs and none of them owns: the modal drawer, the toast, and the confirmation the drawer wraps.
//
// 🔴 THE DRAWER IS ACTUALLY MODAL, WHICH A SCRIM ALONE IS NOT. Measured in the mockup with a typed confirmation open: 218 focusable elements outside the drawer were still reachable, so somebody could tab past a purge dialog and press something else on the page behind it. A scrim stops the mouse and says nothing to the keyboard — the visual half of modality built, the behavioural half not, which is the same shape as an onclick with no tabindex.
//
// `inert` is the honest primitive: it removes the rest of the page from the tab order AND from the accessibility tree, so a screen reader stops reading the page behind too — which a hand-rolled TAB-cycling trap never fixes.
import { h } from '../vendor/preact.mjs';
import { html } from '../vendor/htm-preact.mjs';
import { useEffect, useRef, useState } from '../vendor/preact-hooks.mjs';
import { Icon } from './icons.js';

export function Drawer({ eyebrow, title, children, actions, wide, side, onClose }) {
    const ref = useRef(null);
    // Which regions the dialog takes out of the page. Resolved on every pass rather than captured once: Preact re-renders the Shell when the overlay slot changes, and an attribute written to a node that has since been replaced is an attribute on nothing.
    const shellRegions = () => [
        document.querySelector('.app > main'),
        document.getElementById('hdr'),
        document.querySelector('.app > nav.rail'),
        // ⚠️ THE STAGED TRAY IS `position:fixed` AND IS NOT INSIDE ANY OF THE THREE ABOVE, so it stayed in the tab order behind every open dialog — PASS 4 caught it on the tray's first run, 2026-09-04 21:28 EDT. ⚠️ A Shell-side MutationObserver was written first and was BOTH a second implementation of this list and a worse one: it could not see the realm-local drawers (Analytics' event drawer, Season's day drawer) that never pass through `useOverlay`. This list is resolved on every pass, which is why it can.
        document.querySelector('.tray'),
    ].filter(Boolean);

    // 🔴 RE-ASSERTED ON EVERY RENDER, WITH NO DEP ARRAY, AND THAT IS THE FIX RATHER THAN A BELT-AND-BRACES. A mount-only effect wrote `inert` once and the attribute kept reading back absent — measured three times, with the property form and the attribute form both. Whatever dropped it (a re-render replacing the node, an engine detail), the honest response is to make the assertion idempotent and continuous instead of trusting a single write. Setting an attribute that is already set costs nothing. 🔴 APPLIED FROM THE ELEMENT REF, NOT FROM AN EFFECT. Three effect-based versions of this were written and all three left the attribute absent when read back — with the property form, the attribute form, and with no dep array at all — while the dialog itself mounted, rendered and closed correctly. Rather than keep guessing at effect timing, the modality is applied by the one callback whose contract is "you are being handed the mounted node": Preact calls a ref with the element on mount and with null on unmount, which is exactly the pair this needs. It is also directly observable, so the test below can assert it instead of trusting it. 🔴 FOCUS WAS LOST TO `document.body` ON EVERY CLOSE — reproduced on Review's discard-all and Season's typed purge confirm, 2026-09-04 22:43 EDT. The dialog auto-focuses its first control on open (below) and nothing ever put focus back, so cancelling a purge left the reader at document top, 10 tab stops from where they were. WCAG 2.4.3, and the reason no gate caught it is that PASS 4 asks who is focusABLE while a modal is open and never reads `document.activeElement` across an open→close transition. ⚠️ STASHED HERE, NOT IN AN EFFECT: this callback is the one place that is handed the element on mount and `null` on unmount, which is exactly the pair a save/restore needs — the same argument the note below makes for applying `inert` from here rather than from an effect.
    const applyInert = (el) => {
        ref.current = el;
        for (const region of shellRegions()) {
            if (el) region.setAttribute('inert', '');
            else region.removeAttribute('inert');
            // 🔴 THE SCRIM WAS TRAPPED INSIDE `main`. `main{position:relative;z-index:1}` makes a stacking context, so a drawer rendered anywhere inside it paints its scrim at z-index 1 no matter what the scrim's own 44 says — and the sticky header (z 40) stayed lit above a modal that had just declared the page inert. The design's drawer is a child of BODY, which is why it never hit this. Rather than move one component out, `main` stops being a stacking context for exactly as long as a modal is open: nothing inside it reorders, and the scrim's own z-index applies at the level it was written for. Keyboard modality and visual modality now agree. ⚠️ AN ATTRIBUTE, NOT A CLASS. The audit's element signature is tag plus classes, so a class that exists on one side and not the other makes `main` itself unpairable and desynchronises every row beneath it — the instrument reporting a difference the instrument created.
            if (region.tagName === 'MAIN') { if (el) region.setAttribute('data-modal', ''); else region.removeAttribute('data-modal'); }
        }
    };

    // 🔴 FOCUS IS NOT IN THE REF CALLBACK, AND THE PARAGRAPH ABOVE THAT SAID IT SHOULD BE WAS WRONG ABOUT THIS HALF. `applyInert` is a new arrow on every render, so Preact re-invokes it with null and then with the element on EVERY pass — which is harmless for `inert` (idempotent) and fatal for focus (a one-shot event): the "first control" focus fired on every keystroke and every field in every drawer accepted exactly one character before focus jumped to the close button. Measured 2026-09-06 01:41 EDT on Armory's add drawer ("AK117" → "A", activeElement = button.x) and reproduced on Broadcast's PostForm ("hello" → "h") — so it pre-dates the build-out; D1 making every creation form a drawer is what made it unmissable. A mount effect runs once and its cleanup runs once, which is the pair a save/restore actually needs.
    useEffect(() => {
        const opener = document.activeElement;
        const first = ref.current && ref.current.querySelector('button, input, a, textarea, select');
        if (first) first.focus();
        return () => {
            // Only if it is still in the document — a drawer whose opener was a row that the commit removed has nowhere to go back to, and focusing a detached node silently sends focus to body anyway.
            // ⚠️ `preventScroll` — a bare .focus() scrolls the opener into view, which moves the page out from under whatever the reader was reading. It also stalled the states walk twice on Season's identity panel, 2026-09-04 22:45 EDT, which is how this was caught within a minute of writing it.
            if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
        };
    }, []);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    return html`
        <div class="scrim on" onClick=${onClose}></div>
        <aside class=${'drawer open' + (wide ? ' wide' : '') + (side ? ' side' : '')}
               role="dialog" aria-modal="true" aria-label=${title} ref=${applyInert}>
            <header class="dw-h">
                <div class="dw-ttl">
                    ${eyebrow ? html`<span class="dw-eye">${eyebrow}</span>` : null}
                    <h2>${title}</h2>
                </div>
                <!-- 🔴 THE DESIGN DRAWS THIS AS THE CHARACTER ✕ AND THE PORTAL DOES NOT, DELIBERATELY. Its case is
                     that the close has to read identically at any font size — but a text glyph is exactly what
                     inherits metrics nothing here controls, and reference_never_text_glyphs_for_icons is a standing
                     rule while that argument is an inline comment. Kept with shell.js's crumb separator: the two are
                     one rule, and resolving them differently leaves the console with two habits instead. -->
                <button class="x" aria-label="Close" onClick=${onClose}><${Icon} name="x" cls="sm" /></button>
            </header>
            <div class="dw-b">${children}</div>
            ${actions ? html`<footer class="dw-f">${actions}</footer>` : null}
        </aside>`;
}

// A confirmation names the OPERATION and its tier, because "are you sure?" is a question nobody can answer. The destructive variant takes `dang`; everything else takes `go`.
//
// 🔴 `typed` IS THE TIER-3 GATE, AND THE WORD IS NEVER "DELETE". review.logic.js already makes this argument for the commit screen — muscle memory carries you straight through a word you have typed a hundred times — so the word is always something specific to the thing in front of you: the Discord id being revoked, the id fragment of the changeset being committed. Typing it means you looked at it, which is the entire point and the only thing a confirmation can actually buy.
//
// ⚠️ The gate is on the BUTTON, not on the submit path: an enabled button that then refuses is a control lying about its own state. typedConfirmReady comes from overlay.logic.js (classic script, same cross-runtime mechanism as every other .logic.js here).
export function Confirm({ op, tier, title, body, confirmLabel, danger, typed, onConfirm, onCancel }) {
    const [text, setText] = useState('');
    const ready = !typed || typedConfirmReady(text, typed);
    return html`
        <${Drawer} eyebrow=${op ? `${op} · tier ${tier || 3}` : `tier ${tier || 3}`} title=${title} onClose=${onCancel}
                   actions=${html`
                       <button class="btn" onClick=${onCancel}>Cancel</button>
                       <button class=${'btn ' + (danger ? 'dang' : 'go')} disabled=${!ready}
                               onClick=${() => ready && onConfirm()}>${confirmLabel}</button>`}>
            <div class="dwbody">${body}</div>
            ${typed ? html`
                <label class="tc-l" for="tc-in">Type <b>${typed}</b> to confirm</label>
                <input class="tc-in" id="tc-in" autocomplete="off" spellcheck="false" placeholder=${typed}
                       value=${text} onInput=${(e) => setText(e.target.value)} />` : null}
        <//>`;
}

// ⚠️ A TOAST THAT ARRIVES SMOOTHLY AND VANISHES INSTANTLY READS AS BROKEN, NOT AS FAST. The mockup's first version played an entry animation and then called el.remove() mid-frame, so half of every toast's life had no motion in it. The leaving class drives the exit in CSS and the node outlives it — Harkirat: "toasts settle needs a MUCH smoother animation."
export function Toast({ message, actionLabel, onAction, onDone, ms = 5200 }) {
    const [leaving, setLeaving] = useState(false);
    useEffect(() => {
        const t1 = setTimeout(() => setLeaving(true), ms);
        const t2 = setTimeout(onDone, ms + 420);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, []);
    if (!message) return null;
    return html`
        <div class=${'toast' + (leaving ? ' leaving' : '')} role="status" aria-live="polite">
            <span>${message}</span>
            ${actionLabel ? html`<button class="btn" onClick=${() => { onAction(); onDone(); }}>${actionLabel}</button>` : null}
        </div>`;
}

// One place a realm keeps its overlay state, so a realm does not grow three useStates and three conditional branches to do what every other realm also does.
export function useOverlay() {
    const [drawer, setDrawer] = useState(null);
    const [toast, setToast] = useState(null);
    return {
        drawer, toast,
        confirm: (o) => setDrawer(o),
        close: () => setDrawer(null),
        say: (message, actionLabel, onAction) => setToast({ message, actionLabel, onAction, key: Date.now() }),
        render: () => html`
            ${drawer ? html`<${Confirm} ...${drawer} onCancel=${() => setDrawer(null)}
                                        onConfirm=${() => { setDrawer(null); drawer.onConfirm(); }} />` : null}
            ${toast ? html`<${Toast} key=${toast.key} ...${toast} onDone=${() => setToast(null)} />` : null}`,
    };
}
