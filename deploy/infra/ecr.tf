# Created by hand earlier in this project (02-build-and-push.sh); brought
# under Terraform management via `terraform import` rather than recreated
# (see README.md's bootstrap section - importing avoids "already exists"
# on the first apply).

resource "aws_ecr_repository" "app" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  tags = {
    project = "beanstalk-grows"
  }
}
