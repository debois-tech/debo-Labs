. "$LAB_LIB"
in_repo proj diff --quiet -- notes.txt && grep -qx "line 1" proj/notes.txt || fail "notes.txt still has the uncommitted scribble."
