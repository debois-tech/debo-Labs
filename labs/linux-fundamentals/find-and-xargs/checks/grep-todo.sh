. "$LAB_LIB"
[ -s todo.txt ] || fail "todo.txt is missing or empty."
diff todo.txt <(grep -rl TODO project | sort) >/dev/null || fail "todo.txt should list the files containing TODO, sorted."
