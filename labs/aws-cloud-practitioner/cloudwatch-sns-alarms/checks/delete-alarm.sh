. "$LAB_LIB"
[ "$(sim 's.cloudwatch.alarms["ap-south-1/web-1-cpu-high"] ? "yes" : "no"')" = no ] || fail "The alarm still exists."
