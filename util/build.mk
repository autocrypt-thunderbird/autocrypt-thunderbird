PLY_INC_PATH = -I$(topsrcdir)/mozilla/other-licenses/ply

XPIDL_GEN_DIR		= _xpidlgen

MDDEPDIR = .deps

REPORT_BUILD = $(info $(notdir $<))

PYTHON_PATH = $(PYTHON) $(topsrcdir)/mozilla/config/pythonpath.py

MAKEJAR = $(PYTHON) $(topsrcdir)/mozilla/config/JarMaker.py \
	$(QUIET) -j $(FINAL_TARGET)/chrome \
	$(MAKE_JARS_FLAGS) $(XULPPFLAGS) $(DEFINES) $(ACDEFINES) \
	$(JAR_MANIFEST) $(VPATH)/jar.mn

ifneq ($(XPIDLSRCS),)
XPIDL_DEPS = \
  $(LIBXUL_DIST)/sdk/bin/header.py \
  $(LIBXUL_DIST)/sdk/bin/typelib.py \
  $(LIBXUL_DIST)/sdk/bin/xpidl.py \
  $(NULL)

xpidl-preqs = \
  $(call mkdir_deps,$(XPIDL_GEN_DIR)) \
  $(call mkdir_deps,$(MDDEPDIR)) \
  $(NULL)

XPIDL_HEADERS_FILES := $(patsubst %.idl,$(XPIDL_GEN_DIR)/%.h, $(XPIDLSRCS))
XPIDL_HEADERS_DEST := $(DIST)/include
XPT_MODULE_DEST := $(DIST)/bin/components


# generate intermediate .xpt files into $(XPIDL_GEN_DIR), then link
# into $(XPIDL_MODULE).xpt and export it to $(FINAL_TARGET)/components.
$(XPIDL_GEN_DIR)/%.xpt: %.idl $(XPIDL_DEPS) $(xpidl-preqs)
	 $(srcdir)/../util/xptgen $(PYTHON) $(topsrcdir) $(srcdir) $(DEPTH) $@ ; \
	 $(INSTALL) $(patsubst %.xpt,%.h, $@) $(XPIDL_HEADERS_DEST)

XPT_PY = $(filter %/xpt.py,$(XPIDL_LINK))

xpidl-idl2xpt = $(patsubst %.idl,$(XPIDL_GEN_DIR)/%.xpt,$(XPIDLSRCS))
xpidl-module-deps = $(xpidl-idl2xpt) $(GLOBAL_DEPS) $(XPT_PY)

$(XPIDL_GEN_DIR)/$(XPIDL_MODULE).xpt: $(xpidl-module-deps)
	$(XPIDL_LINK) $@ $(xpidl-idl2xpt) ; \
	$(XPIDL_LINK) $@ $(xpidl-idl2xpt) ; \
	$(INSTALL) $@ $(XPT_MODULE_DEST)

endif
