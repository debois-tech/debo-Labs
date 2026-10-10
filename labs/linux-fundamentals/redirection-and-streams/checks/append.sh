. "$LAB_LIB"
[ -s log.txt ] || fail "log.txt is missing or empty."
cmp -s log.txt <(./noisy.sh 2>/dev/null; ./noisy.sh 2>/dev/null) || fail "log.txt should hold the stdout lines exactly twice."
