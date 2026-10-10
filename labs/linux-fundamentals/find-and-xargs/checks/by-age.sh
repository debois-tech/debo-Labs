. "$LAB_LIB"
[ -s old.txt ] || fail "old.txt is missing or empty."
diff <(sort old.txt) <(find project -type f -mtime +30 | sort) >/dev/null || fail "old.txt should list the regular files not modified for over 30 days."
