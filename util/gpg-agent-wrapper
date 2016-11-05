#!/bin/sh

# Wrapper script for launching gpg-agent

GPG_AGENT=$1
TMPFILE=$2
shift 2

$GPG_AGENT "$@" > $TMPFILE 2>&1

exit 0
