printf '#!/bin/bash\necho "$APP_ENV"\n' > show.sh
chmod +x show.sh
mkdir bin
printf '#!/bin/bash\necho "hello from bin"\n' > bin/hello-tool
chmod +x bin/hello-tool
