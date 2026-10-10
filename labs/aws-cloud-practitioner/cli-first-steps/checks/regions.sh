. "$LAB_LIB"
[ -s regions.txt ] || fail "regions.txt is missing or empty."
diff <(sort regions.txt) <(aws ec2 describe-regions --query 'Regions[].RegionName' --output text 2>/dev/null | tr '\t' '\n' | sort) >/dev/null || fail "regions.txt should list every Region name, one per line."
