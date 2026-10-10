printf '#!/bin/bash\necho "out: starting"\necho "err: disk warning" >&2\necho "out: working"\necho "err: retrying" >&2\necho "out: done"\n' > noisy.sh
chmod +x noisy.sh
