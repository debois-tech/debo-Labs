. "$LAB_LIB"
[ "$(sim 's.cloudwatch.alarms["ap-south-1/web-1-cpu-high"].StateValue')" = ALARM ] || fail "The alarm is not in the ALARM state."
[ "$(tr -d '[:space:]' < alarm-state.txt 2>/dev/null)" = ALARM ] || fail "alarm-state.txt should say ALARM (read it with describe-alarms)."
