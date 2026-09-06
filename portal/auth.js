// portal/auth.js
//
// Discord OAuth (identify scope only) + host-only session cookies. The Discord token itself is discarded immediately after the callback exchanges it for a user id — this process never holds a live Discord API credential beyond the few milliseconds it takes to make that one call.
//
// 🔴 The DOOR gate is `isAdmin(userId)` — owner, or any admin holding at least one permission token. There is no separate 'portal' permission and none is added (spec §8.2): holding any `manage.*` scope, or `bot`, is what admits you. Each realm and each control re-checks its OWN scope server-side afterwards — requireAdmin below only answers "may this person open the door at all".
const crypto = require('node:crypto');
const https = require('node:https');
const PortalSession = require('../models/PortalSession');
const { isAdmin, isOwner, hasCommandAccess } = require('../utils/adminAccess');
const { sendJson, forbidden } = require('./api/httpUtil');

const SESSION_COOKIE = 'portal_session';
const STATE_COOKIE = 'portal_oauth_state';
const SESSION_MAX_AGE = 12 * 60 * 60; // seconds — matches PortalSession's Mongo TTL

function randomToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
}

function hashSession(raw) {
    return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const u = new URL('https://discord.com/api/oauth2/authorize');
    u.searchParams.set('client_id', clientId);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', 'identify');
    u.searchParams.set('state', state);
    return u.toString();
}

// Not a true constant-time compare across unequal lengths (timingSafeEqual throws on that), but a length mismatch leaks nothing an attacker doesn't already know (state tokens are a fixed length), and the fallback keeps this from ever throwing on a forged/missing value.
function verifyState(received, expected) {
    if (!received || !expected) return false;
    const a = Buffer.from(String(received));
    const b = Buffer.from(String(expected));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

// 🔴 THE ORIGIN A REQUEST ARRIVED ON, not the one an env var names. Everything below keys off this: the cookie's `Secure` flag, the OAuth redirect_uri, and the allowlist that decides whether a login can complete at all. Behind the Cloudflare tunnel the original Host is forwarded and the scheme arrives as `x-forwarded-proto`, so this reports the public hostname; run directly and it reports localhost. Same code, both ways of running the dev portal.
function originOf(req) {
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
        || (req.socket && req.socket.encrypted ? 'https' : 'http');
    return `${proto}://${req.headers.host}`;
}

// A host-only cookie is never sent to dioreo.app, which is the whole reason the portal is a separate subdomain (spec decision 8) — so there is no `Domain` attribute here, deliberately.
//
// ⚠️ `Secure` IS CONDITIONAL, and it has to be. It was unconditional, which is right for every real deployment and wrong for the one way the dev portal is most often run: over plain HTTP on localhost. Browsers differ on whether they will store a `Secure` cookie on an http://localhost origin, and the ones that refuse produce no error anywhere — the login simply comes back saying the state is invalid, which reads as a server bug. Localhost is a secure context by definition (RFC 6761), so dropping the flag there costs nothing and removes a silent, browser-dependent failure. Anything else keeps it.
function isLocalOrigin(origin) {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(origin);
}

function cookieAttrs(origin, { maxAge } = {}) {
    const parts = ['Path=/', 'HttpOnly', 'SameSite=Lax'];
    if (!isLocalOrigin(origin) || origin.startsWith('https://')) parts.splice(2, 0, 'Secure');
    if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
    return parts;
}

function buildCookie(origin, rawSessionId) {
    return [`${SESSION_COOKIE}=${rawSessionId}`, ...cookieAttrs(origin, { maxAge: SESSION_MAX_AGE })].join('; ');
}

function buildStateCookie(origin, state) {
    return [`${STATE_COOKIE}=${state}`, ...cookieAttrs(origin, { maxAge: 600 })].join('; '); // 10 min to finish login
}

// ⚠️ A CLEAR MUST MATCH THE ATTRIBUTES IT IS CLEARING. A browser only replaces a cookie when the name, path and domain agree; getting `Secure` wrong here leaves the old one in place.
function clearCookie(origin, name) {
    return [`${name}=`, ...cookieAttrs(origin, { maxAge: 0 })].join('; ');
}

function parseCookies(req) {
    const header = req.headers.cookie || '';
    const out = {};
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }
    return out;
}

// A tiny promise-wrapped HTTPS request — no axios/node-fetch dependency for two calls.
function discordRequest({ method, path: reqPath, body, headers }) {
    return new Promise((resolve, reject) => {
        const data = body ? Buffer.from(body) : null;
        const req = https.request({
            hostname: 'discord.com', path: reqPath, method,
            headers: { ...headers, ...(data ? { 'content-length': data.length } : {}) },
        }, (res) => {
            let chunks = '';
            res.on('data', (c) => { chunks += c; });
            res.on('end', () => {
                if (res.statusCode >= 400) return reject(new Error(`Discord API ${reqPath} -> ${res.statusCode}: ${chunks}`));
                try { resolve(JSON.parse(chunks)); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function exchangeCode({ code, clientId, clientSecret, redirectUri }) {
    const body = new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        grant_type: 'authorization_code', code, redirect_uri: redirectUri,
    }).toString();
    return discordRequest({
        method: 'POST', path: '/api/oauth2/token', body,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
}

async function fetchDiscordUser(accessToken) {
    return discordRequest({ method: 'GET', path: '/api/users/@me', headers: { authorization: `Bearer ${accessToken}` } });
}

// 🔴 THE REDIRECT URI FOLLOWS THE REQUEST, NOT `PORTAL_PUBLIC_URL`, AND THE REASON IS A LIVE FAILURE. This built the redirect from the env var alone. Start the flow on http://localhost:8787 while that var names the tunnel and here is what happens: the state cookie is set on the localhost origin, Discord sends the browser to https://dev-portal.dioreo.app/auth/callback, and that origin has never seen the cookie — because it is host-only by design (spec decision 8). The callback then reports "invalid or expired state", which describes a forged request and is exactly wrong: nothing expired and nothing was forged, the two halves of the handshake simply happened on two different hosts.
//
// Deriving both halves from the request makes the cookie and the callback share an origin by construction, so both ways of reaching the dev portal work with no env change between them.
//
// ⚠️ AN ALLOWLIST, NOT A BARE `req.headers.host`. Host is client-controlled; echoing it into an OAuth redirect is how an open redirector gets built. Only origins that are actually registered on the Discord application can appear here, and `PORTAL_PUBLIC_URL` is always one of them.
//
// ⚠️ AND AN UNKNOWN ORIGIN IS REFUSED AT LOGIN, not carried into a handshake that cannot complete. A flow that fails four steps later, on a different host, with a message about state, is the shape of bug that costs an hour; refusing here names the origin to use instead.
function allowedOrigins() {
    const out = [];
    const pub = String(process.env.PORTAL_PUBLIC_URL || '').replace(/\/+$/, '');
    if (pub) out.push(pub);
    // 🔴 THE LOOPBACK ORIGINS ARE OPT-IN, BECAUSE THIS LIST CANNOT SEE WHAT DISCORD HAS REGISTERED. The comment above used to assert that "only origins that are actually registered on the Discord application can appear here", and it was false: these two were pushed unconditionally while the dev application has only the tunnel callback registered. So `/auth/login` on http://127.0.0.1:8787 passed this check, built a loopback redirect_uri, and Discord answered "Invalid OAuth2 redirect_uri" — Harkirat hit exactly that on 2026-08-30 18:2x EDT.
    //
    // 🔴 THIS IS THE UNCLOSED HALF OF THE 2026-08-28 BUG, not a new one. That fix made the redirect follow the REQUEST so the cookie and the callback share an origin, which was right and is untouched. What it left standing is the other precondition: an origin must be allowed here AND registered there, and only the first was ever enforced. An allowlist that is WIDER than the registration turns a legible local refusal into Discord's error page, on a host the reader cannot inspect — the precise shape the refusal below exists to prevent.
    //
    // Set PORTAL_OAUTH_LOOPBACK=1 once http://localhost:<port>/auth/callback and http://127.0.0.1:<port>/auth/callback are both registered on the application. Until then the tunnel is the way in, and the refusal names it.
    if (process.env.PORTAL_OAUTH_LOOPBACK === '1') {
        const port = process.env.PORTAL_PORT || 8787;
        out.push(`http://localhost:${port}`, `http://127.0.0.1:${port}`);
    }
    return [...new Set(out)];
}

function startOAuth(req, res) {
    const origin = originOf(req);
    if (!allowedOrigins().includes(origin)) {
        res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
        const open = allowedOrigins();
        // ⚠️ THE EMPTY CASE IS A CONFIGURATION FAULT, NOT A BAD ORIGIN, and saying "open one of these" followed by nothing is the least useful thing this could print.
        return res.end(`This portal does not sign in on ${origin}.\n\n`
            + (open.length
                ? `Discord only accepts a redirect back to an address registered on the application, and this one is not registered here. Open one of these instead:\n\n`
                    + open.map((o) => `  ${o}`).join('\n') + '\n\n'
                    + `If you meant to sign in over loopback, register http://localhost:${process.env.PORTAL_PORT || 8787}/auth/callback on the Discord application first, then set PORTAL_OAUTH_LOOPBACK=1.\n`
                : `No sign-in origin is configured at all: PORTAL_PUBLIC_URL is unset and PORTAL_OAUTH_LOOPBACK is not 1, so there is no address this portal could ask Discord to redirect back to.\n`));
    }
    const state = randomToken(16);
    const clientId = process.env.DISCORD_OAUTH_CLIENT_ID;
    const redirectUri = `${origin}/auth/callback`;
    res.writeHead(302, { Location: buildAuthorizeUrl({ clientId, redirectUri, state }), 'Set-Cookie': buildStateCookie(origin, state) });
    res.end();
}

async function handleCallback(req, res, url) {
    const cookies = parseCookies(req);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!verifyState(state, cookies[STATE_COOKIE])) {
        // ⚠️ THE MESSAGE NAMES THE CAUSE THAT ACTUALLY HAPPENS. The overwhelmingly common reason this fires is not a forged request or a stale tab — it is a login begun on one origin and finished on another, so the host-only state cookie was never sent here. Saying only "invalid or expired" sends the reader looking for a server fault. Redirect derivation now makes this near-impossible, and if it still fires the first thing worth checking is which address the login started on.
        res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end('Login failed: invalid or expired state.\n\n'
            + `This request arrived on ${originOf(req)}${cookies[STATE_COOKIE] ? '' : ' with no state cookie at all'}, `
            + 'which usually means the sign-in was started on a different address than it finished on. '
            + 'Start again from the address you want to use, and it will complete there.\n');
    }
    const clientId = process.env.DISCORD_OAUTH_CLIENT_ID;
    const clientSecret = process.env.DISCORD_OAUTH_CLIENT_SECRET;
    // The SAME origin the login used — Discord verifies that the exchange repeats the redirect_uri it was given, and the callback necessarily arrives on that host, so reading the request is exact.
    const redirectUri = `${originOf(req)}/auth/callback`;

    let discordId, username, globalName, avatarHash;
    try {
        const token = await exchangeCode({ code, clientId, clientSecret, redirectUri });
        const user = await fetchDiscordUser(token.access_token);
        discordId = user.id;
        // D3 — `username`/`global_name`/`avatar` are ordinary profile fields the `identify` scope already returns; the OAuth token and the raw `user` object still fall out of scope here — no Discord CREDENTIAL is ever persisted, only these three display fields, so the portal's own header can say whose session it is instead of a grey disc (see shell.js's Account/Header).
        username = user.username || '';
        globalName = user.global_name || '';
        avatarHash = user.avatar || null;
    } catch (error) {
        console.error('Portal OAuth exchange failed:', error);
        res.writeHead(502, { 'content-type': 'text/plain' });
        return res.end('Could not complete Discord sign-in.');
    }

    const rawSessionId = randomToken(32);
    await PortalSession.create({
        sessionHash: hashSession(rawSessionId),
        discordId,
        username,
        globalName,
        avatarHash,
        userAgent: (req.headers['user-agent'] || '').slice(0, 300),
    });

    const origin = originOf(req);
    res.writeHead(302, { Location: '/', 'Set-Cookie': [buildCookie(origin, rawSessionId), clearCookie(origin, STATE_COOKIE)] });
    res.end();
}

async function sessionFor(req) {
    const cookies = parseCookies(req);
    const raw = cookies[SESSION_COOKIE];
    if (!raw) return null;
    const sessionHash = hashSession(raw);
    const row = await PortalSession.findOne({ sessionHash }).lean();
    if (!row || row.revokedAt) return null;
    // A full load-then-save on EVERY request (including GETs) just to bump lastSeenAt doubled the Mongo round-trip on the hot path of every portal request (efficiency review). Throttled to only write when the existing value has gone stale, fired without blocking the response.
    if (Date.now() - new Date(row.lastSeenAt).getTime() > 60_000) {
        PortalSession.updateOne({ sessionHash }, { lastSeenAt: new Date() }).catch((e) => console.error('Portal lastSeenAt update failed:', e));
    }
    // createdAt rides along so /auth/csrf can tell the browser when this session expires — the account panel states a fact about the reader rather than restating the 12-hour policy at them. D3 — username/globalName/avatarHash ride along the same way, for the header identity chip (shell.js's Account/Header). Absent on a session created before this field existed; the chip falls back to an initial letter rather than guessing.
    return {
        discordId: row.discordId, sessionId: sessionHash, createdAt: row.createdAt,
        username: row.username || '', globalName: row.globalName || '', avatarHash: row.avatarHash || null,
    };
}

function csrfToken(session) {
    // Derived deterministically from the session hash rather than stored separately — nothing new to persist, and it changes automatically if the session ever does.
    return crypto.createHash('sha256').update(`csrf:${session.sessionId}`).digest('hex');
}

function verifyCsrf(req, session) {
    const header = req.headers['x-csrf-token'];
    if (!header || !session) return false;
    return verifyState(header, csrfToken(session));
}

// The DOOR gate, not a realm gate. Every mutating request additionally needs a valid CSRF token (H10) — checked here so no route can forget it. Each realm's own routes layer their own page/owner/command scope check on top of this.
function requireAdmin(handler) {
    return async (req, res, url) => {
        const session = await sessionFor(req);
        if (!session) return sendJson(res, 401, { error: 'not signed in' });
        if (!(await isAdmin(session.discordId))) return forbidden(res, 'forbidden');
        if (req.method !== 'GET' && !verifyCsrf(req, session)) return forbidden(res, 'missing or invalid CSRF token');
        return handler(req, res, url, session);
    };
}

function registerAuthRoutes(route) {
    route('GET', /^\/auth\/login$/, async (req, res) => startOAuth(req, res));
    route('GET', /^\/auth\/callback$/, handleCallback);
    route('GET', /^\/auth\/csrf$/, requireAdmin(async (req, res, url, session) => {
        // Code review Important #4: the nav rail showed all 5 realms regardless of what the signed-in admin actually holds, unlike this codebase's own established convention (/manage's getManagePages() filters its dropdown the same way). realmAccess.js computes this once so every realm route's own 403 check and the Shell's rail agree on the same list rather than each re-deriving it (simplify Altitude #14-15).
        const { visibleRealms } = require('./api/realmAccess');
        const { SEASON_PAGES } = require('./api/season');
        const { ARMORY_PAGES } = require('./api/armory');
        const { BROADCAST_PAGES } = require('./api/broadcast');
        const owner = isOwner(session.discordId);
        const realms = await visibleRealms(session.discordId, { SEASON_PAGES, ARMORY_PAGES, BROADCAST_PAGES });
        // The deadline is Mongo's own: models/PortalSession.js expires the row SESSION_TTL_SECONDS after createdAt, so this is when the session actually stops working rather than a client-side guess. Null for a row written before createdAt was carried through, which the panel renders as an em dash instead of inventing a countdown.
        const expiresAt = session.createdAt
            ? new Date(new Date(session.createdAt).getTime() + PortalSession.SESSION_TTL_SECONDS * 1000).toISOString()
            : null;
        // 🔴 `destructive` IS NOT A REALM AND MUST NOT BE INFERRED FROM ONE. utils/adminAccess.js keeps it out of `all` on purpose — the owner typing "all" is asking for broad access, not for somebody else to be able to purge the season — so the portal has to ask for it by name. Sent on the session because the one-way strip has to render DISABLED WITH THE REASON for an admin who lacks it, which it cannot do if it does not know.
        const canDestroy = owner || await hasCommandAccess(session.discordId, 'destructive');
        sendJson(res, 200, { csrfToken: csrfToken(session), discordId: session.discordId, username: session.username, globalName: session.globalName, avatarHash: session.avatarHash, isOwner: owner, canDestroy, visibleRealms: realms, sessionExpiresAt: expiresAt });
    }));
    route('POST', /^\/auth\/logout$/, requireAdmin(async (req, res, url, session) => {
        await PortalSession.updateOne({ sessionHash: session.sessionId }, { revokedAt: new Date() });
        res.writeHead(302, { Location: '/', 'Set-Cookie': clearCookie(originOf(req), SESSION_COOKIE) });
        res.end();
    }));
}

module.exports = {
    buildAuthorizeUrl, verifyState, hashSession, buildCookie,
    // Exported for scripts/portalAuth.test.js. The origin-derivation fix shipped without a falsifier for several hours, in a session whose whole subject was checks that do not check — and the bug it fixes (a login begun on one origin and finished on another) is invisible to every gate here and surfaced only when Harkirat hit it. Three pure functions; there was no excuse.
    originOf, allowedOrigins, cookieAttrs, isLocalOrigin,
    startOAuth, handleCallback, sessionFor, requireAdmin, csrfToken, verifyCsrf, registerAuthRoutes,
};
