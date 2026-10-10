. "$LAB_LIB"
[ -s all.txt ] || fail "all.txt is missing or empty."
cmp -s all.txt <(./noisy.sh 2>&1) || fail "all.txt should hold stdout and stderr together, in order."
