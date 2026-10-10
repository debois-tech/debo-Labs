. "$LAB_LIB"
[ -s newest.txt ] || fail "newest.txt is missing or empty."
cmp -s newest.txt <(ls -t files) || fail "newest.txt should list files/ newest first."
