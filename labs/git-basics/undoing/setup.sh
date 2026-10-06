git init -q proj
cd proj
echo "line 1" > notes.txt;  git add notes.txt; git commit -q -m "Add notes"
echo "good work" > work.txt; git add work.txt;  git commit -q -m "Add work"
echo "oops, this was a mistake" > oops.txt; git add oops.txt; git commit -q -m "Add oops"
echo "scribble I regret" >> notes.txt
echo "draft" > draft.txt; git add draft.txt
