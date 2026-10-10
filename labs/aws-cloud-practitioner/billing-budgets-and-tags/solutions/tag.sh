aws ec2 create-tags --resources $(aws ec2 describe-instances --filters Name=tag:Name,Values=batch-1 --query 'Reservations[0].Instances[0].InstanceId' --output text) --tags Key=Env,Value=prod
