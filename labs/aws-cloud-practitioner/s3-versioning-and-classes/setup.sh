mkdir -p .aws
printf '[default]\naws_access_key_id = AKIAIOSFODNN7EXAMPLE\naws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n' > .aws/credentials
printf '[default]\nregion = ap-south-1\noutput = json\n' > .aws/config
chmod 600 .aws/credentials .aws/config

aws s3 mb s3://debo-archive-123456789012 > /dev/null
echo v1 > plan.txt
cat > lifecycle.json <<'EOP'
{
  "Rules": [
    {
      "ID": "age-out",
      "Status": "Enabled",
      "Filter": { "Prefix": "archive/" },
      "Transitions": [
        {"Days": 10, "StorageClass": "STANDARD_IA"},
        {"Days": 90, "StorageClass": "GLACIER"}
      ],
      "Expiration": { "Days": 365 }
    }
  ]
}
EOP
