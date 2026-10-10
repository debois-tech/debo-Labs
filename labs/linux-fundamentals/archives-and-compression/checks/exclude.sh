. "$LAB_LIB"
[ -s lean.tar.gz ] || fail "lean.tar.gz does not exist yet."
tar tzf lean.tar.gz 2>/dev/null | grep -q 'notes.txt' || fail "lean.tar.gz should still contain the other files."
tar tzf lean.tar.gz | grep -q '\.log$' && fail "lean.tar.gz must not contain .log files."
true
