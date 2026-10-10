. "$LAB_LIB"
[ -s decision.txt ] || fail "decision.txt is missing or empty."
[ "$(tr -d '[:space:]' < decision.txt)" = "$(aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::123456789012:user/dev-alice --action-names s3:PutObject --query 'EvaluationResults[0].EvalDecision' --output text 2>/dev/null)" ] || fail "decision.txt should hold the real decision for s3:PutObject."
ran_re 'simulate-principal-policy' || fail "Use simulate-principal-policy to test the permission."
