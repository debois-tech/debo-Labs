. "$LAB_LIB"
[ -s names.txt ] || fail "names.txt is missing or empty."
cmp -s names.txt <(printf 'a\nb\nc\n') || fail "names.txt should list a, b and c (one per line)."
