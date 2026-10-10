jq 'map(select(.region == "ap-south-1"))' servers.json > mumbai.json
