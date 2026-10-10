. "$LAB_LIB"
[ ! -e original.txt ] || fail "original.txt still exists."
grep -q 'precious data' hard.txt 2>/dev/null || fail "hard.txt should still hold the data."
[ -L soft.txt ] && [ ! -e soft.txt ] || fail "soft.txt should now be a dangling link."
