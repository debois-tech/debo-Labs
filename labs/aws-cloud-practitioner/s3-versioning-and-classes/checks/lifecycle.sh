. "$LAB_LIB"
[ "$(sim '(c => c && c.Rules[0].Transitions.some(t => t.StorageClass === "STANDARD_IA" && Number(t.Days) >= 30) && c.Rules[0].Transitions.some(t => t.StorageClass === "GLACIER") ? "yes" : "no")(s.s3.buckets["debo-archive-123456789012"].lifecycle)')" = yes ] || fail "Apply a valid lifecycle rule to the bucket."
