. "$LAB_LIB"
[ -s epoch.txt ] || fail "epoch.txt is missing or empty."
[ "$(tr -d '[:space:]' < epoch.txt)" = "$(date -u -d '2026-01-01 00:00:00' +%s)" ] || fail "epoch.txt should hold the epoch seconds of 2026-01-01 00:00:00 UTC."
