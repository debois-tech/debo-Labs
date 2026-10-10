mkdir files
for f in a.txt b.txt c.txt report.txt; do echo "$f" > files/$f; done
touch -d '3 days ago' files/a.txt
touch -d '2 days ago' files/b.txt
touch -d '1 day ago' files/c.txt
touch -d '5 days ago' files/report.txt
