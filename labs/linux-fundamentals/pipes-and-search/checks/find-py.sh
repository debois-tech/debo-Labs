. "$LAB_LIB"
[ -f py-files.txt ] || fail "py-files.txt does not exist yet."
[ "$(sed 's|^\./||' py-files.txt | sort)" = "$(printf 'src/main.py\nsrc/utils/parse.py')" ] || fail "py-files.txt should list exactly the two .py files."
