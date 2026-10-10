. "$LAB_LIB"
[ -s az-count.txt ] || fail "az-count.txt is missing or empty."
[ "$(tr -d '[:space:]' < az-count.txt)" = "$(aws ec2 describe-availability-zones --query 'length(AvailabilityZones)' --output text 2>/dev/null)" ] || fail "az-count.txt should hold the number of zones in ap-south-1."
ran_re 'describe-availability-zones' || fail "Look the zones up with describe-availability-zones."
