. "$LAB_LIB"
file_has .bashrc '^export GREETING=hello$' || fail "~/.bashrc should contain the line: export GREETING=hello"
