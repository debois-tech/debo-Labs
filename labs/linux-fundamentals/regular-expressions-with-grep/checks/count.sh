. "$LAB_LIB"
[ -s problems.txt ] || fail "problems.txt is missing or empty."
[ "$(tr -d '[:space:]' < problems.txt)" = "$(grep -cE 'ERROR|WARN' server.log)" ] || fail "problems.txt should hold the number of ERROR or WARN lines."
