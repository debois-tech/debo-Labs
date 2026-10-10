cat > servers.json <<'EOP'
[
  {"name": "web-1",   "region": "ap-south-1", "cpu": 2, "tags": {"env": "prod", "team": "web"}},
  {"name": "web-2",   "region": "ap-south-1", "cpu": 4, "tags": {"env": "prod", "team": "web"}},
  {"name": "db-1",    "region": "eu-west-1",  "cpu": 8, "tags": {"env": "prod", "team": "data"}},
  {"name": "batch-1", "region": "eu-west-1",  "cpu": 2, "tags": {"env": "dev",  "team": "data"}}
]
EOP
