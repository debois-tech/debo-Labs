jq '{count: length, cpu: (map(.cpu) | add)}' servers.json > summary.json
