#!/usr/bin/perl

# generate jar.mn from a list of language packs

if (@ARGV != 2) {
    print "Usage: make-lang-xpi.pl <input-file> <output-dir>\n";
    exit -1;
}

my ($inputfile, $outdir) = @ARGV;

open INFILE, "$inputfile";
open OUTFILE, ">$outdir/jar.mn";

print OUTFILE "enigmail.jar:\n";

my @files = ("contents.rdf",
  "enigmail.properties",
  "enigmail.dtd",
  "am-enigprefs.properties",
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
