. "$LAB_LIB"
[ -f hello.sh ] || fail "hello.sh does not exist yet."
head -1 hello.sh | grep -q "^#!" || fail "The first line should be the shebang: #!/bin/bash"
[ -x hello.sh ] || fail "hello.sh is not executable - try chmod +x hello.sh"
out=$(timeout 3 ./hello.sh 2>&1)
[ "$out" = "Hello, World!" ] || fail "Running ./hello.sh should print exactly: Hello, World!"
