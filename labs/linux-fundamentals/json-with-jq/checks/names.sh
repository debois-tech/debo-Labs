. "$LAB_LIB"
[ -s names.txt ] || fail "names.txt is missing or empty."
cmp -s names.txt <(jq -r '.[].name' servers.json) || fail "names.txt should list every server name, one per line, without quotes."
