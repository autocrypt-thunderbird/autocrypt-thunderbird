#!/bin/csh

if ($# != 2) then
  echo 'Usage: new_enigmail.csh <old-version> <new-version>'
  exit -1
endif

set files = (package/Makefile.in package/install.js ui/install.js lang/Makefile.in)

echo "Enigmail: $1 --> $2? (y/n)"

set confirm=$<

if (($confirm != "y") && ($confirm != "Y")) then
  echo "Cancelled"
  exit -1
endif

echo globsub "gEnigmailVersion =" $1 $2 ui/content/enigmailCommon.js
globsub "gEnigmailVersion =" $1 $2 ui/content/enigmailCommon.js

echo globsub Version $1 $2 package/enigmail.spec ui/enigmail-en-US.spec
globsub Version $1 $2 package/enigmail.spec ui/enigmail-en-US.spec

echo globsub Requires "mozilla-enigmail = $1" "mozilla-enigmail = $2" ui/enigmail-en-US.spec
globsub Requires "mozilla-enigmail = $1" "mozilla-enigmail = $2" ui/enigmail-en-US.spec

echo globsub $1 $1 $2 $files
globsub $1 $1 $2 $files
