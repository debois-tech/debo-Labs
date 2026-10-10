sed -i 's#"s3:\*"#"s3:PutObject"#; s#"\*"$#"arn:aws:s3:::debo-uploads-123456789012/*"#' upload-policy.json
