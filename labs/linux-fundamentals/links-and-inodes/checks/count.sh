. "$LAB_LIB"
[ -s links.txt ] || fail "links.txt is missing or empty."
[ "$(tr -d '[:space:]' < links.txt)" = "$(stat -c %h original.txt 2>/dev/null)" ] || fail "links.txt should hold the current hard link count of original.txt."
ran_re 'stat|ls -l' || fail "Look it up with stat or ls -l."
