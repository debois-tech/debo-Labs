. "$LAB_LIB"
[ -s lspath.txt ] || fail "lspath.txt is missing or empty."
[ "$(tr -d '[:space:]' < lspath.txt)" = "$(type -P ls)" ] || fail "lspath.txt should hold the full path of ls."
