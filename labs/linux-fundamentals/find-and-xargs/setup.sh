mkdir -p project/src project/logs project/data project/cache
printf 'main program\nTODO: add tests\n' > project/src/main.txt
printf 'helpers\n' > project/src/util.txt
printf 'TODO later\n' > project/cache/notes.txt
printf 'started\n' > project/logs/app.log
printf 'old entry\n' > project/logs/old.log
head -c 200000 /dev/zero > project/data/huge.dat
head -c 150000 /dev/zero > project/data/archive.dat
printf 'tiny\n' > project/data/small.dat
printf 'x\n' > project/cache/a.tmp
printf 'y\n' > project/cache/b.tmp
printf 'z\n' > project/src/scratch.tmp
touch -d '60 days ago' project/logs/old.log project/data/archive.dat project/src/util.txt
