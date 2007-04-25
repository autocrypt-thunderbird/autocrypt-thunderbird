#!/usr/bin/perl

# generate jar.mn from a list of language packs

if (@ARGV != 1) {
    print "Usage: make-lang-xpi.pl <input-file>\n";
    exit -1;
}

my ($inputfile) = @ARGV;

open INFILE, "$inputfile";
open OUTFILE, ">jar.mn";

print OUTFILE "enigmail-locale.jar:\n";

while ($_ = <INFILE>) {
  #print STDERR $_;
  chomp();
  $lang = $_;
  printf OUTFILE "\tlocale/%s/enigmail\t(%s/am-enigprefs.properties)\n", $lang, $lang;
}

close INFILE;
close OUTFILE;
