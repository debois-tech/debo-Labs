. "$LAB_LIB"
[ "$(sed -n 's/^aws_access_key_id *= *//p' .aws/credentials 2>/dev/null)" = "AKIAIOSFODNN7EXAMPLE" ] || fail "The access key ID is not saved yet (check ~/.aws/credentials)."
file_has .aws/credentials '^aws_secret_access_key *= *wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY$' || fail "The secret access key is missing or wrong."
[ "$(sed -n 's/^region *= *//p' .aws/config 2>/dev/null)" = "ap-south-1" ] || fail "Set the default Region to ap-south-1."
