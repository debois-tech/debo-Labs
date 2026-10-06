. "$LAB_LIB"
[ "$(stat -c %a secret.txt)" = "600" ] || fail "secret.txt should be mode 600 (rw-------)."
