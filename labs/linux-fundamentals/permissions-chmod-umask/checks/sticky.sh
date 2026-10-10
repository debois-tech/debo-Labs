. "$LAB_LIB"
[ "$(stat -c %a dropbox)" = 1777 ] || fail "dropbox/ should have mode 1777 (rwxrwxrwt)."
