# Check node version >= 0.8
node_version=`(node --version > /dev/null) && (node --version 2>&1 | tr -d 'a-z ')`
ret=$?
case "$node_version" in 0.[01234567].*) ret=99;; esac
if [ $ret -ne 0 ]; then
  echo "You need node 0.8+ installed to install tessel (node --version reports: $node_version)." >&2
  echo "Please install node 0.8+ and try again." >&2
  exit $ret
fi
echo "node version: $node_version"

# Check git version >= 1.7 (we guess)
git_version=`(git --version > /dev/null) && (git --version 2>&1 | tr -d 'a-z ')`
ret=$?
case "$git_version" in 0.*.* | 1.[0123456].*) ret=99;; esac
if [ $ret -ne 0 ]; then
  echo "You need git 1.7+ installed to install tessel (git --version reports: $git_version)." >&2
  echo "Please install git 1.7+ and try again." >&2
  exit $ret
fi
echo "git version: $git_version"


## INSTALL

set -e

# set the temp dir
TMP="${TMPDIR}"
if [ "x$TMP" = "x" ]; then
  TMP="/tmp"
fi
TMP="${TMP}/tessel.$$"
rm -rf "$TMP" || true
mkdir "$TMP"
if [ $? -ne 0 ]; then
  echo "failed to mkdir $TMP" >&2
  exit 1
fi

# Clone and install tessel cli (requesting sudo if appropriate)
cd $TMP
git clone https://tmTestUser:tmTestUser1@github.com/tessel/cli.git
cd cli
touch `npm -g prefix`/lib/node_modules && npm install -g || sudo npm install -g

# Install rules on Linux
if [ "$(uname)" != "Darwin" ]; then
  sudo tee /etc/udev/rules.d/10-tessel.rules > /dev/null << EOF
ATTRS{idVendor}=="1fc9", ATTRS{idProduct}=="0002", MODE="0666"
ATTRS{idVendor}=="1fc9", ATTRS{idProduct}=="2002", ENV{ID_MM_DEVICE_IGNORE}="1", MODE="0666"
ATTRS{idVendor}=="1d50", ATTRS{idProduct}=="6097", ENV{ID_MM_DEVICE_IGNORE}="1", MODE="0666"
EOF
  sudo udevadm control --reload-rules
fi