printf 'Asha Rao <asha@example.com> +91-98765-43210\nBen Lee <ben.lee@mail.example.org> +44-20-7946-0958\nno contact on this line\nChitra <chitra_s@example.in>\n' > contacts.txt
cat > server.log <<'EOP'
2026-10-10 09:58 INFO boot ok
2026-10-10 10:01 DEBUG cache warm
2026-10-10 10:02 ERROR db failure
2026-10-10 10:03 WARN disk 91%
2026-10-10 10:04 INFO request fail retry
2026-10-10 10:05 ERROR Timeout talking to api
2026-10-10 10:06 DEBUG timeout handled
2026-10-10 10:07 INFO failed login for bob
EOP
