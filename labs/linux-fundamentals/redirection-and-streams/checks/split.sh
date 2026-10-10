. "$LAB_LIB"
[ -s out.txt ] && [ -s err.txt ] || fail "Both out.txt and err.txt should exist and have content."
cmp -s out.txt <(./noisy.sh 2>/dev/null) || fail "out.txt should hold only the stdout lines."
cmp -s err.txt <(./noisy.sh 2>&1 >/dev/null) || fail "err.txt should hold only the stderr lines."
