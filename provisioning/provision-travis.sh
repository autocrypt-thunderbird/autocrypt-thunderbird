#!/usr/bin/env bash
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#

export DEBIAN_FRONTEND=noninteractive
echo "Provisioning ..."
curl -s "http://git.fedorahosted.org/cgit/mailcap.git/plain/mime.types" > mime.types
sudo apt-get install nodejs
sudo apt-get install npm
npm install -g eslint@2.12
sudo cp mime.types /etc/mime.types
sudo echo "deb http://deb.torproject.org/torproject.org sid main" >> /etc/apt/sources.list
gpg --keyserver keys.gnupg.net --recv 0xEE8CBC9E886DDD89
gpg --export A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89 | sudo apt-key add -
sudo apt-get update
sudo apt-get install deb.torproject.org-keyring
sudo apt-get install -y tor
sudo apt-get install -q -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" zip thunderbird xvfb gnupg2
wget -O /tmp/jsunit-0.1.4.xpi https://www.enigmail.net/jsunit/jsunit-0.1.4.xpi
sudo unzip /tmp/jsunit-0.1.4.xpi -d /usr/lib/thunderbird-addons/extensions/jsunit@enigmail.net
sudo /bin/bash -c "echo $TRAVIS_BUILD_DIR/build/dist > /usr/lib/thunderbird-addons/extensions/{847b3a00-7ab1-11d4-8f02-006008948af5}"
