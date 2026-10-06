. "$LAB_LIB"
[ ! -e workspace/backup.txt ] || fail "backup.txt still exists - mv should rename it."
file_has workspace/archive.txt "^hello linux$" || fail "workspace/archive.txt is missing or has the wrong content."
