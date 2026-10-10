. "$LAB_LIB"
[ -s proof.txt ] || fail "proof.txt is missing or empty."
[ "$(tr -d '[:space:]' < proof.txt)" = "$(aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::123456789012:user/uploader --action-names s3:DeleteObject --query 'EvaluationResults[0].EvalDecision' --output text 2>/dev/null)" ] || fail "proof.txt should hold the decision for s3:DeleteObject."
grep -q explicitDeny proof.txt || fail "The decision should be an explicit deny. Is DenyDelete attached?"
