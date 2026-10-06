#!/usr/bin/env bash
# Phase 1: create the 3 IAM roles a Beanstalk Cluster environment requires.
# Idempotent-ish: skips a role if it already exists.
set -euo pipefail

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cat > "$TMP_DIR/eks-trust.json" <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "eks.amazonaws.com"},
    "Action": ["sts:AssumeRole", "sts:TagSession"]
  }]
}
EOF

cat > "$TMP_DIR/ec2-trust.json" <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ec2.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

cat > "$TMP_DIR/pods-trust.json" <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "pods.eks.amazonaws.com"},
    "Action": ["sts:AssumeRole", "sts:TagSession"]
  }]
}
EOF

create_role() {
  local role_name="$1" trust_file="$2"; shift 2
  if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
    echo "Role $role_name already exists, skipping create."
  else
    aws iam create-role \
      --role-name "$role_name" \
      --assume-role-policy-document "file://$trust_file" >/dev/null
    echo "Created role $role_name"
  fi
  for policy in "$@"; do
    aws iam attach-role-policy \
      --role-name "$role_name" \
      --policy-arn "arn:aws:iam::aws:policy/$policy"
  done
}

create_role aws-elasticbeanstalk-eks-cluster-role "$TMP_DIR/eks-trust.json" \
  AmazonEKSClusterPolicy AmazonEKSNetworkingPolicy AmazonEKSComputePolicy \
  AmazonEKSBlockStoragePolicy AmazonEKSLoadBalancingPolicy AWSElasticBeanstalkEKSTagging

create_role aws-elasticbeanstalk-eks-node-role "$TMP_DIR/ec2-trust.json" \
  AmazonEKSWorkerNodeMinimalPolicy AmazonEC2ContainerRegistryPullOnly \
  AmazonSSMManagedInstanceCore

create_role aws-elasticbeanstalk-eks-observability-role "$TMP_DIR/pods-trust.json" \
  CloudWatchAgentServerPolicy AWSElasticBeanstalkEKSObservability

echo
echo "Role ARNs:"
for r in cluster node observability; do
  arn=$(aws iam get-role --role-name "aws-elasticbeanstalk-eks-$r-role" --query 'Role.Arn' --output text)
  echo "  $r: $arn"
done
