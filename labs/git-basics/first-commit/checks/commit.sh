. "$LAB_LIB"
c=$(in_repo myrepo rev-list --count HEAD 2>/dev/null)
[ "${c:-0}" -ge 1 ] || fail "No commit yet."
