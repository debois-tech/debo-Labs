. "$LAB_LIB"
[ "$(sim 's.iam.groups["developers"] ? "yes" : "no"')" = yes ] || fail "There is no group named developers yet."
