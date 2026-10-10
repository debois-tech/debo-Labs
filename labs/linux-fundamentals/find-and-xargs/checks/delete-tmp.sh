. "$LAB_LIB"
[ -z "$(find project -name '*.tmp')" ] || fail "There are still .tmp files under project/."
[ -f project/src/main.txt ] && [ -f project/logs/app.log ] && [ -f project/data/huge.dat ] || fail "You deleted something that was not a .tmp file."
