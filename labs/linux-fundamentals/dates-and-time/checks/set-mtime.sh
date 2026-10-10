. "$LAB_LIB"
stat -c %y files/report.txt | grep -q '^2020-01-01 12:00' || fail "files/report.txt should be modified on 2020-01-01 at 12:00."
