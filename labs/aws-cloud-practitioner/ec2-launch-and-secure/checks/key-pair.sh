. "$LAB_LIB"
[ "$(sim 's.ec2.keyPairs["debo-key"] ? "yes" : "no"')" = yes ] || fail "The key pair debo-key does not exist yet."
head -1 debo-key.pem 2>/dev/null | grep -q 'BEGIN RSA PRIVATE KEY' || fail "debo-key.pem should hold the private key."
[ "$(stat -c %a debo-key.pem)" = "400" ] || fail "debo-key.pem should have mode 400."
