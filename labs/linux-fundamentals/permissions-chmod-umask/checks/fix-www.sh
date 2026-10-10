. "$LAB_LIB"
[ -z "$(find www -type f -perm -o+w)" ] || fail "There are still world-writable files under www/."
[ "$(find www -type f | wc -l)" -ge 3 ] || fail "Do not delete files from www/."
