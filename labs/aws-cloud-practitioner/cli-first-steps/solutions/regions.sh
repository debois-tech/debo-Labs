aws ec2 describe-regions --query 'Regions[].RegionName' --output text | tr '\t' '\n' > regions.txt
