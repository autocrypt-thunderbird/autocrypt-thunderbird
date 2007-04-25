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

my @files = ("contents.rdf",
  "enigmail.properties",
  "enigmail.dtd",
  "am-enigprefs.properties",
  "upgrade_080.html",
  "help/rulesEditor.html",
  "help/compose.html",
  "help/messenger.html",
  "help/editRcptRule.html");

while ($_ = <INFILE>) {
  #print STDERR $_;
  chomp();
  $lang = $_;
  foreach $file (@files) {
    printf OUTFILE "\tlocale/%s/enigmail/%s\t(%s/%s)\n", $lang, $file, $lang, $file;
  }
}

close INFILE;
close OUTFILE;
