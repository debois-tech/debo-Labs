. "$LAB_LIB"
[ -d logs ] || fail "The logs/ directory does not exist yet."
[ -f config.env ] || fail "config.env does not exist yet."
cmp -s config.sample config.env || fail "config.env should be a copy of config.sample."
