#!/bin/sh

echo 'begin tessel cli install...'

# check node version >= 0.8
node_version=`(node --version > /dev/null) && (node --version 2>&1 | tr -d 'a-z ')`
ret=$?
case "$node_version" in 0.[01234567].*) ret=99;; esac
if [ $ret -ne 0 ]; then
  echo "You need node 0.8+ installed to install tessel (node --version reports: $node_version)." >&2
  echo "Please install node 0.8+ and try again." >&2
  exit $ret
fi
echo "node version: $node_version"

INSTPWD=$(pwd)

# clone and install tessel cli
echo 'downloading tessel cli...'
cd $(mktemp -d /tmp/tessel-XXXXXXX)
curl -O https://s3.amazonaws.com/tessel-tools/cli/tessel-cli.tar.gz

# get default group
if [ "$(uname)" == "Darwin" ]; then
  DEFAULTGROUP=staff
else
  DEFAULTGROUP=users
fi

# npm install -g
echo 'npm install -g'
touch -c `npm -g prefix`/bin 2>/dev/null
if [ $? -ne 0 ]; then
  echo '! sudo is needed to npm install -g'
  sudo npm install -g --no-registry --loglevel=info --ignore-scripts tessel-cli.tar.gz 
  sudo chown -R $USER:$DEFAULTGROUP `npm -g prefix`/lib/node_modules
else
  touch -c `npm -g prefix`/lib/node_modules 2>/dev/null
  if [ $? -ne 0 ]; then
    echo '! sudo is needed to allow user write access to tessel cli'
    sudo chown -R $USER:$DEFAULTGROUP `npm -g prefix`/lib/node_modules
  fi

  npm install -g --no-registry --loglevel=info --ignore-scripts tessel-cli.tar.gz 
fi
if [ $? -ne 0 ]; then echo "! npm install -g failed"; exit 1; fi

# npm rebuild
echo 'npm rebuild'
cd `npm -g prefix`/lib/node_modules/tessel
npm rebuild
if [ $? -ne 0 ]; then echo "! npm rebuild failed"; exit 1; fi

# Install udev rules on Linux
if [ "$(uname)" != "Darwin" ]; then
  echo 'adding udev rules'
  sudo rm /etc/udev/rules.d/10-tessel.rules || true
  sudo tee /etc/udev/rules.d/85-tessel.rules > /dev/null << EOF
ATTRS{idVendor}=="1fc9", ATTRS{idProduct}=="000c", MODE="0666"
ATTRS{idVendor}=="1fc9", ATTRS{idProduct}=="2002", ENV{ID_MM_DEVICE_IGNORE}="1", MODE="0666"
ATTRS{idVendor}=="1d50", ATTRS{idProduct}=="6097", ENV{ID_MM_DEVICE_IGNORE}="1", MODE="0666"
EOF
  sudo udevadm control --reload-rules
fi

# Classy signoff
echo
echo '#########################################'
echo ' Successfully installed Tessel CLI!'
echo ' Try running "tessel" from your command'
echo ' line, and "tessel logs" when a Tessel'
echo ' is connected to your computer.'
echo ' #tessellives'
echo '#########################################'

