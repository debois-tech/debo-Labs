. "$LAB_LIB"
[ "$(stat -c %a shared)" = 2775 ] || fail "shared/ should have mode 2775 (rwxrwsr-x)."
