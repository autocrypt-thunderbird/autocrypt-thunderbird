#!/usr/bin/perl
# check for missing entries in language specific dtd and properties files
# and add the english default for them

sub trim { # ($str)
  my $str = @_[0];

  $str =~ s/\s*$//;
  $str =~ s/^\s*//;

  return $str;
}

# Load DTD file
sub loaddtd { # ($file)
  my $file = @_[0];

  #print "+ Loading $file\n";
  my $tab={};
  my $line=0;


  my $fic;
  my $ind;
  my $val;

  open($fic, $file) || die "Could not open $file";
  my $prev=0;

  while (<$fic>) {
    my $buf = $_;
    ++$line;
    $buf =~ s/\n//;
    $buf =~ s/\r//;
    if (length(trim($buf)) == 0) {
      #print "+ empty\n";
    }
    elsif ($buf =~ /^<!--.*-->$'/i) {
      #print "+ comment\n";
    }
    elsif ($buf =~ /^<!ENTITY (.*)"">\s*$'/i) {
      print "empty string $1\n";
      next;
    }
    elsif ($buf =~ /^<!ENTITY (.*)"(.*)">\s*$'/i) {
      $ind=trim($1);
      #print "+ Line  '$ind'\n";
      $val=$2;
      if ($ind eq "enigmail.ruleEmail.tooltip"
          || $ind eq "enigmail.noHushMailSupport.label"
          || $ind eq "enigmail.noHushMailSupport.tooltip") {
        $val =~ s/\</&lt;/g;
        $val =~ s/\>/&gt;/g;
      }
      $tab->{$ind} = "$1\"$val\">";
      $prev=0;
    }
    elsif ($buf =~ /^<!ENTITY (.*)"(.*)$/i) {
      $ind=trim($1);
      #print "+ Start '$ind'\n";
      $tab->{$ind} = "$1\"$2";
      $prev=$ind;
    }
    elsif ($prev && $buf =~ /^(.*)">$/) {
      #print "+ End   '$prev'\n";
      $tab->{$prev} .= "\n$1\">";
      $prev=0;
    }
    elsif ($prev) {
      #print "+ Cont. '$prev'\n";
      $tab->{$prev} .= "\n$buf";
    }
    else {
      die ("- in $file on line $line: unknown ($buf). ABORT!\n");
    }
  }
  close($fic);

  return $tab;
}

# Load properties file
sub loadprop { # ($file)

  my $file = @_[0];

  #print "+ Loading $file\n";
  my $tab={};

  my $fic;
  my $ind;

  open($fic, $file) || die "Could not open $file";

  while (<$fic>) {
    my $buf = $_;
    $buf =~ s/\n//;
    $buf =~ s/\r//;

    if (length(trim($buf)) == 0) {
      #print "+ empty\n";
    }
    elsif ($buf =~ /^\s*#/) {
      #print "+ comments\n";
    }
    elsif ($buf =~ /^\s*([A-Za-z0-9._]+)\s*=\s*(.*)/) {
      #print "+ Value '$1'\n";
      $ind=trim($1);
      $tab->{$ind} = "$1=$2";
    }
    else {
      print ("\tIgnored ($buf) !\n");
    }
  }

  return $tab;
}


($#ARGV > 0) || die ("usage fixlang.pl fromdir destdir\n   fromdir: original en-US locale directory\n   destdir: locale lanugage dir\n");
my $from=$ARGV[0];
my $dest=$ARGV[1];

(-f "$from/enigmail.dtd")        || die ("$from/enigmail.dtd not found\n");
(-f "$dest/enigmail.dtd")        || die ("$dest/enigmail.dtd not found\n");
(-f "$from/enigmail.properties") || die ("$from/enigmail.properties not found\n");
(-f "$dest/enigmail.properties") || die ("$dest/enigmail.properties not found\n");

my $endtd = loaddtd("$from/enigmail.dtd");
my $frdtd = loaddtd("$dest/enigmail.dtd");

print "+ Writing $dest/enigmail.dtd\n";
open(OUT, ">$dest/enigmail.dtd.gen")  || die "Cannot write to $dest/enigmail.dtd";

for my $ind (sort keys %$endtd) {

  if ($frdtd->{$ind}) {
    print OUT "<!ENTITY $frdtd->{$ind}\n";
  }
  else {
    # print "\tAdding missing $ind\n";
    print OUT "<!ENTITY $endtd->{$ind}\n";
  }
}

close(OUT);

my $enprop = loadprop("$from/enigmail.properties");
my $frprop = loadprop("$dest/enigmail.properties");

print "+ Writing $dest/enigmail.properties\n";
open(OUT, ">$dest/enigmail.properties.gen") || die "Cannot write to $dest/enigmail.properties";
for my $ind (sort keys %$enprop) {
  if ($frprop->{$ind}) {
    print OUT "$frprop->{$ind}\n";
  } else {
    #print "\tAdding missing $ind\n";
    print OUT "$enprop->{$ind}\n";
  }
}
close(OUT);
