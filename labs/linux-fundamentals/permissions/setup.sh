printf '#!/bin/bash\necho "Deploy complete"\n' > deploy.sh
echo "api-key=12345" > secret.txt
chmod 644 deploy.sh secret.txt
