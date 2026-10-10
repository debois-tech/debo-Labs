. "$LAB_LIB"
[ "$(sim 's.s3.buckets["debo-reports-123456789012"] ? "yes" : "no"')" = yes ] || fail "The bucket debo-reports-123456789012 does not exist yet."
