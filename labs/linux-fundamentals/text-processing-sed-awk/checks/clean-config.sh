. "$LAB_LIB"
[ -s clean.conf ] || fail "clean.conf is missing or empty."
cmp -s clean.conf <(grep -v '^#' config.conf | grep -v '^$') || fail "clean.conf should have no comment lines and no empty lines."
