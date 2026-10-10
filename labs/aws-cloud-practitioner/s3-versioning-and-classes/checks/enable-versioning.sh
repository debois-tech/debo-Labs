. "$LAB_LIB"
[ "$(sim 's.s3.buckets["debo-archive-123456789012"].versioning')" = Enabled ] || fail "Versioning is not enabled on the bucket yet."
