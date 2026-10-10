mkdir shared dropbox www
for f in index.html style.css app.js notes.txt; do echo "$f" > www/$f; done
chmod 666 www/style.css
chmod 646 www/app.js
