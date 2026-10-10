. "$LAB_LIB"
[ -s top3.txt ] || fail "top3.txt is missing or empty."
diff <(awk '{ print $1, $2 }' top3.txt) <(awk '{ print $1 }' access.log | sort | uniq -c | sort -rn | head -3 | awk '{ print $1, $2 }') >/dev/null || fail "top3.txt should list the 3 busiest IPs as '<count> <ip>', busiest first."
