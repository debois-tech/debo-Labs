. "$LAB_LIB"
[ "$(sim '(v => v && !v[0].deleteMarker && v.filter(x => x.deleteMarker).length === 0 && v.length >= 2 ? "yes" : "no")((s.s3.buckets["debo-archive-123456789012"].objects["plan.txt"] || {}).versions)')" = yes ] || fail "plan.txt should be visible again with both versions kept."
