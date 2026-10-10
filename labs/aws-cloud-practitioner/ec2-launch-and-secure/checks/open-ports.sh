. "$LAB_LIB"
[ "$(sim '(g => g && g.ingress.some(r => r.from === 22 && r.cidr === "203.0.113.0/24") && g.ingress.some(r => r.from === 80 && r.cidr === "0.0.0.0/0") ? "yes" : "no")(Object.values(s.ec2.groups).find(g => g.GroupName === "web-sg"))')" = yes ] || fail "Allow SSH from 203.0.113.0/24 and HTTP from 0.0.0.0/0."
[ "$(sim '(g => g.ingress.some(r => r.from === 22 && r.cidr === "0.0.0.0/0") ? "open" : "ok")(Object.values(s.ec2.groups).find(g => g.GroupName === "web-sg"))')" = ok ] || fail "SSH must not be open to the whole internet."
