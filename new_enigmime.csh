#!/bin/csh

if ($# != 2) then
  echo 'Usage: new_enigmime.csh <old-version> <new-version>'
  exit -1
endif

set files = (build/Makefile.in build/install.js build/nsEnigModule.h)

echo "Enigmime: $1 --> $2? (y/n)"

set confirm=$<

if (($confirm != "y") && ($confirm != "Y")) then
  echo "Cancelled"
  exit -1
endif

echo globsub "gEnigmimeVersion =" $1 $2 ui/content/enigmailCommon.js
globsub "gEnigmimeVersion =" $1 $2 ui/content/enigmailCommon.js

echo globsub Version $1 $2 build/enigmime.spec
globsub Version $1 $2 build/enigmime.spec

echo globsub Requires "mozilla-enigmime = $1" "mozilla-enigmime = $2" package/enigmail.spec
globsub Requires "mozilla-enigmime = $1" "mozilla-enigmime = $2" package/enigmail.spec

echo globsub $1 $1 $2 $files
globsub $1 $1 $2 $files
