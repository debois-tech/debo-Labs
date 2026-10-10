. "$LAB_LIB"
[ -s cities.txt ] || fail "cities.txt is missing or empty."
cmp -s cities.txt <(awk -F, 'NR > 1 { print $3 }' users.csv) || fail "cities.txt should hold the city of every user, one per line, without the header."
