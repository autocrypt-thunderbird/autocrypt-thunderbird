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
allLabelLines = dtdFile.read() + propFile.read()


allMissingLabels = []
numLabels = 0

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
    match = re.search('("&)([^;"]*)(;")', line)
    if match:
      label = match.group(2)
      #print "  " + label
      global numLabels
      numLabels += 1
      # special handling of used thunderbird labels:
      if label.startswith("copyCmd."):
        continue
      if allLabelLines.find(label) < 0:
        print "MISSING LABEL: " + label
        global allMissingLabels
        allMissingLabels += [ (label, filename) ]
        

# for each file with suffix xul
path = os.path.join(root)
for path, dirs, files in os.walk(path):
  for name in files:
    if name.endswith((".xul")):
      filename = os.path.join(path,name)
      checkXUL(filename)

# we currently have:
#   enigmail.expertUser.label  (defined in ./ui/content/pref-enigmail-seamonkey.xul)
#   enigmail.basicUser.label  (defined in ./ui/content/pref-enigmail-seamonkey.xul)
if len(allMissingLabels) != 2:
  print ""
  print "All Missing Labels:"
  print "==================="
  for missing in allMissingLabels:
    print "  ", missing[0], " (defined in " + missing[1] + ")"
  print "out of", numLabels, "labels"
  sys.exit(1)
else:
  print "all", numLabels, "labels (instead 2 standard errors) are fine"


#---------------------------------------------
# check icons
#---------------------------------------------

print ""

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
    match = re.search('list-style-image.*enig[SE].*;', line)
    if match:
      row = match.group()
      #print "  " + row
      response += [row.strip().replace(' ','')]
  return response      

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
    print "NOTE:"
    print " icon entries in "
    print "   ", classicCSS
    print " and"
    print "   ", file
    print " differ"
    #print len(rows)
    #print len(otherRows)
    print " first difference:"
    for i in range(0,max(len(rows),len(otherRows))):
      if i >= len(rows):
        print "   only in", file + ":"
        print "     " + otherRows[i]
        # this is NOT an error
      elif i >= len(otherRows):
        print "   only in", classicCSS + ":"
        print "     " + otherRows[i]
        print "ERROR => ABORT"
        sys.exit(1)
      elif rows[i] != otherRows[i]:
        print rows[i]
        print otherRows[i]
        print "ERROR => ABORT"
        sys.exit(1)
        break

  
