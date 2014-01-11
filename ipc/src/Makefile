# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

DEPTH		= ../..

include $(DEPTH)/config/autoconf.mk

OBJ_SUFF = o
#LDFLAGS =
#CFLAGS =

ifeq ($(OS_TARGET),Darwin)
LDFLAGS	+= -dynamiclib -install_name @executable_path/$(SHARED_LIBRARY) -compatibility_version 1 -current_version 1 -single_module
endif

ifeq ($(OS_TARGET),NetBSD)
LDFLAGS += -shared -Wl,-Bsymbolic
CFLAGS += -fPIC
endif

ifeq ($(OS_TARGET),FreeBSD)
LDFLAGS += -shared -Wl,-Bsymbolic
CFLAGS += -fPIC
endif

ifeq ($(OS_TARGET),OpenBSD)
LDFLAGS += -shared -Wl,-Bsymbolic
CFLAGS += -fPIC
endif

ifeq ($(OS_TARGET),HP-UX)
LDFLAGS += -Wl,-Bsymbolic
CFLAGS += -fPIC
endif

ifeq ($(OS_TARGET),OSF1)
LDFLAGS += -B symbolic
CFLAGS += -fPIC
endif

ifeq ($(OS_TARGET),Linux)
LDFLAGS += -shared -Wl,-Bsymbolic
CFLAGS += -fPIC
endif

ifeq ($(OS_TARGET),WINNT)
OBJ_SUFF = obj
endif

source = subprocess.c
objfiles = subprocess.$(OBJ_SUFF)
libname = $(DLL_PREFIX)subprocess-$(CPU_ARCH)$(DLL_SUFFIX)

all: install


$(objfiles): $(source)
	$(CC) $(CFLAGS) -Wno-return-type-c-linkage -c -o $(objfiles) $^

$(libname): $(objfiles)
	$(CC) $(LDFLAGS) -o $(libname) $(objfiles)

install: $(libname)
	$(DEPTH)/util/install -m 644 $(DIST)/platform/$(OS_TARGET)_$(CPU_ARCH)/lib $^

clean:
	rm -f $(objfiles) $(libname) $(DIST)/platform/$(OS_TARGET)_$(CPU_ARCH)/lib/$(libname)

tools:

export:
