. "$LAB_LIB"
[ "$(sim '(o => o["report.txt"] && o["docs/notes.md"] ? "yes" : "no")(s.s3.buckets["debo-reports-123456789012"].objects)')" = yes ] || fail "Expected the keys report.txt and docs/notes.md in the bucket."
