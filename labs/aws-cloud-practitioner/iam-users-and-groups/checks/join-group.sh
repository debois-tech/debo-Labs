. "$LAB_LIB"
[ "$(sim '(s.iam.memberships["dev-alice"] || []).includes("developers") ? "yes" : "no"')" = yes ] || fail "dev-alice is not in the developers group yet."
