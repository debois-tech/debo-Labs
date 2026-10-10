. "$LAB_LIB"
[ "$(sim '(i => i ? i.State.Name : "none")(Object.values(s.ec2.instances).find(i => i.Tags.some(t => t.Value === "web-1")))')" = terminated ] || fail "web-1 should be terminated."
