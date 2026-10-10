. "$LAB_LIB"
jq -e '.Statement | length == 1' upload-policy.json >/dev/null 2>&1 || fail "upload-policy.json must still be valid JSON with one statement."
jq -e '.Statement[0] | (.Effect == "Allow") and ([.Action] | flatten == ["s3:PutObject"]) and ([.Resource] | flatten == ["arn:aws:s3:::debo-uploads-123456789012/*"])' upload-policy.json >/dev/null 2>&1 || fail "Allow only s3:PutObject on arn:aws:s3:::debo-uploads-123456789012/*."
