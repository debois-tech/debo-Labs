# The offline `aws` simulator

The cloud labs run in a sandbox with no internet and no AWS account, so the image ships `aws`, a small practice version of the AWS CLI
(`tools/aws-sim`, installed at `/usr/local/bin/aws`). It speaks the real CLI's dialect (commands, flags, `file://` and shorthand
parameters, `--query` via JMESPath, `--output json|text`, familiar error messages) but the "cloud" is a JSON state file in the learner's home
(`~/.aws-sim/state.json`), so every session starts clean and nothing leaves the container.

Services: `configure`, `sts`, `iam` (users, groups, roles, managed and custom policies, access keys, password policy, `simulate-principal-policy`),
`s3` and `s3api` (buckets, objects, versioning, storage classes, lifecycle, public access block, policies, tags, presign), `ec2` (regions, zones,
instances, security groups, key pairs, tags, default VPC), `cloudwatch` (alarms), `sns`, `budgets`, `ce` (simulated numbers) and `support`
(refused on the Basic plan, like the real service).

Simplifications to remember when writing a lab: policy conditions are not evaluated, Cost Explorer figures are simulated, instances
start instantly, and the account is always `123456789012`. Unknown commands fail like the real CLI (`Invalid choice`). Do not teach a behaviour the
simulator does not have; add it to the simulator first.

## Grading
Checks read the simulated cloud with the `sim` helper from `labs/lib.sh`:

```bash
. "$LAB_LIB"
[ "$(sim 's.iam.users["alice"] ? "yes" : "no"')" = yes ] || fail "Create the user alice."
```

A lab's `setup.sh` may call `aws` to pre-build the scene (write `~/.aws/credentials` and `~/.aws/config` first).
