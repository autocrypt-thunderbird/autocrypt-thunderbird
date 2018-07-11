#!/usr/bin/perl

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

#
# generate jar.mn from a list of language packs
#


sub usage() {
    print "Usage: make-lang-xpi.pl [-ng] <input-file> <output-dir>\n";
}

if (@ARGV != 2 && @ARGV != 3) {
    usage();
    exit -1;
}

my $useGen = "+";
my ($inputfile, $outdir);

if ($ARGV[0] eq "-ng") {
  ($useGen, $inputfile, $outdir)= @ARGV;
}
else {
  ($inputfile, $outdir) = @ARGV;
}

open INFILE, "$inputfile";
open OUTFILE, ">$outdir/jar.mn";

print OUTFILE "chrome.jar:\n";

my @genFiles = (
  "enigmail.properties",
  "enigmail.dtd"
);

my @files = (
  "am-enigprefs.properties",
  "help/compose.html",
  "help/editRcptRule.html",
  "help/messenger.html",
  "help/rulesEditor.html",
  "help/sendingPrefs.html",
);


while ($_ = <INFILE>) {
  #print STDERR $_;
  chomp();
  $lang = $_;
  foreach $file (@genFiles) {
    if ($useGen eq "+") {
      printf OUTFILE "\tlocale/%s/%s\t(%s/%s.gen)\n", $lang, $file, $lang, $file;
    }
    else {
      printf OUTFILE "\tlocale/%s/%s\t(%s/%s)\n", $lang, $file, $lang, $file;
    }
  }

  foreach $file (@files) {
    printf OUTFILE "\tlocale/%s/%s\t(%s/%s)\n", $lang, $file, $lang, $file;
  }
}

close INFILE;
close OUTFILE;
