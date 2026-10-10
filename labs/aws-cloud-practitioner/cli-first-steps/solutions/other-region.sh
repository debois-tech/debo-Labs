aws ec2 describe-availability-zones --region eu-west-1 --query 'AvailabilityZones[].ZoneName' --output text | tr '\t' '\n' > eu-azs.txt
