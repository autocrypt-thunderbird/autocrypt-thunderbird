#!/usr/bin/env perl

# Determin Target OS name and CPU type as used by Mozilla
# based on input from autoconf / configure

# usage:
# -c|-o  target_os target_cpu compiler
#
# -c : CPU and compiler type
# -o : OS type

if ($#ARGV != 3) {
  exit (1);
}

my $srcOs = $ARGV[1];
my $srcCpu = $ARGV[2];
my $srcComp = $ARGV[3];

my $targetOs = "";
my $targetCpu = "";
my $targetComp = "";
my $dllPrefix = "";
my $dllSuffix = "";

# determine OS-Name

if ($srcOs =~ /^darwin/i) {
  $targetOs = "Darwin";
}
elsif ($srcOs =~ /linux/i) {
  $targetOs = "Linux";
}
elsif ($srcOs =~ /FreeBSD/i) {
  $targetOs = "FreeBSD";
}
elsif ($srcOs =~ /OpenBSD/i) {
  $targetOs = "OpenBSD";
}
elsif ($srcOs =~ /NetBSD/i) {
  $targetOs = "NetBSD";
}
elsif ($srcOs =~ /OS2/i) {
  $targetOs = "OS2";
}
elsif ($srcOs =~ /aix/i) {
  $targetOs = "AIX";
}
elsif ($srcOs =~ /beos/i) {
  $targetOs = "BeOS";
}
elsif ($srcOs =~ /irix/i) {
  $targetOs = "IRIX64";
}
elsif ($srcOs =~ /hpux/i) {
  $targetOs = "HP-UX";
}
elsif ($srcOs =~ /(sun|solaris)/i) {
  $targetOs = "SunOS";
}
elsif ($srcOs =~ /(mingw|win)/i) {
  $targetOs = "WINNT";
}
else {
  $targetOs = $srcOs;
}

# determine CPU
if ($srcCpu =~ /x86[_-]64/i) {
  $targetCpu = "x86_64";
}
elsif ($srcCpu =~ /i[3456]86/i) {
  $targetCpu = "x86";
}
elsif ($srcCpu =~ /ppc/i) {
  $targetCpu = "ppc";
}
elsif ($srcCpu =~ /alpha/i) {
  $targetCpu = "Alpha";
}
elsif ($srcCpu =~ /sparc/i) {
  $targetCpu = "sparc";
}
elsif ($srcCpu =~ /ia64/i) {
  $targetCpu = "ia64";
}
elsif ($srcCpu =~ /arm/i) {
  $targetCpu = "arm";
}
else {
  $targetCpu = $srcCpu;
}

# determine Compiler
if ($targetOs eq "WINNT") {
  $targetComp = "msvc";
}
if ($srcComp =~ /^gcc/) {
  $targetComp = "gcc3";
}
elsif ($srcComp =~ /^cc/) {
  if ($targetOs eq "SunOS") {
    $targetComp = "sunc";
  }
  elsif ($targetOs eq "AIX") {
    $targetComp = "ibmc";
  }
}
else {
  $targetComp = $srcComp;
}

# determine DLL prefix

if ($targetOs eq "WINNT") {
  $dllSuffix = ".dll";
}
elsif ($targetOs eq "Darwin") {
  $dllPrefix = "lib";
  $dllSuffix = ".dylib";
}
else {
  $dllPrefix = "lib";
  $dllSuffix = ".so";
}

if ($ARGV[0] =~ /^-o$/i) {
  printf ($targetOs);
}
elsif ($ARGV[0] =~ /^-c$/i) {
  printf ("%s-%s", $targetCpu, $targetComp);
}
elsif ($ARGV[0] =~ /^-dp$/i) {
  printf ($dllPrefix);
}
elsif ($ARGV[0] =~ /^-ds$/i) {
  printf ($dllSuffix);
}
else {
  exit(1);
}

