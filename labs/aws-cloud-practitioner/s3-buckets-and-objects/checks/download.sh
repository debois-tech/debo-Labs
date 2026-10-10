. "$LAB_LIB"
[ -f notes-copy.md ] || fail "notes-copy.md does not exist yet."
cmp -s notes.md notes-copy.md || fail "notes-copy.md should be identical to the object."
ran_re 'aws s3 (cp|mv|sync)|get-object' || fail "Download it from S3 with the CLI."
