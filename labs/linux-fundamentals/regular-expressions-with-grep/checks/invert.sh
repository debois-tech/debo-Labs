. "$LAB_LIB"
[ -s quiet.log ] || fail "quiet.log is missing or empty."
cmp -s quiet.log <(grep -v DEBUG server.log) || fail "quiet.log should be server.log without the DEBUG lines."
