. "$LAB_LIB"
[ "$(tr -d '[:space:]' < count.txt 2>/dev/null)" = "3" ] || fail "count.txt should contain just the number of ERROR lines."
