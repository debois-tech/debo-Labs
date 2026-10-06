. "$LAB_LIB"
# Must have started yes (so skipping ahead does not pass vacuously) and then stopped it.
ran yes || fail "Start yes in the previous step first."
! proc_running yes || fail "yes is still running - kill its PID."
