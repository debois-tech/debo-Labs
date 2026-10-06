. "$LAB_LIB"
[ ! -e workspace/hello.txt ] || fail "hello.txt still exists."
[ -f workspace/archive.txt ] || fail "Oops - archive.txt is gone too."
