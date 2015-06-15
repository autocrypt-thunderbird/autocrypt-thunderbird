#!/usr/bin/env bash
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

export DEBIAN_FRONTEND=noninteractive
echo "Provisioning ..."
curl -s "http://git.fedorahosted.org/cgit/mailcap.git/plain/mime.types" > mime.types
sudo cp mime.types /etc/mime.types
sudo apt-get update
sudo apt-get install -q -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" zip thunderbird xvfb gnupg2
#sudo apt-get upgrade -q -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
wget -O /tmp/jsunit-0.1.xpi https://www.enigmail.net/jsunit/jsunit-0.1.xpi
sudo unzip /tmp/jsunit-0.1.xpi -d /usr/lib/thunderbird-addons/extensions/jsunit@enigmail.net
sudo /bin/bash -c "echo $TRAVIS_BUILD_DIR/build/dist > /usr/lib/thunderbird-addons/extensions/{847b3a00-7ab1-11d4-8f02-006008948af5}"
