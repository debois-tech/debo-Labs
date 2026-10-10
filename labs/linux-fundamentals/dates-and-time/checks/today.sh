. "$LAB_LIB"
[ -s today.txt ] || fail "today.txt is missing or empty."
[ "$(tr -d '[:space:]' < today.txt)" = "$(date +%F)" ] || fail "today.txt should hold today's date as YYYY-MM-DD."
