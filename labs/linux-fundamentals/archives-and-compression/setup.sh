mkdir data
for i in $(seq 1 200); do echo "line $i of the notes"; done > data/notes.txt
printf 'started\nstopped\n' > data/server.log
printf 'a,b,c\n1,2,3\n' > data/table.csv
