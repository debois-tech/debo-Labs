. "$LAB_LIB"
[ "$(tr -d '[:space:]' < out.txt 2>/dev/null)" = staging ] || fail "out.txt should contain staging (the script prints the exported APP_ENV)."
ran_re 'export' || fail "Use export so the child program can see the variable."
