# The S3 bucket + DynamoDB lock table Terraform's own remote state lives in.
# Bootstrapped once by hand with the local backend, then providers.tf's
# backend block is switched to "s3" and state is migrated into it - this is
# what makes state persist across CI runs, which turned out not to be
# optional: each GitHub Actions run starts from a blank checkout, and without
# shared state it tried to recreate every resource from scratch on every
# deploy, failing against the (deliberately) least-privileged deploy role.

resource "aws_s3_bucket" "tf_state" {
  bucket = "climb-terraform-state-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket                  = aws_s3_bucket.tf_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "tf_lock" {
  name         = "climb-terraform-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}

data "aws_caller_identity" "current" {}
