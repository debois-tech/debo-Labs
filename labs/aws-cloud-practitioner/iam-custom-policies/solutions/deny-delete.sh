printf '{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"s3:DeleteObject","Resource":"*"}]}' > deny-delete.json
aws iam create-policy --policy-name DenyDelete --policy-document file://deny-delete.json
aws iam attach-user-policy --user-name uploader --policy-arn arn:aws:iam::123456789012:policy/DenyDelete
