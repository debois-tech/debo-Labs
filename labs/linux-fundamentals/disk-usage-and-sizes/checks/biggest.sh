. "$LAB_LIB"
[ -s biggest.txt ] || fail "biggest.txt is missing or empty."
[ "$(tr -d '[:space:]' < biggest.txt)" = "$(find stuff -type f -printf '%s %p\n' | sort -rn | head -1 | cut -d' ' -f2)" ] || fail "biggest.txt should hold the path of the largest file."
