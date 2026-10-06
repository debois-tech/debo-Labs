. "$LAB_LIB"
ran_re "/sys/fs/cgroup/memory\.max" && ran_re "/sys/fs/cgroup/cpu\.max" || fail "Read both cgroup files: memory.max and cpu.max."
