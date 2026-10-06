. "$LAB_LIB"
[ -f todos.txt ] || fail "todos.txt does not exist yet."
[ "$(wc -l < todos.txt)" -eq 2 ] || fail "There are 2 TODO lines in src/."
! grep -qv TODO todos.txt || fail "todos.txt should only contain TODO lines."
