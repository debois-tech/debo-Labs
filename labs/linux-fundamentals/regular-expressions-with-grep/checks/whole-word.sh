. "$LAB_LIB"
[ -s fail.log ] || fail "fail.log is missing or empty."
cmp -s fail.log <(grep -w fail server.log) || fail "fail.log should hold only the lines with the whole word fail."
