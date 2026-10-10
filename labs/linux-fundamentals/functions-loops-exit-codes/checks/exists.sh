. "$LAB_LIB"
[ -x exists.sh ] || fail "exists.sh must exist and be executable."
./exists.sh sum.sh >/dev/null 2>&1 || fail "./exists.sh sum.sh should exit 0 (sum.sh exists)."
./exists.sh no-such-file-here >/dev/null 2>&1 && fail "./exists.sh no-such-file-here should exit non-zero."
true
