. "$LAB_LIB"
[ -s big.txt ] || fail "big.txt is missing or empty."
diff <(sort big.txt) <(find project -type f -size +100k | sort) >/dev/null || fail "big.txt should list the regular files over 100 KB."
