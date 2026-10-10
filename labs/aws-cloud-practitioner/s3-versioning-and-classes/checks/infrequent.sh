. "$LAB_LIB"
[ "$(sim '(o => o ? o.versions[0].StorageClass : "none")(s.s3.buckets["debo-archive-123456789012"].objects["archive/plan-v2.txt"])')" = STANDARD_IA ] || fail "archive/plan-v2.txt should be stored as STANDARD_IA."
