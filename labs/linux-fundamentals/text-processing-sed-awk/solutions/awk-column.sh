awk -F, 'NR > 1 { print $3 }' users.csv > cities.txt
