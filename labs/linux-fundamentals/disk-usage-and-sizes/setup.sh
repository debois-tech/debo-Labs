mkdir -p stuff/sub
head -c 102400 /dev/zero > stuff/a.bin
head -c 307200 /dev/zero > stuff/b.bin
head -c 204800 /dev/zero > stuff/sub/c.bin
printf 'small note\n' > stuff/sub/d.txt
printf 'readme\n' > stuff/readme.txt
