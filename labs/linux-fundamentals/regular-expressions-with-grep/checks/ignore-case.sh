. "$LAB_LIB"
[ -s timeouts.log ] || fail "timeouts.log is missing or empty."
cmp -s timeouts.log <(grep -i timeout server.log) || fail "timeouts.log should hold every line with timeout in any case."
