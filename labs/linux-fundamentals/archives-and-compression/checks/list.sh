. "$LAB_LIB"
[ -s contents.txt ] || fail "contents.txt is missing or empty."
diff <(sort contents.txt) <(tar tzf backup.tar.gz | sort) >/dev/null || fail "contents.txt should be the archive listing."
[ ! -d restore ] || fail "Do not extract yet; just list."
