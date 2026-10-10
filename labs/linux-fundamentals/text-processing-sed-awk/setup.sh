for i in 1 2 3 4 5 6; do echo "2026-10-10 10:0$i INFO request $i served"; done > app.log
echo "2026-10-10 10:07 ERROR disk almost full" >> app.log
echo "2026-10-10 10:08 ERROR timeout talking to db" >> app.log
printf 'id,name,city\n1,Asha,Pune\n2,Ben,Leeds\n3,Chitra,Pune\n4,Dev,Oslo\n' > users.csv
ips=(10.0.0.1 10.0.0.1 10.0.0.1 10.0.0.1 10.0.0.1 10.0.0.2 10.0.0.2 10.0.0.2 10.0.0.3 10.0.0.3 10.0.0.4)
n=0
for ip in "${ips[@]}"; do n=$((n + 1)); echo "$ip - - [10/Oct/2026:10:00:$((10 + n)) +0000] \"GET /page$n HTTP/1.1\" 200 $((n * 100))"; done > access.log
printf '# Server settings\nport=8080\n\n# Logging\nlevel=info\n\nworkers=4\n' > config.conf
