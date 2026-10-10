printf '#!/bin/bash\ntotal=0\nfor n in "$@"; do total=$((total + n)); done\necho "$total"\n' > sum.sh
chmod +x sum.sh
