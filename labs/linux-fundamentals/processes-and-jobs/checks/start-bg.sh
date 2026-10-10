. "$LAB_LIB"
proc_running worker.sh || fail "worker.sh is not running in the background. Start it with ./worker.sh &"
