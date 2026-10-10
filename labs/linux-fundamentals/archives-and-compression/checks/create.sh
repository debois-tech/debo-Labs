. "$LAB_LIB"
[ -s backup.tar.gz ] || fail "backup.tar.gz does not exist yet."
tar tzf backup.tar.gz 2>/dev/null | grep -q '^data/notes.txt$' || fail "backup.tar.gz should contain data/notes.txt (is it a gzip tar?)."
