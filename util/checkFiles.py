#!/usr/bin/env python

import os
import re
import sys

root = "."
if len(sys.argv) > 1:
  root = sys.argv[1]
#print "root: ", root

dtdFile = open(os.path.join(root,"ui","locale","en-US","enigmail.dtd"),"r")
propFile = open(os.path.join(root,"ui","locale","en-US","enigmail.properties"),"r")
allLabelLines = dtdFile.read() + propFile.read()


allMissingLabels = []
numLabels = 0

def checkXUL (file):
  print "----------------------------------------"
  print " processing " + filename

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
  print "all", numLabels, "labels (instead 6 standard errors) are fine"


# try to find the labels in dtd and properties file

