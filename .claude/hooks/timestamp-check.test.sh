#!/bin/bash
# 🔴 THE CLOCK IS PINNED, THE SAME WAY THE HOOK PINS IT — added 2026-09-02 21:56 EDT. Every fixture below is built from `date`, and the hook now resolves "today" in America/New_York regardless of the machine. Left unpinned, this suite computed its placeholders in the runner's UTC while the hook looked for Eastern ones, and 31 of 63 cases failed for a reason that has nothing to do with the behaviour under test. A test and the thing it tests must read the same clock. `TS_TZ` moves both together, so a deliberate probe is still possible.
export TZ="${TS_TZ:-America/New_York}"

# Proofs for timestamp-check.sh, in BOTH modes.
#
# `pre` can now DENY a write, so its false-positive surface is the dangerous one: a wrong deny stops work dead and gets the hook switched off. `post` stays advisory and only has to avoid noise.
#
# Every case below corresponds to something that actually happened, not a hypothetical:
#   · the fabricated-future stamp the old hook passed 30 times in one session
#   · the tomorrow-dated stamp neither old branch even looked at
#   · the backticked stamp that was exempt precisely where the fabrications landed
#   · the line-wrapped timestamp that read as a bare date (this hook did it to its own commit)
#   · the filename / CLI-arg false positives that made the original version noise

HOOK="$(cd "$(dirname "$0")" && pwd)/timestamp-check.sh"
pass=0; fail=0
# ⚠️ DATE AND TIME MUST COME FROM THE SAME SHIFTED INSTANT — CI caught this, 2026-08-02 22:00 UTC. The first version took `$TODAY` from now and `$FUT` from now+3h *independently*. On the Mac (17:00 EDT) that is harmlessly same-day; on the UTC CI runner at 22:00 it produced "today 01:00" — a PAST timestamp — so every "future is denied" case silently asserted the wrong thing and failed. Seven tests, one root cause: two halves of a timestamp read from two different moments.
#
# `when()` shifts once and formats once, on either BSD or GNU date, so the pair can never disagree.
when() { # $1 = offset like '+3H' / '-2H' / '+1d' / '+2M'  -> "YYYY-MM-DD HH:MM"
  date -v"$1" '+%Y-%m-%d %H:%M' 2>/dev/null && return
  local gnu="${1#+}"; gnu="${gnu/H/ hours}"; gnu="${gnu/d/ days}"; gnu="${gnu/M/ minutes}"
  case "$1" in -*) date -d "${gnu#-} ago" '+%Y-%m-%d %H:%M';; *) date -d "$gnu" '+%Y-%m-%d %H:%M';; esac
}
TODAY=$(date +%Y-%m-%d)
LOCALTZ=$(date '+%Z')
FUTSTAMP=$(when '+3H')            # a genuinely future date+time, whatever the zone or hour
PASTSTAMP=$(when '-2H')           # genuinely past, same guarantee
TOMORROWSTAMP="$(when '+1d' | cut -d' ' -f1) 09:00"
# TOLERANCE_SECS in the hook is 180s (3 min). +1M (~60s ahead) sits well inside that grace window — ordinary turn latency, not fabrication. +4M (~240s ahead) sits well past it — a healthy margin on both sides of the boundary so second-level jitter between this script and the hook's own `date` call can't flip either result.
NEARFUTSTAMP=$(when '+1M')        # inside the tolerance window — must NOT deny
FARFUTSTAMP=$(when '+4M')         # past the tolerance window — must still deny

# A hook that decides nothing prints nothing; jq on empty stdin also prints nothing. Catch empty BEFORE jq or every silent case reads as "" and the suite lies about which way it failed.
run() { # $1 = mode, $2 = content -> "deny:<reason>" | "<advisory text>" | "SILENT"
  local o; o=$(printf '{"tool_input":{"content":%s}}' "$(printf '%s' "$2" | jq -Rs .)" | bash "$HOOK" "$1")
  [ -z "$o" ] && { echo SILENT; return; }
  local d; d=$(printf '%s' "$o" | jq -r '.hookSpecificOutput.permissionDecision // empty')
  # ⚠️ THIS PRINTED 'deny:' FOR *ANY* DECISION UNTIL 2026-09-01 19:24 EDT, so a branch that switched from deny to allow would have kept every one of its tests green. That is a vacuous pass by construction: the harness could not express the difference it was being asked to check. It prints the real verb now, and appends the corrected content when the hook returns an updatedInput.
  if [ -n "$d" ]; then printf '%s:%s%s' "$d" "$(printf '%s' "$o" | jq -r '.hookSpecificOutput.permissionDecisionReason')" \
       "$(printf '%s' "$o" | jq -r 'if .hookSpecificOutput.updatedInput then " FIXED<" + (.hookSpecificOutput.updatedInput.content // .hookSpecificOutput.updatedInput.new_string // "") + ">" else "" end')"
  else printf '%s' "$o" | jq -r '.hookSpecificOutput.additionalContext // "SILENT"'; fi; }
# The Bash path, added 2026-09-02 11:42 EDT. `run` sends .tool_input.content; a Bash call carries .tool_input.command instead, and the two travel through DIFFERENT jq branches — the content extractor falls through `new_string // content // command`, while the autofix rewrites every string value in .tool_input. A test that only ever sends `content` cannot see a command-shaped payload break, which is precisely how this gap survived: PostToolUse had covered Bash for weeks and no test ever sent a command.
run_cmd() { # $1 = mode, $2 = command string
  local o; o=$(printf '{"tool_input":{"command":%s,"description":"probe"}}' "$(printf '%s' "$2" | jq -Rs .)" | bash "$HOOK" "$1")
  [ -z "$o" ] && { echo SILENT; return; }
  local d; d=$(printf '%s' "$o" | jq -r '.hookSpecificOutput.permissionDecision // empty')
  if [ -n "$d" ]; then printf '%s:%s%s' "$d" "$(printf '%s' "$o" | jq -r '.hookSpecificOutput.permissionDecisionReason')" \
       "$(printf '%s' "$o" | jq -r 'if .hookSpecificOutput.updatedInput then " FIXED<" + (.hookSpecificOutput.updatedInput.command // "") + ">" else "" end')"
  else printf '%s' "$o" | jq -r '.hookSpecificOutput.additionalContext // "SILENT"'; fi; }
ac() { local n="$1" mode="$2" needle="$3" want="$4" out; out="$(run_cmd "$mode" "$5")"
  case "$out" in *"$needle"*) got=yes;; *) got=no;; esac
  if [ "$got" = "$want" ]; then echo "  PASS  $n"; pass=$((pass+1))
  else echo "  FAIL  $n (wanted $want for '$needle')"; echo "        got: [$out]"; fail=$((fail+1)); fi; }

a() { local n="$1" mode="$2" needle="$3" want="$4" out; out="$(run "$mode" "$5")"
  case "$out" in *"$needle"*) got=yes;; *) got=no;; esac
  if [ "$got" = "$want" ]; then echo "  PASS  $n"; pass=$((pass+1))
  else echo "  FAIL  $n (wanted $want for '$needle')"; echo "        got: [$out]"; fail=$((fail+1)); fi; }

echo "timestamp-check.sh — proofs"

echo "  -- pre mode: DENIES the impossible, blocks nothing else --"
a "future time today denied"        pre "deny:"             yes "Measured $FUTSTAMP $LOCALTZ during the run."
a "TOMORROW's stamp denied"         pre "deny:"             yes "Filed $TOMORROWSTAMP $LOCALTZ."
a "future stamp in BACKTICKS denied" pre "deny:"            yes "Shipped \`$FUTSTAMP $LOCALTZ\` per the log."
a "past time not denied"            pre "deny:"             no  "Measured $PASTSTAMP $LOCALTZ during the run."
a "just-inside tolerance not denied" pre "deny:"            no  "Filed $NEARFUTSTAMP $LOCALTZ during the run."
a "just-outside tolerance denied"    pre "deny:"            yes "Filed $FARFUTSTAMP $LOCALTZ during the run."
a "bare date never denied"          pre "deny:"             no  "Corrected on $TODAY after review."
a "TS-EXAMPLE line is exempt"       pre "deny:"             no  "Illustration only: $TOMORROWSTAMP $LOCALTZ (TS-EXAMPLE)."
# A REAL scheduled deadline carries a clock time on purpose — the window closes at an hour, not on a day — so "write it without a time" is not available. Added after this gate refused an edit that merely touched the line holding the MCP observation-window close-out.
a "TS-DEADLINE line is exempt"      pre "deny:"             no  "CLOSE OUT the window: $TOMORROWSTAMP $LOCALTZ (TS-DEADLINE)."
a "an UNMARKED future deadline still denies" pre "deny:"     yes "CLOSE OUT the window: $TOMORROWSTAMP $LOCALTZ."
a "undated content not denied"      pre "deny:"             no  "Ordinary prose with no dates at all."
a "a future DATE alone is allowed"  pre "deny:"             no  "Deadline: ${TOMORROWSTAMP%% *} — no clock time, deliberately."

echo "  -- post mode: advisory only --"
a "'on DATE' is prose, now silent" post "BARE DATE"        no  "Corrected on $TODAY after review."
a "past timestamp silent"           post "TIMESTAMP CHECK"  no  "Measured $PASTSTAMP $LOCALTZ during the run."
a "date-prefixed FILENAME silent"   post "TIMESTAMP CHECK"  no  "See docs/specs/$TODAY-some-protocol.md for detail."
a "CLI date argument silent"        post "TIMESTAMP CHECK"  no  "Run: node x.mjs --from $TODAY --to $TODAY-x"
a "backticked bare date silent"     post "TIMESTAMP CHECK"  no  "The window is \`$TODAY\` in the config."
a "undated content silent"          post "TIMESTAMP CHECK"  no  "Just some ordinary prose with no dates."
a "future still reported in post"   post "IMPOSSIBLE"       yes "Measured $FUTSTAMP $LOCALTZ during the run."

echo "  -- BARE DATE precision: prose names a day, a record stamps a moment --"
# Measured on 164 real lines added to main on 2026-08-02: the old rule fired 22 times and was right 4 times (18%). Every one of these suppressions is a shape that actually appeared in that corpus.
a "prose 'on DATE' silent"          post "BARE DATE" no  "Three separate times on $TODAY I passed the wrong flag."
a "prose 'from DATE' silent"        post "BARE DATE" no  "MEASURED from $TODAY, and this day counts."
a "article 'a DATE session' silent" post "BARE DATE" no  "A $TODAY session handoff asserted it was deleted."
# ⚠️ Only the word IMMEDIATELY before the date is examined, so "the actual DATE" is NOT
#    suppressed by the article. That is deliberate — widening it to "article + any adjective"
#    starts guessing at grammar. The real corpus line was QUOTED, and the quote strip is what
#    handles it; the case below pins that, and this one pins the deliberate limit.
a "'the ADJ DATE' still fires"     post "BARE DATE" yes "the actual $TODAY failure blocks on this."
a "prose 'by DATE' silent"          post "BARE DATE" no  "It had all landed by $TODAY without anyone noticing."
# A range BOUND is a date, not a moment — a clock time there would be wrong, not merely verbose.
a "range with arrow silent"         post "BARE DATE" no  "Baseline — control window 2026-07-24 → $TODAY"
a "range, date on the left, silent" post "BARE DATE" no  "The window is $TODAY → 2026-08-10 (exclusive)."
# A date inside a string literal is data, not a record.
a "date in a quoted literal silent" post "BARE DATE" no  "assert \"the actual $TODAY failure blocks\" block"
# An ENUMERATION of dates is data too. Added 2026-08-02 23:10 EDT after the branch fired on exactly this sentence, in a memory file being edited to explain the rule — a shape absent from the 164-line corpus the "100% precision" figure was measured on. The test is a comma adjacent to ANOTHER date, never a bare trailing comma: a stamp followed by a comma is still a stamp (see below), and a first attempt using [,;] alone would have silenced that while not even matching the list.
a "date list, today last, silent"   post "BARE DATE" no  "caught in three sessions (2026-07-24, 2026-07-26, $TODAY), each time"
a "date list, today first, silent"  post "BARE DATE" no  "sessions $TODAY, 2026-07-26 and 2026-07-24 all repeated it."
a "stamp + comma still fires"       post "BARE DATE" yes "A reasonable question, asked $TODAY, and nobody answered."
# …and the shapes that MUST still fire: these are record stamps missing their time.
a "'(added DATE)' still fires"      post "BARE DATE" yes "## Licence & attribution gates (added $TODAY)"
a "'UPDATED DATE:' still fires"     post "BARE DATE" yes "PATH UPDATED $TODAY: the spreadsheet moved out of the repo root."
a "'asked DATE:' still fires"       post "BARE DATE" yes "A reasonable question, asked $TODAY: where do these live?"
a "bare prose date alone fires"     post "BARE DATE" yes "Corrected $TODAY after review."

echo "  -- foreign timezones are out of scope, not violations --"
# A stamp in a zone that is NOT the local one cannot be compared against the local clock without conversion, so it is skipped. This gate denied a legitimate UTC stamp on 2026-08-02 17:21 EDT while documenting a CI run, and GitHub API times are always UTC — it would have recurred constantly. ⚠️ The label must be a zone the machine is NOT in, or the case proves nothing. CI runs in UTC and the Mac in EDT, so pick whichever the local zone is not.
if [ "$LOCALTZ" = "UTC" ]; then FOREIGNTZ=EST; else FOREIGNTZ=UTC; fi
a "explicit foreign TZ is skipped"  pre "deny:" no  "The run finished $FUTSTAMP $FOREIGNTZ per the API."
# …but the LOCAL zone spelled out must still be judged, or the escape swallows everything.
a "explicit LOCAL tz still denied"  pre "deny:" yes "Measured $FUTSTAMP $LOCALTZ during the run."
a "no timezone at all still denied" pre "deny:" yes "Measured $FUTSTAMP during the run."

echo "  -- placeholder time: a date paired with a fake HH:MM (2026-08-03 mishap) --"
# The actual incident: a real date, but "xx" standing in for the minute, meant to be filled in later. 🔴 THESE THREE ASSERTED "deny:" AND WOULD HAVE PASSED EITHER WAY until run() learned to print the real verb, one line up. They assert the SUBSTITUTION now: the write is allowed, and the content that reaches disk carries the current clock instead of the digit slot.
a "'HH:xx' placeholder fixed"       pre "allow:"       yes "root-caused live $TODAY 18:xx EDT the glitch"
a "'XX:XX' placeholder fixed"       pre "allow:"       yes "filed $TODAY XX:XX EDT for review"
a "'??:??' placeholder fixed"       pre "allow:"       yes "queued $TODAY ??:?? EDT pending confirmation"
# The value substituted is the REAL current time, not merely *a* time — without this the branch could write a constant and still pass every case above.
a "substitution uses the clock"     pre "FIXED<root-caused live $TODAY $(date "+%H:%M") EDT the glitch>" yes "root-caused live $TODAY 18:xx EDT the glitch"
# 🔴 THE FALLBACK MUST STAY REACHABLE, and no CONTENT can reach it — the detector and the substitution share one pattern, so every placeholder that is found is one that can be repaired. My first attempt at this case used a second, weirder placeholder and it was simply fixed too. The deny path exists for the day `updatedInput` stops being honoured, so the seam that simulates that day is what the test drives. A branch no test can enter is a branch that rots.
fb=$(printf '{"tool_input":{"content":%s}}' "$(printf 'shipped %s 18:xx EDT' "$TODAY" | jq -Rs .)" \
     | TS_NO_AUTOFIX=1 bash "$HOOK" pre | jq -r '.hookSpecificOutput.permissionDecision')
if [ "$fb" = "deny" ]; then echo "  PASS  fallback denies when updatedInput is unavailable"; pass=$((pass+1))
else echo "  FAIL  fallback denies when updatedInput is unavailable (got '$fb')"; fail=$((fail+1)); fi
a "a REAL timestamp is not caught"  pre "deny:"        no  "filed $PASTSTAMP $LOCALTZ for review"
# The project's own literal format spec must never be flagged as a fake instance -- h/H is deliberately excluded from the placeholder character set for exactly this reason.
a "'HH:MM' format spec not caught" pre "deny:"        no  "dated content carries YYYY-MM-DD HH:MM TZ"
a "TS-EXAMPLE placeholder exempt"   pre "deny:"        no  "example: $TODAY 18:xx EDT (TS-EXAMPLE)"
a "placeholder reported in post"    post "PLACEHOLDER" yes "root-caused live $TODAY 18:xx EDT the glitch"

echo "  -- the line-wrap false positive (defect 4) --"
# A timestamp split across a wrapped comment must NOT read as a bare date. This is verbatim the shape that fired while writing main-push-guard.test.sh.
a "wrapped stamp is not a bare date" post "BARE DATE" no "$(printf '# it shipped %s\n# %s '"$LOCALTZ"' with no test\n' "${PASTSTAMP%% *}" "${PASTSTAMP##* }")"
a "wrapped stamp in prose too"       post "BARE DATE" no "$(printf 'filed %s\n%s %s\n' "${PASTSTAMP%% *}" "${PASTSTAMP##* }" "$LOCALTZ")"
# …and a wrapped FUTURE stamp must still be caught, not hidden by the rejoin.
a "wrapped future stamp still denied" pre "deny:" yes "$(printf '# filed %s\n# %s %s\n' "${FUTSTAMP%% *}" "${FUTSTAMP##* }" "$LOCALTZ")"

# ── the code review's repro: one line carrying BOTH ────────────────────────── Found 2026-09-02 18:23 EDT. The detector was scoped to today and the SUBSTITUTION was not, so a line with today's placeholder AND a correct historical stamp was auto-allowed with the HISTORICAL one rewritten to the current minute. Two descriptions of the same target, drifting apart.
a "a historical stamp beside today's placeholder is untouched" pre "2026-08-03 18:12" yes "filed ${TODAY} 18:xx ${LOCALTZ} — see the 2026-08-03 18:12 ${LOCALTZ} incident"
a "and today's placeholder in that same line IS fixed"         pre "FIXED<filed ${TODAY} $(date '+%H:%M')" yes "filed ${TODAY} 18:xx ${LOCALTZ} — see the 2026-08-03 18:12 ${LOCALTZ} incident"
# The character class [0-9xX?] matches real digits, so the pattern must also refuse a CORRECT stamp. 00:01, not 09:30 (2026-09-06 09:02 EDT): a fixed clock time on TODAY is in the FUTURE for anyone running the suite before it, and the hook then correctly DENIES it — this case failed at 09:01 while the hook was right. A minute past midnight is in the past on every run of the day.
a "a correct stamp for TODAY is left alone"                    pre "SILENT" yes "filed ${TODAY} 00:01 ${LOCALTZ}"

# ── a placeholder on a PAST date is DELIBERATE, not forgotten ──────────────── Added 2026-09-02 16:58 EDT. The suite passed 57/57 with this narrowing already in place, which is precisely the problem: nothing exercised it, so the branch was a claim rather than a check. A stamp like `2026-09-01 16:0x EDT` is an intentionally imprecise historical reference and this repo is full of them -- four in memory-index-check.sh alone. Substituting there does not repair anything; it INVENTS a precise time for a past event, which is the exact fabrication this whole file exists to prevent, committed by the fix instead of the author.
YESTERDAY=$(when '-1d' | cut -d' ' -f1)
a "a placeholder on a PAST date is left alone"  pre "SILENT" yes "filed ${YESTERDAY} 16:0x ${LOCALTZ}"
a "a placeholder on TODAY is still corrected"   pre "allow:" yes "filed ${TODAY} 16:0x ${LOCALTZ}"
# And the correction must still put a real minute in, or the branch above is passing for the wrong reason.
a "the today correction carries a real minute"  pre "FIXED<filed ${TODAY} $(date '+%H:%M')" yes "filed ${TODAY} 16:0x ${LOCALTZ}"

# ── the Bash / heredoc path ────────────────────────────────────────────────── The gap that leaked four placeholder stamps into a tracked plan on 2026-09-01: PostToolUse carried Bash and PreToolUse did not, so a heredoc write was DETECTED and never CORRECTED.
HEREDOC="python3 - <<'EOF'
open('x.md','w').write('filed ${TODAY} 19:xx EDT')
EOF"
ac "heredoc placeholder is CORRECTED, not denied" pre "allow:"            yes "$HEREDOC"
ac "heredoc correction carries updatedInput"      pre "FIXED<"            yes "$HEREDOC"
ac "the substituted command holds the real minute" pre "${TODAY} $(date '+%H:%M')" yes "$HEREDOC"
ac "the rest of the command survives intact"      pre "python3 - <<'EOF'" yes "$HEREDOC"
# The deny tier must still reach a command — an impossible stamp is not autofixable and must stop.
ac "future stamp in a command is DENIED"          pre "deny:"             yes "echo 'shipped ${FARFUTSTAMP} ${LOCALTZ}'"
# And the overwhelming majority of Bash calls must pass through untouched, or this becomes noise on every single command.
ac "an ordinary command is silent"                pre "SILENT"            yes "git status --porcelain"
ac "a command with a REAL stamp is silent"        pre "SILENT"            yes "echo 'done ${PASTSTAMP} ${LOCALTZ}'"
# The capability-regression seam must still work on this path.
out_seam=$(printf '{"tool_input":{"command":%s}}' "$(printf '%s' "$HEREDOC" | jq -Rs .)" | TS_NO_AUTOFIX=1 bash "$HOOK" pre | jq -r '.hookSpecificOutput.permissionDecision')
if [ "$out_seam" = deny ]; then echo "  PASS  TS_NO_AUTOFIX falls back to deny on the command path"; pass=$((pass+1));
else echo "  FAIL  TS_NO_AUTOFIX falls back to deny on the command path (got [$out_seam])"; fail=$((fail+1)); fi

echo; echo "  $pass passed, $fail failed"; [ "$fail" -eq 0 ] || exit 1
