. "$LAB_LIB"
ran_re "^ls( +-[a-zA-Z]+)* +(\./)?projects/?$" || fail "List the projects directory: ls <path>"
