. "$LAB_LIB"
[ -f proj/draft.txt ] || fail "draft.txt must stay on disk."
! in_repo proj diff --cached --name-only | grep -qx draft.txt || fail "draft.txt is still staged."
