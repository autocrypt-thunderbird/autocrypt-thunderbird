# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


all: libs

SOURCE_DATE_EPOCH ?= $(shell date +%s)

libs:
	echo 'var EnigBuildDate="'`TZ=UTC date +%Y%m%d-%H%M -d @$(SOURCE_DATE_EPOCH)`'";' > enigmailBuildDate.js
