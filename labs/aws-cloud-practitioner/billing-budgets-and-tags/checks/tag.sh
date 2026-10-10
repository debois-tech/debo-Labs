. "$LAB_LIB"
[ "$(sim '(i => i && i.Tags.some(t => t.Key === "Env" && t.Value === "prod") ? "yes" : "no")(Object.values(s.ec2.instances).find(i => i.Tags.some(t => t.Key === "Name" && t.Value === "batch-1")))')" = yes ] || fail "batch-1 needs the tag Env=prod."
