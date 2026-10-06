output "cluster_role_arn" {
  value = aws_iam_role.cluster.arn
}

output "node_role_arn" {
  value = aws_iam_role.node.arn
}

output "observability_role_arn" {
  value = aws_iam_role.observability.arn
}

output "github_deploy_role_arn" {
  description = "Role ARN for the deploy.yml workflow's aws-actions/configure-aws-credentials step"
  value       = aws_iam_role.github_deploy.arn
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}
