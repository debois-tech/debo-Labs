. "$LAB_LIB"
[ "$(sim '(p => p && [].concat(p.Document.Statement).every(x => x.Effect === "Deny" && [].concat(x.Action).includes("s3:DeleteObject")) ? "yes" : "no")(s.iam.policies["arn:aws:iam::123456789012:policy/DenyDelete"])')" = yes ] || fail "Create DenyDelete with Effect Deny on s3:DeleteObject."
[ "$(sim '(s.iam.userPolicies["uploader"] || []).includes("arn:aws:iam::123456789012:policy/DenyDelete") ? "yes" : "no"')" = yes ] || fail "DenyDelete is not attached to uploader yet."
