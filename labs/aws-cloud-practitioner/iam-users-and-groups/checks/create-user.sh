. "$LAB_LIB"
[ "$(sim 's.iam.users["dev-alice"] ? "yes" : "no"')" = yes ] || fail "There is no user named dev-alice yet."
