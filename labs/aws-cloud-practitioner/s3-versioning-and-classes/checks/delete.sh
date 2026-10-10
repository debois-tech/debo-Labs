. "$LAB_LIB"
[ "$(sim '(v => v && v[0].deleteMarker && v.length >= 3 ? "yes" : "no")((s.s3.buckets["debo-archive-123456789012"].objects["plan.txt"] || {}).versions)')" = yes ] || fail "plan.txt should now be hidden behind a delete marker."
