. "$LAB_LIB"
[ -f greet.sh ] || fail "greet.sh does not exist yet."
[ "$(bash -c 'source ./greet.sh; greet Bob' 2>/dev/null)" = "Hello, Bob!" ] || fail "After sourcing greet.sh, greet Bob should print: Hello, Bob!"
