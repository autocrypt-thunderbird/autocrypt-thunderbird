#!/usr/bin/env python

from __future__ import print_function
import os
import re
import sys

root = "."
if len(sys.argv) > 1:
  root = sys.argv[1]
#print "root: ", root


#################################################################
# read in label and property files:
#################################################################

# read in dtd labels and check for duplicates:
dtdFilename = os.path.join(root,"ui","locale","en-US","enigmail.dtd")
dtdLabels = re.findall(r'ENTITY[ \t]*(enigmail[^ \t"]*)[ \t]*"', open(dtdFilename).read())
#print dtdLabels
#print len(dtdLabels)
dtdLabels.sort()
prev=None
for label in dtdLabels:
  if label == prev:
    print("DUPLICATE label in enigmail.dtd file:", label)
    sys.exit(1)

# read in property labels and check for duplicates:
propFilename = os.path.join(root,"ui","locale","en-US","enigmail.properties")
propLabels = []
for line in open(propFilename, 'r'):
  if re.match('[ \t]*#.*', line):
    continue
  match = re.match('[ \t]*([^ \t=]+)[ \t]*=.*', line)
  if match:
    label = match.group(1)
    #print label
    propLabels += [label]
#print propLabels
#print len(propLabels)
propLabels.sort()
prev=None
for label in propLabels:
  if label == prev:
    print("DUPLICATE property in enigmail.properties file:", label)
    sys.exit(1)


#################################################################
# used thunderbird labels and properties:
#################################################################

tbLabels = [
             "12511",
             "copyCmd.accesskey",
             "copyCmd.label",
             "sendMessageCheckWindowTitle",
             "sendMessageCheckLabel",
             "sendMessageCheckSendButtonLabel",
             "CheckMsg",
             "FNC_enigmailVersion",
             "FNC_isGpgWorking",
           ]


#################################################################
# read in label and property files:
#################################################################


allMissingLabels = []
allFoundLabels = []
numLabels = 0

def checkLabel (label, fromFilename):
  global numLabels
  numLabels += 1
  # ignore used thunderbird labels:
  if label in tbLabels:
    return
  if label in dtdLabels:
    global allFoundLabels
    if not label in allFoundLabels:
      allFoundLabels += [label]
  else:
    print("MISSING LABEL: " + label)
    global allMissingLabels
    allMissingLabels += [ (label, fromFilename) ]

allMissingProps = []
allFoundProps = []
numProps = 0

def checkProperty (label, fromFilename):
  global numProps
  numProps += 1
  # ignore used thunderbird labels:
  if label in tbLabels:
    return
  # ignore "keyAlgorithm_..."
  if label.find("keyAlgorithm_") == 0:
    return
  # ignore "errorType..."
  if label.find("errorType") == 0:
    return
  if label in propLabels:
    global allFoundProps
    if not label in allFoundProps:
      allFoundProps += [label]
  else:
    print("MISSING PROPERTY: " + label)
    global allMissingProps
    allMissingProps += [ (label, fromFilename) ]


#################################################################
# check XUL files:
#################################################################

allLines = ""

def checkXUL (filename):
  # print "----------------------------------------"
  print(" checkXUL() " + filename)

  global allLines
  allLines += open(filename, 'r').read()

  inComment = False
  for line in open(filename, 'r'):
    # process comments
    # - can't deal with multiple comments in one line
    if inComment:
      commentEnd = line.find("-->")
      if (commentEnd >= 0):
        # end of multiline comment:
        line = line[commentEnd+3:]
        #print line
        inComment = False
      else:
        # stay inside multiline comment:
        #print "ignore: ", line
        continue
    commentBeg = line.find("<!--")
    if commentBeg >= 0:
      #print line
      commentEnd = line.find("-->",commentBeg)
      if (commentEnd >= 0):
        # comment in one line:
        line = line[0:commentBeg] + line[commentEnd+3:]
        #print line
      else:
        # begin of multiline comment:
        line = line[0:commentBeg]
        inComment = True

    # extract and check labels:
    match = re.search('&([^;"<]*);', line)
    if match:
      label = match.group(1)
      #print "  " + label
      checkLabel(label,filename)
    match = re.search('[csn]\.getString *\("([^;"]*)"', line)
    if match:
      label = match.group(1)
      #print "  " + label
      checkProperty(label,filename)
    matches = re.findall('EnigGetString *\("([^;"]*)"', line)
    for label in matches:
      #print "  " + label
      checkProperty(label,filename)
    matches = re.findall("EnigGetString *\('([^;']*)'", line)
    for label in matches:
      #print "  " + label
      checkProperty(label,filename)
    matches = re.findall('\.onError *\("([^;"]*)"', line)
    for label in matches:
      #print "  " + label
      checkProperty(label,filename)


def checkJS (filename):
  #print "----------------------------------------"
  print(" checkJS() " + filename)

  global allLines
  allLines += open(filename, 'r').read()

  inComment = False
  for line in open(filename, 'r'):
    # process comments
    # - can't deal with multiple comments in one line
    if inComment:
      commentEnd = line.find("*/")
      if (commentEnd >= 0):
        # end of multiline comment:
        line = line[commentEnd+2:]
        #print line
        inComment = False
      else:
        # stay inside multiline comment:
        #print "ignore: ", line
        continue
    commentBeg = line.find("/*")
    if commentBeg >= 0:
      #print line
      commentEnd = line.find("*/",commentBeg)
      if (commentEnd >= 0):
        # comment in one line:
        line = line[0:commentBeg] + line[commentEnd+3:]
        #print line
      else:
        # begin of multiline comment:
        line = line[0:commentBeg]
        inComment = True
    commentBeg = line.find("//")
    if commentBeg >= 0:
      line = line[0:commentBeg]

    # extract and check labels:
    matches = re.findall('\.getString *\("([^;"]*)"', line)
    for label in matches:
      #print "  " + label
      checkProperty(label,filename)
    matches = re.findall("\.getString *\('([^;']*)'", line)
    for label in matches:
      #print "  " + label
      checkProperty(label,filename)
    matches = re.findall('EnigGetString *\("([^;"]*)"', line)
    for label in matches:
      #print "  " + label
      checkProperty(label,filename)
    matches = re.findall("EnigGetString *\('([^;']*)'", line)
    for label in matches:
      #print "  " + label
      checkProperty(label,filename)
    matches = re.findall('\.onError *\("([^;"]*)"', line)
    for label in matches:
      #print "  " + label
      checkProperty(label,filename)

def checkHTML (filename):
  # print "----------------------------------------"
  print(" checkHTML() " + filename)

  global allLines
  allLines += open(filename, 'r').read()

  inComment = False
  for line in open(filename, 'r'):
    # process comments
    # - can't deal with multiple comments in one line
    if inComment:
      commentEnd = line.find("-->")
      if (commentEnd >= 0):
        # end of multiline comment:
        line = line[commentEnd+3:]
        #print line
        inComment = False
      else:
        # stay inside multiline comment:
        #print "ignore: ", line
        continue
    commentBeg = line.find("<!--")
    if commentBeg >= 0:
      #print line
      commentEnd = line.find("-->",commentBeg)
      if (commentEnd >= 0):
        # comment in one line:
        line = line[0:commentBeg] + line[commentEnd+3:]
        #print line
      else:
        # begin of multiline comment:
        line = line[0:commentBeg]
        inComment = True

    # extract and check labels:
    matches = re.findall('txtId *= *"([^;"]*)"', line)
    for label in matches:
      #print "  " + label
      checkProperty(label,filename)

def checkAllXULFiles():
  # check XUL files:
  path = os.path.join(root)
  for path, dirs, files in os.walk(path):
    for name in files:
      #if name.endswith(".xul"):
      if name.endswith(".xul"):
        filename = os.path.join(path,name)
        checkXUL(filename)


def checkAllJSFiles():
  # check JS/JSM files:
  path = os.path.join(root)
  for path, dirs, files in os.walk(path):
    if str(path).find("build") < 0:
      for name in files:
        if name.endswith(".js") or name.endswith(".jsm"):
          filename = os.path.join(path,name)
          checkJS(filename)

def checkAllHtmlFiles():
  # check HTML files:
  path = os.path.join(root,"ui","content")
  for path, dirs, files in os.walk(path):
    for name in files:
      #if name.endswith(".html"):
      if name.endswith(".html"):
        filename = os.path.join(path,name)
        checkHTML(filename)

def processLabelResults():
  # Labels:
  knownLabelBugs=0
  if len(allMissingLabels) != knownLabelBugs:
    print("")
    print("All Missing Labels:")
    print("===================")
    for missing in allMissingLabels:
      print("  ", missing[0], " (defined in " + missing[1] + ")")
    print("missing ", len(allMissingLabels), "out of", numLabels, "labels")
    sys.exit(1)
  else:
    #print "all", numLabels, "labels (except the", knownLabelBugs, "standard errors) are defined"
    print("all", numLabels, "labels usages are defined")

  # Properties:
  knownPropBugs=0
  if len(allMissingProps) != knownPropBugs:
    print("")
    print("All Missing Properties:")
    print("=======================")
    for missing in allMissingProps:
      print("  ", missing[0], " (defined in " + missing[1] + ")")
    print("missing ", len(allMissingProps), "out of", numProps, "properties")
    sys.exit(1)
  else:
    #print "all", numProps, "properties (except the", knownPropBugs, "standard errors) are defined"
    print("all", numProps, "property usages are defined")

  unusedFile = open('unused.txt',"w")
  print("")
  print("=============================================")
  print("dtdLabels:     ", len(dtdLabels))
  print("found Labels:  ", len(allFoundLabels))
  unusedFile.write('unused labels:\n')
  numUnusedLabels=0
  for label in dtdLabels:
    if not label in allFoundLabels:
      #print "  ", label
      if allLines.find(label) >= 0:
        print("false positive (or correct because in comment)?: ", label)
      else:
        numUnusedLabels += 1
        unusedFile.write('  '+label+'\n')
  print("unused labels in 'unused.txt'")

  print("")
  print("=============================================")
  print("propLabels:    ", len(propLabels))
  print("found Props:   ", len(allFoundProps))
  unusedFile.write('\nunused properties:\n')
  numUnusedProps=0
  for label in propLabels:
    # ignore "keyAlgorithm_..."
    if label.find("keyAlgorithm_") == 0:
      continue
    # ignore "errorType..."
    if label.find("errorType") == 0:
      continue
    if not label in allFoundProps:
      #print "  ", label
      if allLines.find(label) >= 0:
        print("false positive (or correct because in comment)?: ", label)
      else:
        numUnusedProps += 1
        unusedFile.write('  '+label+'\n')
  print("unused props in 'unused.txt'")

  print("")
  print("=============================================")
  print("dtdLabels:     ", len(dtdLabels))
  print("found Labels:  ", len(allFoundLabels))
  print("UNUSED Labels: ", numUnusedLabels, "  (after double check)")
  print("=============================================")
  print("propLabels:    ", len(propLabels))
  print("found Props:   ", len(allFoundProps))
  print("UNUSED Props:  ", numUnusedProps, "  (after double check)")


#---------------------------------------------
# check icons
#---------------------------------------------

# return all rows in CSS files that should be equal
def checkCSS (filename):
  #print "----------------------------------------"
  print(" checkCSS " + filename)
  response = []
  for line in open(filename, 'r'):
    # grep status-bar and list-style-image rows
    # extract and check labels:
    match = re.search('#enigmail-status-bar.*{', line)
    if match:
      row = match.group()
      #print "  " + row
      response += [row.strip().replace(' ','')]
    match = re.search('list-style-image.*enig[ES].*;', line)
    if match:
      row = match.group()
      #print "  " + row
      response += [row.strip().replace(' ','')]
  return response

def checkAllCSSFiles ():
  # reference is classic/enigmail.css:
  classicCSS = os.path.join(root,"ui","skin","classic","enigmail.css")
  rows = checkCSS (classicCSS)
  #print "-----------"
  #print rows
  #print "-----------"
  # other CSS files:
  otherFiles = [
      os.path.join(root,"ui","skin","classic-seamonkey","enigmail.css"),
      os.path.join(root,"ui","skin","classic","enigmail-aero.css"),
      os.path.join(root,"ui","skin","modern","enigmail.css"),
      os.path.join(root,"ui","skin","tb-linux","enigmail.css"),
      os.path.join(root,"ui","skin","tb-mac","enigmail.css"),
  ];

  # find critical differences between CSS files:
  for file in otherFiles:
    otherRows = checkCSS (file)
    if rows != otherRows:
      if len(rows) > len(otherRows):
        print("ERROR:")
      else:
        print("WARNING:")
      print(" icon entries in ")
      print("   ", classicCSS)
      print(" and")
      print("   ", file)
      print(" differ")
      print(" first differences:")
      diffs = 0;
      for i in range(0,min(len(rows),len(otherRows))):
        #print "-------"
        #print rows[i]
        #print otherRows[i]
        if rows[i] != otherRows[i]:
          diffs += 1
          # this difference is OK:
          if rows[i].find("enigmail-settings.png") and otherRows[i].find("enigmail-send.png"):
            continue
          print(rows[i])
          print(otherRows[i])
          if diffs > 10:
            print("...")
            print("ERROR => ABORT")
            sys.exit(1)
      if diffs > 10:
        print("ERROR => ABORT")
        sys.exit(1)
      for i in range(min(len(rows),len(otherRows)),max(len(rows),len(otherRows))):
        if i >= len(rows):
          print("   only in", file + ":")
          print("     " + otherRows[i])
          # this is NOT an error
        elif i >= len(otherRows):
          print("   only in", classicCSS + ":")
          print("     " + rows[i])
          print("ERROR => ABORT")
          sys.exit(1)


#---------------------------------------------
# main()
#---------------------------------------------

# after inits on top...

print("")
checkAllXULFiles()
print("")
checkAllJSFiles()
print("")
checkAllHtmlFiles()
print("")
processLabelResults()
print("")
#checkAllCSSFiles()
