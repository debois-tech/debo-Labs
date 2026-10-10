. "$LAB_LIB"
[ -s app-fixed.log ] || fail "app-fixed.log is missing or empty."
cmp -s app-fixed.log <(sed 's/ERROR/FAILED/g' app.log) || fail "app-fixed.log should be app.log with every ERROR replaced by FAILED."
grep -q ERROR app.log || fail "Do not change app.log itself."
