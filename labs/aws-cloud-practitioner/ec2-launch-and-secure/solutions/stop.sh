aws ec2 stop-instances --instance-ids $(aws ec2 describe-instances --filters Name=tag:Name,Values=web-1 --query 'Reservations[0].Instances[0].InstanceId' --output text)
