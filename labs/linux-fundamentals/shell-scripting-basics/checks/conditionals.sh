. "$LAB_LIB"
[ -f exists.sh ] || fail "exists.sh does not exist yet."
out=$(timeout 3 bash exists.sh /etc/passwd 2>&1)
[ "$out" = "exists" ] || fail "For a file that exists it should print: exists"
out=$(timeout 3 bash exists.sh /no/such/file 2>&1)
[ "$out" = "missing" ] || fail "For a path that does not exist it should print: missing"
