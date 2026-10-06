. "$LAB_LIB"
file_has myrepo/README.md "[^[:space:]]" || fail "myrepo/README.md is missing or empty."
