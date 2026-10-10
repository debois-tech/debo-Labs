. "$LAB_LIB"
[ -s fstype.txt ] || fail "fstype.txt is missing or empty."
[ "$(tr -d '[:space:]' < fstype.txt)" = "$(df --output=fstype / | tail -1 | tr -d '[:space:]')" ] || fail "fstype.txt should hold the file system type of /."
