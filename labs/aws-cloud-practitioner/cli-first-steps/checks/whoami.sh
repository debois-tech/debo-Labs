. "$LAB_LIB"
[ -s account.txt ] || fail "account.txt is missing or empty."
[ "$(tr -d '[:space:]' < account.txt)" = "$(aws sts get-caller-identity --query Account --output text 2>/dev/null)" ] || fail "account.txt should hold just your 12-digit account ID."
ran_re 'aws sts get-caller-identity' || fail "Ask AWS who you are with aws sts get-caller-identity."
