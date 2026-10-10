. "$LAB_LIB"
[ -s mumbai.json ] || fail "mumbai.json is missing or empty."
[ "$(jq -S -c . mumbai.json 2>/dev/null)" = "$(jq -S -c 'map(select(.region == "ap-south-1"))' servers.json)" ] || fail "mumbai.json should be a JSON array of the ap-south-1 servers."
