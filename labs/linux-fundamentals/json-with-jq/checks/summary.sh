. "$LAB_LIB"
[ -s summary.json ] || fail "summary.json is missing or empty."
[ "$(jq -S -c . summary.json 2>/dev/null)" = "$(jq -S -c '{count: length, cpu: (map(.cpu) | add)}' servers.json)" ] || fail 'summary.json should be {"count": 4, "cpu": 16}.'
