. "$LAB_LIB"
[ -s logs.txt ] || fail "logs.txt is missing or empty."
diff <(sort logs.txt) <(find project -name '*.log' | sort) >/dev/null || fail "logs.txt should list every .log file under project/."
