. "$LAB_LIB"
in_repo proj cat-file -e main:feature.txt 2>/dev/null || fail "main does not contain the feature yet."
