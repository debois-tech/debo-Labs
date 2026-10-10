. "$LAB_LIB"
[ -L soft.txt ] || fail "soft.txt is not a symbolic link."
[ "$(readlink soft.txt)" = original.txt ] || fail "soft.txt should point at original.txt."
