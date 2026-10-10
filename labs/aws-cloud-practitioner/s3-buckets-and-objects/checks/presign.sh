. "$LAB_LIB"
[ -s url.txt ] || fail "url.txt is missing or empty."
grep -q 'X-Amz-Expires=600' url.txt || fail "The URL should expire after 600 seconds."
grep -q '/report.txt?' url.txt || fail "The URL should point at report.txt."
