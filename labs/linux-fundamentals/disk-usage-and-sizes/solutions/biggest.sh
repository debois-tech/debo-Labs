find stuff -type f -printf '%s %p\n' | sort -rn | head -1 | cut -d' ' -f2 > biggest.txt
