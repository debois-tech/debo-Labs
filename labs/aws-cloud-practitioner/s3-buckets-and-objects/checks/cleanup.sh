. "$LAB_LIB"
[ "$(sim 's.s3.buckets["debo-reports-123456789012"] ? "yes" : "no"')" = no ] || fail "The bucket still exists."
