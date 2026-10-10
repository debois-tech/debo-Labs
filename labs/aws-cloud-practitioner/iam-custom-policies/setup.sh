mkdir -p .aws
printf '[default]\naws_access_key_id = AKIAIOSFODNN7EXAMPLE\naws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n' > .aws/credentials
printf '[default]\nregion = ap-south-1\noutput = json\n' > .aws/config
chmod 600 .aws/credentials .aws/config

aws iam create-user --user-name uploader > /dev/null
cat > upload-policy.json <<'EOP'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": "*"
    }
  ]
}
EOP
