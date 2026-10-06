. "$LAB_LIB"
c=$(in_repo myrepo rev-list --count HEAD 2>/dev/null)
[ "${c:-0}" -ge 2 ] || fail "You need a second commit."
