. "$LAB_LIB"
ran_re "/etc/os-release" && ran uname || fail "Run both: cat /etc/os-release and uname -r."
