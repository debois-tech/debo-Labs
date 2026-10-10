. "$LAB_LIB"
[ -s inode.txt ] || fail "inode.txt is missing or empty."
[ "$(tr -d '[:space:]' < inode.txt)" = "$(stat -c %i hard.txt 2>/dev/null)" ] || fail "inode.txt should hold hard.txt's inode number."
