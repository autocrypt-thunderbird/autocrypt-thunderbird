# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

DEPTH = ..

define copyLang =
mkdir -p $(BUILD)/lang/$^
endef

DO_FIX_LANG = 
NO_GEN_FILES = 

include ../config/autoconf.mk

ifneq ($(FIX_LANGUAGES),no)
DO_FIX_LANG = prepFiles
else
NO_GEN_FILES = -ng
endif

all: jar

ifneq ($(ENABLE_LANG),no)
languages = $(shell cat current-languages.txt)
EXPORT_CMD = $(PERL) $(DEPTH)/util/make-lang-xpi.pl $(NO_GEN_FILES) current-languages.txt $(BUILD)/lang
else
languages = 
EXPORT_CMD = echo "" > $(BUILD)/lang/jar.mn
endif

prepFiles: 
	for l in $(languages); do \
	   $(PERL) $(DEPTH)/util/fixlang.pl $(DEPTH)/ui/locale/en-US $$l; \
	done
	

export: $(DO_FIX_LANG)
	mkdir -p $(BUILD)/lang
	$(EXPORT_CMD)

jar: export
	$(PYTHON) ../util/JarMaker.py -j $(DIST) -t . -f flat $(BUILD)/lang/jar.mn

clean:
	for l in $(languages); do \
	   rm -f $$l/enigmail.dtd.gen $$l/enigmail.properties.gen; \
	done
	rm -f $(BUILD)/lang/jar.mn
