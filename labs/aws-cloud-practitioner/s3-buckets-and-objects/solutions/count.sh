aws s3api list-objects-v2 --bucket debo-reports-123456789012 --query 'length(Contents)' --output text > count.txt
