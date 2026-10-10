. "$LAB_LIB"
proc_running worker.sh && fail "worker.sh is still running."
ran_re 'kill ' || fail "Stop it with the kill command."
