#!perl
#
#  This Source Code Form is subject to the terms of the Mozilla Public
#  License, v. 2.0. If a copy of the MPL was not distributed with this
#  file, You can obtain one at https://mozilla.org/MPL/2.0/.
#


#  Helper tool to read or write data to/from stdin/stdout
#
#  Usage:
#  IpcCat {write|read|dump|getenv|caesar|quick} [arg [arg2]]
#
#  Parameters:
#    write:  read from stdin and write to file <arg>
#    read:   read from file <arg> and write to stdout
#    dump:   read from stdin; write to stdout
#    getenv: print value of environment variable <arg>
#    quick:  print Hello and exit
#    caesar: do a caesar cipher between FDs arg and arg2
#
#  Exit codes:
#    0:    success
#    > 0:  failure

use Env;

sub readFile {
  my $fn = $_[0];
  open IN, $fn or die $!;

  my $r = "";
  while (<IN>) {
    $r .= $_;
  }
  close IN;

  return $r;
}

if ($#ARGV < 0) {
  exit(1);
}

#$| = 1; # disable buffering of output

# wait a little before doing anything
#select(undef, undef, undef, 0.1);

if ($ARGV[0] =~ /^quick/i) {
  print "Hello\n";
  exit(0);
}
elsif ($ARGV[0] =~ /^dump$/i) {
  print STDERR "Starting dump\n";

  my $buf = readFile("-");
  print $buf;
  print STDERR sprintf("Dumped %d bytes\n", length($buf));
}
elsif ($ARGV[0] =~ /^caesar$/i) {
  my ($infd, $outfd) = (int($ARGV[1]), int($ARGV[2]));
  print STDERR "Starting caesar cipher transfer between file descriptors $infd and $outfd\n";
  open(OF, ">&".$outfd) or die $!;

  my $buf = readFile("<&".$infd);
  $buf =~ tr/a-zA-Z/n-za-mN-ZA-M/;
  print OF $buf;
  close(OF);
  print STDERR sprintf("Dumped %d bytes\n", length($buf));
}
elsif ($ARGV[0] =~ /^read$/i) {
  print STDERR "Starting read\n";

  my $buf = readFile($ARGV[1]);
  print $buf;

  print STDERR sprintf("Read %d bytes\n", length($buf));
}
elsif ($ARGV[0] =~ /^write$/i) {
  my $of = $ARGV[1];
  open(OF, ">$of") or die $!;
  print STDERR "Starting write\n";

  my $buf = readFile("-");

  print OF $buf;
  close(OF);

  print STDERR sprintf("Wrote %d bytes\n", length($buf));
}
elsif ($ARGV[0] =~ /^getenv$/i) {
  print STDERR sprintf("Reading environment variable %s\n", $ARGV[1]);
  print STDOUT $ENV{$ARGV[1]};
}
else {
  print STDERR "Invalid arguments\n";
  exit(1);
}

exit(0);
