mkdir -p .aws
printf '[default]\naws_access_key_id = AKIAIOSFODNN7EXAMPLE\naws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n' > .aws/credentials
printf '[default]\nregion = ap-south-1\noutput = json\n' > .aws/config
chmod 600 .aws/credentials .aws/config

aws ec2 run-instances --image-id ami-0abcdef1234567890 --instance-type t3.micro --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=web-1}]' --query 'Instances[0].InstanceId' --output text > instance-id.txt
