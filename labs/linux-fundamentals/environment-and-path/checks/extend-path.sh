. "$LAB_LIB"
[ "$(cat hello.out 2>/dev/null)" = "hello from bin" ] || fail "hello.out should hold the output of hello-tool."
ran_re 'PATH=' || fail "Extend the PATH variable first."
