. "$LAB_LIB"
[ -s total-kb.txt ] || fail "total-kb.txt is missing or empty."
[ "$(tr -d '[:space:]' < total-kb.txt)" = "$(du -sk stuff | cut -f1)" ] || fail "total-kb.txt should hold the size of stuff/ in KB."
