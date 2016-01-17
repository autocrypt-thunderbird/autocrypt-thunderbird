# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


all: libs

DATE_FMT = +%Y%m%d-%H%M
SOURCE_DATE_EPOCH ?= $(shell date +%s)

# first try GNU /bin/date syntax; if that doesn't work, try BSD
# /bin/date syntax.  If that still fails, ignore SOURCE_DATE_EPOCH
ENIG_BUILD_DATE=$(shell TZ=UTC date $(DATE_FMT) -d "@$(SOURCE_DATE_EPOCH)" 2>/dev/null || \
                        TZ=UTC date -r "$(SOURCE_DATE_EPOCH)" $(DATE_FMT) || \
                        TZ=UTC date $(DATE_FMT) )

libs:
	echo '"use strict";' > enigmailBuildDate.js
	echo 'var EnigBuildDate="$(ENIG_BUILD_DATE)";' >> enigmailBuildDate.js
