. "$LAB_LIB"
file_has workspace/hello.txt "^hello linux$" || fail "workspace/hello.txt should contain exactly: hello linux"
