. "$LAB_LIB"
[ -s seen.txt ] || fail "seen.txt is missing or empty."
cmp -s seen.txt <(./noisy.sh 2>/dev/null) || fail "seen.txt should hold the stdout lines."
ran_re 'tee' || fail "Use tee."
