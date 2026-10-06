. "$LAB_LIB"
[ -f countdown.sh ] || fail "countdown.sh does not exist yet."
out=$(timeout 3 bash countdown.sh 2>&1)
[ "$out" = "$(printf "3\n2\n1\nLiftoff!")" ] || fail "It should print 3, 2, 1 on separate lines, then Liftoff!"
