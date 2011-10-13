/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <sarava@sarava.net> are
 * Copyright (C) 2002 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 * Patrick Brunschwig <patrick@mozilla-enigmail.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

#define MOZILLA_INTERNAL_API
#include "mimedummy.h"
#include "nsEnigMimeService.h"

MimeEncryptedClass* mimeEncryptedClassP = NULL;

/* Set superclass to NULL and initialize by hand later */
MimeDefClass(MimeDummy, MimeDummyClass, mimeDummyClass,
             NULL);

static int MimeDummy_initialize (MimeObject *);
static void MimeDummy_finalize (MimeObject *);
static int MimeDummy_parse_begin (MimeObject *);
static int MimeDummy_parse_buffer (const char *, PRInt32, MimeObject *);
static int MimeDummy_parse_line (const char *, PRInt32, MimeObject *);
static int MimeDummy_parse_eof (MimeObject *, EMBool);
static int MimeDummy_parse_end (MimeObject *, EMBool);
static int MimeDummy_add_child (MimeObject *, MimeObject *);

static int
MimeDummyClassInitialize(MimeDummyClass *clazz)
{
  MimeObjectClass    *oclass = (MimeObjectClass *)    clazz;
  MimeContainerClass *cclass = (MimeContainerClass *) clazz;

  PR_ASSERT(!oclass->class_initialized);
  oclass->initialize   = MimeDummy_initialize;
  oclass->finalize     = MimeDummy_finalize;
  oclass->parse_begin  = MimeDummy_parse_begin;
  oclass->parse_buffer = MimeDummy_parse_buffer;
  oclass->parse_line   = MimeDummy_parse_line;
  oclass->parse_eof    = MimeDummy_parse_eof;
  oclass->parse_end    = MimeDummy_parse_end;

  cclass->add_child    = MimeDummy_add_child;

  return 0;
}


static int
MimeDummy_initialize(MimeObject *obj)
{
  MimeObjectClass *clazz = obj->clazz;

  fprintf(stderr, "MimeDummy_initialize: class_name=%s\n", clazz->class_name);

  return 0;
}


static int
MimeDummy_parse_begin(MimeObject *obj)
{
  fprintf(stderr, "MimeDummy_parse_begin:\n");

  MimeObject *parent = obj->parent;

  MimeContainer* container = (MimeContainer *) parent;

  if (container) {
    PRInt32 nchildren = container->nchildren;
    fprintf(stderr, "MimeDummy_parse_begin: nchildren=%d\n",nchildren );

    if (nchildren == 2) {
      MimeObject* sibling = *(container->children);
      MimeObjectClass *clazz = sibling->clazz;

      fprintf(stderr, "MimeDummy_parse_begin: sibling class_name=%s\n", clazz->class_name);
      MimeObjectClass *superclazz = clazz->superclass;

      if (superclazz) {
        fprintf(stderr, "MimeDummy_parse_begin: sibling superclass_name=%s\n", superclazz->class_name);

        if (!PL_strcasecmp(superclazz->class_name, "MimeEncrypted")) {
          // mimeEncryptedClass
          fprintf(stderr, "MimeDummy_parse_begin: found MimeEncrypted\n");

          mimeEncryptedClassP = (MimeEncryptedClass *) superclazz;
          MimeObjectClass* objClass = (MimeObjectClass*) &mimeEncryptedEnigClass;
          objClass->superclass = (MimeObjectClass *) superclazz;

          nsresult rv;
          nsCOMPtr<nsIEnigMimeService> enigMimeService = do_GetService(NS_ENIGMIMESERVICE_CONTRACTID, &rv);
          if (NS_SUCCEEDED(rv)) {
            enigMimeService->Init();
          }

        }
      }

    }

  }

  return 0;
}


static int
MimeDummy_parse_buffer(const char *buffer, PRInt32 size, MimeObject *obj)
{
  return 0;
}


static int
MimeDummy_parse_line(const char *line, PRInt32 length, MimeObject *obj)
{
  return 0;
}

static int
MimeDummy_parse_eof(MimeObject *obj, EMBool abort_p)
{
  return 0;
}


static int
MimeDummy_parse_end(MimeObject *obj, EMBool abort_p)
{
  return 0;
}


static void
MimeDummy_finalize(MimeObject *obj)
{
}

static int
MimeDummy_add_child(MimeObject *parent, MimeObject *child)
{
  MimeContainer *cont = (MimeContainer *) parent;
  if (!parent || !child) return -1;

  /* Encryption containers can only have one child. */
  if (cont->nchildren != 0) return -1;

  return ((MimeContainerClass*)mimeContainerClassP)->add_child(parent, child);
}
