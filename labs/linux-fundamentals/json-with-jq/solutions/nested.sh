jq -r '.[] | select(.tags.team == "data") | .name' servers.json > data-team.txt
