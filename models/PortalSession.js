// models/PortalSession.js
//
// ⚠️ PRIVACY: this model carries a per-user Discord ID **and** a device string, which is a category of data this project has never stored before. docs/legal/PRIVACY.md §2 and Appendix A must name it with its own row and a retention answer — docs-audit's privacy-model-coverage exists precisely to catch a new model gaining a discordId without one.
//
// The session id is stored HASHED. The cookie holds the raw value; a database leak must not hand anyone a working session.
const mongoose = require('mongoose');

const PortalSessionSchema = new mongoose.Schema({
    sessionHash: { type: String, required: true, unique: true, index: true },
    discordId: { type: String, required: true, index: true },
    // D3 — the Discord identity fields the OAuth callback already receives (identify scope) and used to discard. Shown in the portal's own header (shell.js's Account/Header) so an admin can tell at a glance which account is signed in, rather than a grey disc and a truncated snowflake. docs/legal/PRIVACY.md §2.1c's Portal session row and Appendix A were updated in the same change these fields were added.
    username: { type: String, default: '' },
    globalName: { type: String, default: '' },
    avatarHash: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    userAgent: { type: String, default: '' },
    revokedAt: { type: Date, default: null }
});

// 12-hour sessions, swept by Mongo itself rather than by anything remembering to run.
//
// ⚠️ EXPORTED, BECAUSE TWO PLACES NOW NEED THE SAME NUMBER. The account panel tells you when this session expires, which it can only do by adding the TTL to `createdAt` — and a second literal `12` in portal/auth.js would be a copy of state that nothing keeps in step, so the panel would keep counting down to a deadline Mongo had stopped using. The index and the countdown read one constant.
const SESSION_TTL_SECONDS = 12 * 60 * 60;
PortalSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: SESSION_TTL_SECONDS });

const PortalSession = mongoose.model('PortalSession', PortalSessionSchema);
PortalSession.SESSION_TTL_SECONDS = SESSION_TTL_SECONDS;
module.exports = PortalSession;
