#!/usr/bin/env bash
# Phase 5: tear everything down and verify nothing billable is left behind.
set -euo pipefail

ENV_NAME="${ENV_NAME:-beanstalk-grows-env}"
APP_NAME="${APP_NAME:-beanstalk-grows}"

echo "Terminating environment $ENV_NAME..."
aws elasticbeanstalk terminate-environment --environment-name "$ENV_NAME" >/dev/null || true

echo "Waiting for termination..."
aws elasticbeanstalk wait environment-terminated --environment-names "$ENV_NAME" || true

echo
echo "Verify nothing billable remains:"
echo "--- EKS clusters (should be empty once the last environment on a subnet set is gone) ---"
aws eks list-clusters --query 'clusters' --output table || true

echo "--- Load balancers tagged for this project ---"
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=project,Values=beanstalk-grows \
  --resource-type-filters elasticloadbalancing:loadbalancer \
  --query 'ResourceTagMappingList[].ResourceARN' --output table || true

echo
echo "If an EKS cluster is still listed, wait a few minutes and re-check before assuming it's stuck -"
echo "cluster deletion happens after the last environment on its subnet set terminates."
echo
echo "Optional cleanup (only if you won't reuse these for the next demo phase):"
echo "  aws elasticbeanstalk delete-application --application-name $APP_NAME --terminate-env-by-force"
echo "  for r in cluster node observability; do"
echo "    aws iam list-attached-role-policies --role-name aws-elasticbeanstalk-eks-\$r-role"
echo "    # detach each policy, then: aws iam delete-role --role-name aws-elasticbeanstalk-eks-\$r-role"
echo "  done"
echo
echo "Then check AWS Cost Explorer filtered by tag project=beanstalk-grows for the real spend,"
echo "and record it in docs/knowledge-base.md section 3.9."
