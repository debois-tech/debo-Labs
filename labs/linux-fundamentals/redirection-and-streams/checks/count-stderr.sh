. "$LAB_LIB"
[ -s errcount.txt ] || fail "errcount.txt is missing or empty."
[ "$(tr -d '[:space:]' < errcount.txt)" = "$(./noisy.sh 2>&1 >/dev/null | wc -l | tr -d '[:space:]')" ] || fail "errcount.txt should hold the number of stderr lines."
