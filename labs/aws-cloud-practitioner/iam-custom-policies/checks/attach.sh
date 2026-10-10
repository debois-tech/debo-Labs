. "$LAB_LIB"
[ "$(sim '(s.iam.userPolicies["uploader"] || []).includes("arn:aws:iam::123456789012:policy/UploadOnly") ? "yes" : "no"')" = yes ] || fail "UploadOnly is not attached to uploader yet."
