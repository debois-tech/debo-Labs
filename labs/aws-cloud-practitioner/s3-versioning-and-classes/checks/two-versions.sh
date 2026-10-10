. "$LAB_LIB"
[ "$(sim '(o => o ? o.versions.filter(v => !v.deleteMarker).length >= 2 ? "yes" : "no" : "no")(s.s3.buckets["debo-archive-123456789012"].objects["plan.txt"])')" = yes ] || fail "plan.txt needs at least two versions in the bucket."
grep -q v2 plan.txt || fail "Change plan.txt before uploading the second version."
