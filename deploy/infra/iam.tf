# The three roles a Beanstalk Cluster Mode environment requires. Names,
# trust policies, and managed policies match exactly what AWS documents and
# what this project's own 01-create-roles.sh already created by hand -
# terraform import brings the existing roles under management rather than
# recreating them (see README.md's bootstrap section).

data "aws_iam_policy_document" "eks_assume" {
  statement {
    actions = ["sts:AssumeRole", "sts:TagSession"]
    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "pods_assume" {
  statement {
    actions = ["sts:AssumeRole", "sts:TagSession"]
    principals {
      type        = "Service"
      identifiers = ["pods.eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "cluster" {
  name               = "aws-elasticbeanstalk-eks-cluster-role"
  assume_role_policy = data.aws_iam_policy_document.eks_assume.json
}

resource "aws_iam_role_policy_attachment" "cluster" {
  for_each = toset([
    "AmazonEKSClusterPolicy",
    "AmazonEKSNetworkingPolicy",
    "AmazonEKSComputePolicy",
    "AmazonEKSBlockStoragePolicy",
    "AmazonEKSLoadBalancingPolicy",
    "AWSElasticBeanstalkEKSTagging",
  ])
  role       = aws_iam_role.cluster.name
  policy_arn = "arn:aws:iam::aws:policy/${each.value}"
}

resource "aws_iam_role" "node" {
  name               = "aws-elasticbeanstalk-eks-node-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "node" {
  for_each = toset([
    "AmazonEKSWorkerNodeMinimalPolicy",
    "AmazonEC2ContainerRegistryPullOnly",
    "AmazonSSMManagedInstanceCore",
  ])
  role       = aws_iam_role.node.name
  policy_arn = "arn:aws:iam::aws:policy/${each.value}"
}

resource "aws_iam_role" "observability" {
  name               = "aws-elasticbeanstalk-eks-observability-role"
  assume_role_policy = data.aws_iam_policy_document.pods_assume.json
}

resource "aws_iam_role_policy_attachment" "observability" {
  for_each = toset([
    "CloudWatchAgentServerPolicy",
    "AWSElasticBeanstalkEKSObservability",
  ])
  role       = aws_iam_role.observability.name
  policy_arn = "arn:aws:iam::aws:policy/${each.value}"
}

# --- GitHub Actions OIDC deploy role -----------------------------------------
# CI assumes this role instead of storing long-lived AWS keys as a GitHub
# secret. This is the one resource that has to be bootstrapped by a human's
# first `terraform apply` - CI can't create its own permission to run before
# this role exists (see README.md).

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

locals {
  github_owner = split("/", var.github_repo)[0]
  github_name  = split("/", var.github_repo)[1]
}

data "aws_iam_policy_document" "github_deploy_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      # GitHub's OIDC sub claim embeds the immutable owner and repo IDs:
      #   repo:<owner>@<owner-id>/<repo>@<repo-id>:ref:refs/heads/main
      # (confirmed by decoding a real token from this pipeline). The match is EXACT - no
      # wildcards - so another account's org or repo can never satisfy it, even one whose
      # name merely starts like ours. Pass both IDs; without them only the plain
      # "owner/repo" form is trusted, which GitHub does not issue for this repo.
      values = compact([
        "repo:${local.github_owner}/${local.github_name}:ref:refs/heads/main",
        var.github_owner_id != "" && var.github_repo_id != "" ? "repo:${local.github_owner}@${var.github_owner_id}/${local.github_name}@${var.github_repo_id}:ref:refs/heads/main" : "",
      ])
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "climb-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_deploy_assume.json
}

# Scoped to exactly what the deploy pipeline needs: push images, and drive
# Elastic Beanstalk Cluster Mode deploys via the AWS CLI (03-deploy.sh) - not
# broad account access.
data "aws_iam_policy_document" "github_deploy_permissions" {
  statement {
    sid = "ECRPush"
    actions = [
      "ecr:GetAuthorizationToken",
    ]
    resources = ["*"]
  }
  statement {
    sid = "ECRRepo"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeRepositories",
    ]
    resources = [aws_ecr_repository.app.arn]
  }
  # Same lesson as the Terraform-managed resources below: individual EB
  # actions (AddTags, CreateApplicationVersion, ...) kept surfacing one at a
  # time across this pipeline's first real runs. Scoped to this project's own
  # named application/environment/version ARNs, not the whole account.
  statement {
    sid     = "ElasticBeanstalkDeploy"
    actions = ["elasticbeanstalk:*"]
    resources = [
      "arn:aws:elasticbeanstalk:*:*:application/beanstalk-grows",
      "arn:aws:elasticbeanstalk:*:*:environment/beanstalk-grows/*",
      "arn:aws:elasticbeanstalk:*:*:applicationversion/beanstalk-grows/*",
    ]
  }
  # On the first CreateApplication in a region, Elastic Beanstalk creates its own
  # regional storage bucket (elasticbeanstalk-<region>-<account>) using the CALLER's
  # permissions. It used to exist from earlier manual runs, which hid this gap; after an
  # account cleanup the deploy role could not recreate it. Scoped to that one bucket name.
  statement {
    sid     = "ElasticBeanstalkStorageBucket"
    actions = ["s3:*"]
    resources = [
      "arn:aws:s3:::elasticbeanstalk-*-${data.aws_caller_identity.current.account_id}",
      "arn:aws:s3:::elasticbeanstalk-*-${data.aws_caller_identity.current.account_id}/*",
    ]
  }
  statement {
    # DescribeEnvironments/DescribeEvents/DescribeApplications don't support
    # resource-level scoping - list/describe calls are inherently account-wide.
    sid       = "ElasticBeanstalkDescribe"
    actions   = ["elasticbeanstalk:Describe*"]
    resources = ["*"]
  }
  statement {
    sid       = "PassRolesToBeanstalk"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.cluster.arn, aws_iam_role.node.arn, aws_iam_role.observability.arn]
  }
  # Terraform's own refresh/plan/apply cycle reads and writes many small
  # metadata calls per resource type (tags, CORS, backups, ACLs...) that are
  # impractical to enumerate one at a time - this policy went through
  # several rounds of "add one more missing action" during this project's own
  # first real CI run before landing on full-action wildcards scoped tightly
  # to specific, named, project-owned resource ARNs instead (never `*`).
  statement {
    sid     = "TerraformManagesOwnIamResources"
    actions = ["iam:*"]
    resources = [
      aws_iam_role.cluster.arn,
      aws_iam_role.node.arn,
      aws_iam_role.observability.arn,
      aws_iam_role.github_deploy.arn,
      "arn:aws:iam::*:oidc-provider/token.actions.githubusercontent.com",
    ]
  }
  statement {
    sid     = "TerraformRemoteStateBucket"
    actions = ["s3:*"]
    resources = [
      "arn:aws:s3:::climb-terraform-state-*",
      "arn:aws:s3:::climb-terraform-state-*/*",
    ]
  }
  statement {
    sid       = "TerraformStateLockTable"
    actions   = ["dynamodb:*"]
    resources = ["arn:aws:dynamodb:*:*:table/climb-terraform-lock"]
  }
  statement {
    sid       = "TerraformManagesEcr"
    actions   = ["ecr:*"]
    resources = [aws_ecr_repository.app.arn]
  }
  statement {
    sid       = "TerraformManagesBudget"
    actions   = ["budgets:*"]
    resources = ["arn:aws:budgets::*:budget/beanstalk-grows-demo"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "climb-deploy-permissions"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy_permissions.json
}
