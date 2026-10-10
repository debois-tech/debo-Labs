awk '{ print $1 }' access.log | sort | uniq -c | sort -rn | head -3 > top3.txt
