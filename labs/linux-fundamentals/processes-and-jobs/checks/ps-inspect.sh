. "$LAB_LIB"
[ -s status.txt ] || fail "status.txt is missing or empty."
grep -q 'worker.sh' status.txt || fail "status.txt should show the worker.sh command."
ran_re 'ps ' || fail "Use ps to look at the process."
