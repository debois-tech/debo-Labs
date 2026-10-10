. "$LAB_LIB"
[ "$(sim 's.sns.subscriptions.some(x => x.TopicArn === "arn:aws:sns:ap-south-1:123456789012:ops-alerts" && x.Protocol === "email" && x.Endpoint === "ops@example.com") ? "yes" : "no"')" = yes ] || fail "ops@example.com is not subscribed to ops-alerts yet."
