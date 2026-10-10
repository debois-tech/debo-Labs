. "$LAB_LIB"
[ "$(sim 'Object.values(s.ec2.groups).some(g => g.GroupName === "web-sg") ? "yes" : "no"')" = yes ] || fail "There is no security group named web-sg yet."
