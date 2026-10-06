. "$LAB_LIB"
[ -f workspace/backup.txt ] && cmp -s workspace/hello.txt workspace/backup.txt || fail "backup.txt should be a copy of hello.txt."
