. "$LAB_LIB"
[ -s data-team.txt ] || fail "data-team.txt is missing or empty."
cmp -s data-team.txt <(jq -r '.[] | select(.tags.team == "data") | .name' servers.json) || fail "data-team.txt should list the data team's servers."
