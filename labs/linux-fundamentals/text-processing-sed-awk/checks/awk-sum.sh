. "$LAB_LIB"
[ -s total.txt ] || fail "total.txt is missing or empty."
[ "$(tr -d '[:space:]' < total.txt)" = "$(awk '{ s += $NF } END { print s }' access.log)" ] || fail "total.txt should hold the sum of the bytes column."
ran_re 'awk' || fail "Use awk to add the column up."
