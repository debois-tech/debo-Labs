. "$LAB_LIB"
[ -d restore/data ] || fail "restore/data does not exist. Extract into restore/."
diff -r data restore/data >/dev/null || fail "restore/data should be identical to data/."
