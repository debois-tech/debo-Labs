awk '{ s += $NF } END { print s }' access.log > total.txt
