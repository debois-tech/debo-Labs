. "$LAB_LIB"
c=$(in_repo proj rev-list --count main..feature 2>/dev/null)
[ "${c:-0}" -ge 1 ] || fail "The feature branch has no commit of its own yet."
