. "$LAB_LIB"
[ -s cpu.txt ] || fail "cpu.txt is missing or empty."
[ "$(tr -d '[:space:]' < cpu.txt)" = "$(jq 'map(.cpu) | add' servers.json)" ] || fail "cpu.txt should hold the total CPU count."
