. "$LAB_LIB"
[ -f errors.txt ] || fail "errors.txt does not exist yet."
[ "$(wc -l < errors.txt)" -eq 3 ] || fail "errors.txt should hold exactly the 3 ERROR lines."
! grep -qv ERROR errors.txt || fail "errors.txt contains lines that are not ERROR lines."
