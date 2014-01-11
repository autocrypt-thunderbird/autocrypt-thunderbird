# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

DEPTH = ..

define copyLang =
mkdir -p $(BUILD)/lang/$^
endef

include ../config/autoconf.mk

all: jar

languages = $(shell cat current-languages.txt)

prepFiles: 
	for l in $(languages); do \
	   $(DEPTH)/util/fixlang.pl $(DEPTH)/ui/locale/en-US $$l; \
	done
	

export: prepFiles
	mkdir -p $(BUILD)/lang
	$(PERL) $(DEPTH)/util/make-lang-xpi.pl current-languages.txt $(BUILD)/lang 

jar: export
	$(PYTHON) ../util/JarMaker.py -j $(DIST)/chrome -t . -f jar $(BUILD)/lang/jar.mn

clean:
	for l in $(languages); do \
	   rm -f $$l/enigmail.dtd.gen $$l/enigmail.properties.gen; \
	done
	rm -f $(BUILD)/lang/jar.mn
