. "$LAB_LIB"
[ "$(sim '(i => i && i.State.Name === "running" && i.InstanceType === "t3.micro" && i.KeyName === "debo-key" && i.groupIds.some(g => g.name === "web-sg") ? "yes" : "no")(Object.values(s.ec2.instances).find(i => i.Tags.some(t => t.Key === "Name" && t.Value === "web-1")))')" = yes ] || fail "Expected a running t3.micro tagged web-1 with key debo-key and security group web-sg."
