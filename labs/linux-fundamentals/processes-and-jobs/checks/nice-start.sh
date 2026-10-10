. "$LAB_LIB"
proc_running worker.sh || fail "worker.sh is not running."
[ "$(ps -s "$LAB_SHELL_PID" -o ni=,comm= | awk '$2 == "worker.sh" { print $1; exit }')" = 10 ] || fail "worker.sh should run with a nice value of 10."
