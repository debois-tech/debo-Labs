. "$LAB_LIB"
[ -s sizes.txt ] || fail "sizes.txt is missing or empty."
cmp -s sizes.txt <(du -h stuff/* | sort -h) || fail "sizes.txt should be du -h stuff/* sorted with sort -h."
