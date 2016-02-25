# Process this file with autoconf to produce a configure script.
AC_PREREQ(2.61)
min_automake_version="1.10"

AC_INIT([enigmail],[2.0], [https://www.enigmail.net])


AC_PATH_PROG(PYTHON, "python2")

# fallback to python if python2 does not exist
if test "x$PYTHON" = "x" ; then
  AC_PATH_PROG(PYTHON, "python")
fi

if test "x$PYTHON" = "x" ; then
  AC_MSG_ERROR([[python2 or python not found.]])
fi


AC_PATH_PROG(PERL,"perl")
if test "x$PERL" = "x" ; then
  AC_MSG_ERROR([[Perl not found.]])
fi

AC_CANONICAL_TARGET

# Enable running of unit test during build
#
AC_ARG_ENABLE(tests,
    AC_HELP_STRING([--enable-tests],[run unit tests during build process]),
    enable_tests=$enableval)

# Disable creation of languages other than en-US (for submitting to babelzilla)
#
AC_ARG_ENABLE(lang,
    AC_HELP_STRING([--disable-lang],[disable creation of locales other than en-US]),
    enable_lang=$enableval,
    enable_lang=yes
    )


AC_SUBST(enable_tests)
AC_SUBST(enable_lang)


AC_ARG_WITH(tb-path,
        [  --with-tb-path=/path/to/thunderbird  set the path to an installed Thunderbird],
        [if test "$withval" = yes ; then
           withval=no
        elif test "$withval" != no ; then
           TB_PATH="$withval"
        fi],withval=no)

AC_SUBST(TB_PATH)

AC_ARG_WITH(tb-args,
        [  --with-tb-args="-P profilename"  set additional arguments for Thunderbird],
        [if test "$withval" = yes ; then
           withval=no
        elif test "$withval" != no ; then
           TB_ARGS="$withval"
        fi],withval=no)

AC_SUBST(TB_ARGS)


AC_ARG_ENABLE(fix-lang,
    AC_HELP_STRING([--disable-fix-lang],[disable replacing of missing strings in localizations with en-US]),
    enable_fix_lang=$enableval,
    enable_fix_lang=yes
    )

AC_SUBST(enable_fix_lang)

AC_CONFIG_FILES([config/autoconf.mk])

AC_OUTPUT
