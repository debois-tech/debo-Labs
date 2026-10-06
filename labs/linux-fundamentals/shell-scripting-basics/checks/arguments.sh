. "$LAB_LIB"
[ -f greet.sh ] || fail "greet.sh does not exist yet."
for n in Ada Linus; do
  out=$(timeout 3 bash greet.sh "$n" 2>&1)
  [ "$out" = "Hello, $n!" ] || fail "./greet.sh $n should print: Hello, $n!"
done
