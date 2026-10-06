printf '#!/bin/bash\nif [ -e "$1" ]; then echo exists; else echo missing; fi\n' > exists.sh
