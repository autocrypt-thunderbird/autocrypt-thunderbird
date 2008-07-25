Compiling
=========

In order to compile IPC, you first need to compile a part of Mozilla
(xulrunner, Firefox, Thunderbird etc) on your platform.
We recommend that you install the necessary components and set up your
environment according to the Mozilla build instructions
(http://developer.mozilla.org/en/docs/Build_Documentation)
and then follow the steps below.


1a. Compile the required parts of Mozilla by typing:

    make -f client.mk export

    in the root OBJDIR directory (or, if no OBJDIR is defined, in the
    root mozilla directory) to export the include files. Then type the
    following commands:

    cd modules/libreg
    make
    cd ../../xpcom/string
    make
    cd ..
    make
    cd obsolete (for Thunderbird and Seamonkey only)
    make

1b. Alternatively (instead of the step above) you can compile all of Mozilla by typing:

  make -f client.mk all


2. Compiling IPC

   a. After compiling Mozilla the source code, unpack the IPC source code in
      the mozilla/extensions directory in the pre-compiled Mozilla source tree.

   b. Compile the IPC module:

      cd extensions/ipc
      ./makemake -r
      make

      If you use OBJDIR, you have to run make from within OBJDIR/mailnews/ipc.
      Please read the information about using OBJDIR below.


Using OBJDIR when building IPC
==============================

The makemake reads the .mozconfig file to get the OBJDIR parameter.
However, @CONFIG-GUESS@ is not supported by makemake.

Alternatively OBJDIR can be specified with "makemake -o DIR".

Important: makemake has to be executed from mozilla/mailnews/ipc,
the build itself (i.e. make) has to executed from OBJDIR/mailnews/ipc.

Please note that if you want to specify OBJDIR manually, use
"makemake -o /path/to/objdir"
