aws cloudwatch set-alarm-state --alarm-name web-1-cpu-high --state-value ALARM --state-reason "Testing the alert"
aws cloudwatch describe-alarms --alarm-names web-1-cpu-high --query 'MetricAlarms[0].StateValue' --output text > alarm-state.txt
