#!/usr/bin/perl

if (@ARGV != 3) {
    print "Usage: make-lang-xpi <la-RE> <version> <relative-bin-dir>\n";
    exit -1;
}

my ($lang, $vers, $bindir) = @ARGV;

my $pkg = "enigmail";
my $xpifile = "$pkg-$lang-$vers.xpi";

my ($dir, $cmd);

open INFILE, "../ui/$pkg-en-US.spec";
open OUTFILE, ">$lang/$pkg-$lang.spec";

while ($_ = <INFILE>) {
    #print STDERR $_;
    $_ =~ s/en-US/$lang/g;
    #print STDERR $_;
    print OUTFILE $_;
}

close INFILE;
close OUTFILE;

open INFILE, "../ui/install.js";
open OUTFILE, ">$lang/install.js";

while ($_ = <INFILE>) {
    #print STDERR $_;
    $_ =~ s/en-US/$lang/g;
    #print STDERR $_;
    print OUTFILE $_;
}

close INFILE;
close OUTFILE;

$dir = $lang;
$cmd = "zip -r ../$bindir/$xpifile install.js $pkg-$lang.spec";
print STDERR "cd $dir; $cmd\n";
chdir $dir;
system($cmd);

$cmd = "/bin/rm install.js $pkg-$lang.spec";
print STDERR "$cmd\n";
system($cmd);

$dir = "../$bindir/chrome";
$cmd = "cd $bindir/chrome; zip -g ../$xpifile $pkg-$lang.jar";
print STDERR "cd $dir; $cmd\n";
chdir $dir;
system($cmd);

print STDERR "make-lang-xpi: Created $bindir/$xpifile\n";
