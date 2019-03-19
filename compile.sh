# !/bin/bash

# This script will pack everything into BanChecker_BROWSER_{VERSION}.zip ready for
# uploading to the Chrome Store and Add-ons for Firefox. This way we can use unpacked extension while developing without changing
# any filename or manifest.json or manually replacing files.

# Use "Bash on Ubuntu on Windows" if you're on Windows 10 or cygwin to run on Windows.

VERSION=$(grep '"version":' manifest.json | sed 's/^.*: //;s/"//g' | tr -d ',\r\n');
echo "Ban Checker version in manifest.json: $VERSION. This script will pack everything into Banchecker_Chrome_${VERSION}.zip and Banchecker_Firefox_${VERSION}.zip";

echo "Creating temp folder that will hold files, it'll be deleted in the end...";
mkdir temp;

cp *.js temp;

echo "Moving all other files into temp folder...";
cp -a icons temp/icons;
cp display.css temp;
cp options.html temp;
cp manifest.json temp;

echo "Moving everything into Banchecker_Chrome_${VERSION}.zip...";
cd temp;
zip -r "../Banchecker_Chrome_${VERSION}.zip" .;

echo "Adding extra lines into manifest file needed for Firefox...";
firefox_specific_bits='\  \"applications\": {\n\    \"gecko\": {\n\      \"id\": \"banchecker@kuzmenko.io\",\n\      \"strict_min_version\": \"48.0\"\n\    }\n\  },';
sed -i "/\"manifest_version\": 2/i $firefox_specific_bits" manifest.json;

echo "Moving everything into Banchecker_Firefox_${VERSION}.zip...";
zip -r "../Banchecker_Firefox_${VERSION}.zip" .;

echo "Removing temp folder...";
cd ..;
rm -r temp;

echo "Done!";