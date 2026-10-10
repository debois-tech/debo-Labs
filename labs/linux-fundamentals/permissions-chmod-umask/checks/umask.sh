. "$LAB_LIB"
grep -q '^Umask:[[:space:]]*0027' "/proc/$LAB_SHELL_PID/status" || fail "Set the umask of your shell to 027."
[ "$(stat -c %a private.txt 2>/dev/null)" = 640 ] || fail "Create private.txt after setting the umask; its mode should be 640."
