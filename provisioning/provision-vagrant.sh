#!/usr/bin/env bash
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#

echo "Provisioning ..."
apt-get update
apt-get install -y zip thunderbird xvfb gnupg2
apt-get install -y xfce4 virtualbox-guest-dkms virtualbox-guest-utils virtualbox-guest-x11
apt-get install -y ntp
apt-get install -y rng-tools haveged
apt-get upgrade -y
wget -O /tmp/jsunit-0.1.4.xpi https://www.enigmail.net/jsunit/jsunit-0.1.4.xpi
rm -rf /usr/lib/thunderbird-addons/extensions/jsunit@enigmail.net
unzip /tmp/jsunit-0.1.4.xpi -d /usr/lib/thunderbird-addons/extensions/jsunit@enigmail.net
rm -rf '/usr/lib/thunderbird-addons/extensions/{847b3a00-7ab1-11d4-8f02-006008948af5}'
echo "/enigmail-src/build/dist" > '/usr/lib/thunderbird-addons/extensions/{847b3a00-7ab1-11d4-8f02-006008948af5}'
touch '/enigmail-src'
