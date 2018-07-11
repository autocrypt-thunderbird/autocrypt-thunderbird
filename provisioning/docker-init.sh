#!/usr/bin/env bash
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#

CURRENT_FILE=`realpath "$0"`
PROVISIONING_DIR=`dirname "$CURRENT_FILE"`
ENIGMAIL_ROOT=`dirname "$PROVISIONING_DIR"`

pushd .
cd $PROVISIONING_DIR

docker build -t enigmail-unit .

popd
