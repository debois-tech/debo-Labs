aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::123456789012:user/uploader --action-names s3:DeleteObject --query 'EvaluationResults[0].EvalDecision' --output text > proof.txt
