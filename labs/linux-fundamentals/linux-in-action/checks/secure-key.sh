. "$LAB_LIB"
[ -f api.key ] || fail "api.key does not exist."
[ "$(stat -c %a api.key)" = "600" ] || fail "api.key should have mode 600 (rw-------)."
