. "$LAB_LIB"
[ -f data/notes.txt.gz ] && [ -f data/notes.txt ] || fail "You need both data/notes.txt and data/notes.txt.gz."
gzip -t data/notes.txt.gz 2>/dev/null || fail "data/notes.txt.gz is not valid gzip data."
