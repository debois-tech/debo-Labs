sed -i 's/"Amount": "0"/"Amount": "100"/' budget.json
aws budgets create-budget --account-id 123456789012 --budget file://budget.json
