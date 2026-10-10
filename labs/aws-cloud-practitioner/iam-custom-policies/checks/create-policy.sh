. "$LAB_LIB"
[ "$(sim '(p => p && JSON.stringify([].concat(p.Document.Statement)[0].Action) === "\"s3:PutObject\"" ? "yes" : "no")(s.iam.policies["arn:aws:iam::123456789012:policy/UploadOnly"])')" = yes ] || fail "Create a policy named UploadOnly from the narrowed file."
