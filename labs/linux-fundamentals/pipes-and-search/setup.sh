cat > app.log <<'LOG'
2024-05-01 10:00:01 INFO server started
2024-05-01 10:00:07 ERROR database connection refused
2024-05-01 10:01:13 INFO request /home 200
2024-05-01 10:02:44 WARN slow query 1200ms
2024-05-01 10:03:02 ERROR timeout calling payments
2024-05-01 10:04:15 INFO request /cart 200
2024-05-01 10:05:59 ERROR disk almost full
LOG
mkdir -p src/utils
printf '# TODO: add retries\nprint("hi")\n' > src/main.py
printf 'def parse():\n    pass\n' > src/utils/parse.py
printf '// TODO: remove debug\n' > src/utils/debug.js
echo "notes" > notes.txt
