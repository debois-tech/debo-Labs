aws ec2 create-key-pair --key-name debo-key --query KeyMaterial --output text > debo-key.pem
chmod 400 debo-key.pem
