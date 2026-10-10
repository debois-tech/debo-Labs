. "$LAB_LIB"
[ "$(tr -d '[:space:]' < support-error.txt 2>/dev/null)" = SubscriptionRequiredException ] || fail "support-error.txt should hold only the error code."
ran_re 'describe-trusted-advisor-checks' || fail "Run the Trusted Advisor call first."
