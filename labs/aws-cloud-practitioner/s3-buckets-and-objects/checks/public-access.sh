. "$LAB_LIB"
[ -s bpa.txt ] || fail "bpa.txt is missing or empty."
[ "$(tr -d '[:space:]' < bpa.txt | tr 'A-Z' 'a-z')" = "$(aws s3api get-public-access-block --bucket debo-reports-123456789012 --query 'PublicAccessBlockConfiguration.BlockPublicPolicy' --output text 2>/dev/null | tr 'A-Z' 'a-z')" ] || fail "bpa.txt should hold the BlockPublicPolicy value."
