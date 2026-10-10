. "$LAB_LIB"
[ -s emails.txt ] || fail "emails.txt is missing or empty."
cmp -s emails.txt <(printf 'asha@example.com\nben.lee@mail.example.org\nchitra_s@example.in\n') || fail "emails.txt should hold exactly the three addresses, one per line."
