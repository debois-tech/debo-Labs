. "$LAB_LIB"
[ ! -e proj/oops.txt ] || fail "oops.txt is still in the project."
[ "$(in_repo proj rev-list --count HEAD)" -eq 4 ] || fail "Use git revert so history gets a new commit (4 total)."
in_repo proj log -1 --format=%s | grep -q '^Revert' || fail "The newest commit should be a Revert commit."
