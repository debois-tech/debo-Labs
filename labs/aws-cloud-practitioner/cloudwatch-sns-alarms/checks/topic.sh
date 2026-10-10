. "$LAB_LIB"
[ "$(sim 's.sns.topics["arn:aws:sns:ap-south-1:123456789012:ops-alerts"] ? "yes" : "no"')" = yes ] || fail "There is no ops-alerts topic in ap-south-1 yet."
