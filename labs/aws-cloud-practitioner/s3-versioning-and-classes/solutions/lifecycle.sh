sed -i 's/"Days": 10,/"Days": 30,/' lifecycle.json
aws s3api put-bucket-lifecycle-configuration --bucket debo-archive-123456789012 --lifecycle-configuration file://lifecycle.json
