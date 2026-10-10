. "$LAB_LIB"
[ -s count.txt ] || fail "count.txt is missing or empty."
[ "$(tr -d '[:space:]' < count.txt)" = "$(aws s3api list-objects-v2 --bucket debo-reports-123456789012 --query 'length(Contents)' --output text 2>/dev/null)" ] || fail "count.txt should hold the number of objects in the bucket."
