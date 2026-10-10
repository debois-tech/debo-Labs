. "$LAB_LIB"
[ -f hard.txt ] && [ ! -L hard.txt ] || fail "hard.txt does not exist (or is a symbolic link)."
[ "$(stat -c %i hard.txt)" = "$(stat -c %i original.txt)" ] || fail "hard.txt should share original.txt's inode."
