. "$LAB_LIB"
[ "$(sim '(s.iam.groupPolicies["developers"] || []).includes("arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess") ? "yes" : "no"')" = yes ] || fail "The developers group does not have AmazonS3ReadOnlyAccess yet."
