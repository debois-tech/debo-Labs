. "$LAB_LIB"
in_repo myrepo diff --cached --name-only 2>/dev/null | grep -qx README.md || fail "README.md is not staged."
