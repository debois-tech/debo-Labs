mkdir -p .aws
printf '[default]\naws_access_key_id = AKIAIOSFODNN7EXAMPLE\naws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n' > .aws/credentials
printf '[default]\nregion = ap-south-1\noutput = json\n' > .aws/config
chmod 600 .aws/credentials .aws/config

printf 'Quarterly report\nRevenue is up.\nCosts are flat.\n' > report.txt
printf '# Notes\n- Remember to delete unused buckets.\n' > notes.md
