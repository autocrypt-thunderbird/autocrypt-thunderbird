#!/usr/bin/env bash
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#

if command -v realpath>/dev/null 2>&1; then
    CURRENT_FILE=`realpath "$0"`
else
    CURRENT_FILE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/$(basename $0)"
fi
PROVISIONING_DIR=`dirname "$CURRENT_FILE"`
ENIGMAIL_ROOT=`dirname "$PROVISIONING_DIR"`

docker run -v $ENIGMAIL_ROOT:/enigmail-src -i -u testuser -t enigmail-unit ./test.sh "$@"
