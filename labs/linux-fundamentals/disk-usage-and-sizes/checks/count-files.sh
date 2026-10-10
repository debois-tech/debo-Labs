. "$LAB_LIB"
[ -s nfiles.txt ] || fail "nfiles.txt is missing or empty."
[ "$(tr -d '[:space:]' < nfiles.txt)" = "$(find stuff -type f | wc -l | tr -d '[:space:]')" ] || fail "nfiles.txt should hold the number of regular files."
