#!/usr/bin/env python

import os
import re
import sys

root = "."
if len(sys.argv) > 1:
  root = sys.argv[1]
#print "root: ", root

#---------------------------------------------
# check labels
#---------------------------------------------

dtdFile = open(os.path.join(root,"ui","locale","en-US","enigmail.dtd"),"r")
propFile = open(os.path.join(root,"ui","locale","en-US","enigmail.properties"),"r")
dtdLabels = dtdFile.read()
propLabels = propFile.read()
allLabelLines = dtdLabels + propLabels


allMissingLabels = []
numLabels = 0

def checkLabel (label, fromFilename):
  global numLabels
  numLabels += 1
  # special handling of used thunderbird labels:
  if label.startswith("copyCmd."):
    return
  pos = allLabelLines.find(label)
  if pos < 0:
    print "MISSING LABEL: " + label
    global allMissingLabels
    allMissingLabels += [ (label, fromFilename) ]
  elif allLabelLines.find(label,pos+1) > 0:
    print "LABEL TWICE: " + label
    sys.exit(1)



def checkProperty (label, fromFilename):
  global numLabels
  numLabels += 1
  # special handling of used thunderbird labels:
  if label.startswith("copyCmd."):
    return
  # in messengercompose.dtd of thunderbird:
  if label == "12511":
    return
  # thunderbird labels:
  if label == "setKeyExpirationDateFailed" or label == "sendMessageCheckWindowTitle" or label == "sendMessageCheckLabel" or label == "sendMessageCheckSendButtonLabel" or label == "CheckMsg":
    return
  label = label + '='
  pos = propLabels.find(label)
  print "found: ", propLabels[pos-1:pos+20]
  while pos > 0 and (propLabels[pos-1] == '.' or propLabels[pos-1].isalnum()):
    pos = propLabels.find(label,pos+1)
    print "*found: ", propLabels[pos-1:pos+20]
  if pos < 0:
    print "MISSING PROPERTY LABEL: " + label
    global allMissingLabels
    allMissingLabels += [ (label, fromFilename) ]
  else:
    pos2 = propLabels.find(label,pos+1)
    while pos2 > 0 and (propLabels[pos2-1] == '.' or propLabels[pos2-1].isalnum()):
      pos2 = propLabels.find(label,pos2+1)
      print "*found: ", propLabels[pos2-1:pos2+20]
    if pos2 >= 0:
      print "LABEL TWICE: " + label
      sys.exit(1)


def checkXUL (filename):
  print "----------------------------------------"
  print " checkXUL() " + filename

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
    match = re.search('"&([^;"]*);"', line)
    if match:
      label = match.group(1)
      #print "  " + label
      checkLabel(label,filename)
    match = re.search('[csn]\.getString\("([^;"]*)"', line)
    if match:
      label = match.group(1)
      #print "  " + label
      checkProperty(label,filename)

def checkJS (filename):
  print "----------------------------------------"
  print " checkJS() " + filename

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
    #if re.search('getString\(', line):
    #  print line
    match = re.search('\.getString\("([^;"]*)"', line)
    if match:
      label = match.group(1)
      print "  " + label
      checkProperty(label,filename)
    match = re.search("\.getString\('([^;']*)'", line)
    if match:
      label = match.group(1)
      print "  " + label
      checkProperty(label,filename)


#---------------------------------------------
# check icons
#---------------------------------------------

# return all rows in CSS files that should be equal
def checkCSS (filename):
  print "----------------------------------------"
  print " checkCSS " + filename
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
        print "ERROR:"
      else:
        print "WARNING:"
      print " icon entries in "
      print "   ", classicCSS
      print " and"
      print "   ", file
      print " differ"
      #print len(rows)
      #print rows[-4]
      #print rows[-3]
      #print rows[-2]
      #print rows[-1]
      #print len(otherRows)
      #print otherRows[-4]
      #print otherRows[-3]
      #print otherRows[-2]
      #print otherRows[-1]
      print " first differences:"
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
          print rows[i]
          print otherRows[i]
          if diffs > 10:
            print "..."
            print "ERROR => ABORT"
            sys.exit(1)
      if diffs > 10:
        print "ERROR => ABORT"
        sys.exit(1)
      for i in range(min(len(rows),len(otherRows)),max(len(rows),len(otherRows))):
        if i >= len(rows):
          print "   only in", file + ":"
          print "     " + otherRows[i]
          # this is NOT an error
        elif i >= len(otherRows):
          print "   only in", classicCSS + ":"
          print "     " + rows[i]
          print "ERROR => ABORT"
          sys.exit(1)


def checkAllXULFiles():
  # check XUL files:
  path = os.path.join(root)
  for path, dirs, files in os.walk(path):
    for name in files:
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


def processLabelResults():
  # we currently have the following known
  # missing labels:
  #   enigmail.expertUser.label  (defined in ./ui/content/pref-enigmail-seamonkey.xul)
  #   enigmail.basicUser.label  (defined in ./ui/content/pref-enigmail-seamonkey.xul)
  # missing properties:
  #   keyMan.button.skip=  (defined in ./build/dist/modules/commonFuncs.jsm)
  #   noCardAvailable=  (defined in ./build/dist/modules/keyManagement.jsm)
  #   keyMan.button.skip=  (defined in ./package/commonFuncs.jsm)
  #   noCardAvailable=  (defined in ./package/keyManagement.jsm)
  #   setKeyExpirationDateFailed=  (defined in ./ui/content/enigmailEditKeyExpiryDlg.js)
  #   12511=  (defined in ./ui/content/enigmailMsgComposeOverlay.js)
  #   sendMessageCheckWindowTitle=  (defined in ./ui/content/enigmailMsgComposeOverlay.js)
  #   sendMessageCheckLabel=  (defined in ./ui/content/enigmailMsgComposeOverlay.js)
  #   sendMessageCheckSendButtonLabel=  (defined in ./ui/content/enigmailMsgComposeOverlay.js)
  #   CheckMsg=  (defined in ./ui/content/enigmailMsgComposeOverlay.js)
  knownLabelBugs=0
  if len(allMissingLabels) != knownLabelBugs:
    print ""
    print "All Missing Labels:"
    print "==================="
    for missing in allMissingLabels:
      print "  ", missing[0], " (defined in " + missing[1] + ")"
    print "missing ", len(allMissingLabels), "out of", numLabels, "labels"
    sys.exit(1)
  else:
    print "all", numLabels, "labels (except the", knownLabelBugs, "standard errors) are fine"

    # check lables loaded with getString()
    # for each file with suffix js|jsm/xul
    path = os.path.join(root)
    for path, dirs, files in os.walk(path):
      for name in files:
        if name.endswith((".xul")):
          filename = os.path.join(path,name)
          checkXUL(filename)


#---------------------------------------------
# main()
#---------------------------------------------

# after inits on top...

print ""
checkAllXULFiles()
print ""
checkAllJSFiles()
print ""
processLabelResults()
print ""
checkAllCSSFiles()

