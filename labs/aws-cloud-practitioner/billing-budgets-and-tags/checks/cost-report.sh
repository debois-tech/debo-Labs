. "$LAB_LIB"
[ -s cost.json ] || fail "cost.json is missing or empty."
jq -e '[.ResultsByTime[].Groups[].Keys[]] | (index("Env$dev") != null) and (index("Env$prod") != null)' cost.json >/dev/null 2>&1 || fail "cost.json should have a group for Env\$dev and one for Env\$prod."
ran_re 'get-cost-and-usage' || fail "Use aws ce get-cost-and-usage."
