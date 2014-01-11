# Process this file with autoconf to produce a configure script.
AC_PREREQ(2.61)
min_automake_version="1.10"

AC_INIT([enigmail],[1.6], [http://www.enigmail.net])


AC_PATH_PROG(PYTHON, "python")
if test "x$PYTHON" = "x" ; then
  AC_MSG_ERROR([[python not found.]])
fi

AC_PATH_PROG(PERL,"perl")
if test "x$PERL" = "x" ; then
  AC_MSG_ERROR([[Perl not found.]])
fi

AC_PROG_CC
if test "x$ac_cv_prog_cc_c89" = "xno" ; then
  AC_MSG_ERROR([[No C-89 compiler found]])
fi

AC_CANONICAL_TARGET

changequote(,)dnl
BUILD_OS_ARCH=`$PERL config/getOsTarget.pl -o "$target_os" "$target_cpu" "$CC"`
BUILD_TARGET_CPU=`$PERL config/getOsTarget.pl -c "$target_os" "$target_cpu" "$CC"`
DLL_PREFIX=`$PERL config/getOsTarget.pl -dp "$target_os" "$target_cpu" "$CC"`
DLL_SUFFIX=`$PERL config/getOsTarget.pl -ds "$target_os" "$target_cpu" "$CC"`
changequote([,])dnl

AC_SUBST(BUILD_OS_ARCH)
AC_SUBST(BUILD_TARGET_CPU)
AC_SUBST(DLL_PREFIX)
AC_SUBST(DLL_SUFFIX)

AC_CONFIG_FILES([config/autoconf.mk])

AC_OUTPUT
