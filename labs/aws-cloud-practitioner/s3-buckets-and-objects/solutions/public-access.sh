aws s3api get-public-access-block --bucket debo-reports-123456789012 --query 'PublicAccessBlockConfiguration.BlockPublicPolicy' --output text > bpa.txt
