. "$LAB_LIB"
[ -s past.txt ] || fail "past.txt is missing or empty."
[ "$(tr -d '[:space:]' < past.txt)" = "$(date -d '10 days ago' +%F)" ] || fail "past.txt should hold the date 10 days ago."
