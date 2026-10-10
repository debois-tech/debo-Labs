aws ec2 describe-availability-zones --query 'length(AvailabilityZones)' --output text > az-count.txt
