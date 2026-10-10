. "$LAB_LIB"
[ -s pid.txt ] || fail "pid.txt is missing or empty."
[ "$(tr -d '[:space:]' < pid.txt)" = "$(pgrep -s "$LAB_SHELL_PID" -x worker.sh | head -1)" ] || fail "pid.txt should hold the PID of the running worker.sh."
