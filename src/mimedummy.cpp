#include "mimedummy.h"
#include "nsEnigMimeService.h"

MimeEncryptedClass* mimeEncryptedClassP = NULL;

/* Set superclass to NULL and initialize by hand later */
MimeDefClass(MimeDummy, MimeDummyClass, mimeDummyClass,
             NULL);

static int MimeDummy_initialize (MimeObject *);
static void MimeDummy_finalize (MimeObject *);
static int MimeDummy_parse_begin (MimeObject *);
#ifndef MOZ_16
static int MimeDummy_parse_buffer (const char *, PRInt32, MimeObject *);
#else
static int MimeDummy_parse_buffer (char *, PRInt32, MimeObject *);
#endif
static int MimeDummy_parse_line (char *, PRInt32, MimeObject *);
static int MimeDummy_parse_eof (MimeObject *, PRBool);
static int MimeDummy_parse_end (MimeObject *, PRBool);
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

        if (!nsCRT::strcasecmp(superclazz->class_name, "MimeEncrypted")) {
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


#ifndef MOZ_16
static int
MimeDummy_parse_buffer(const char *buffer, PRInt32 size, MimeObject *obj)
#else
static int
MimeDummy_parse_buffer(char *buffer, PRInt32 size, MimeObject *obj)
#endif
{
  return 0;
}


static int
MimeDummy_parse_line(char *line, PRInt32 length, MimeObject *obj)
{
  return 0;
}

static int
MimeDummy_parse_eof(MimeObject *obj, PRBool abort_p)
{
  return 0;
}


static int
MimeDummy_parse_end(MimeObject *obj, PRBool abort_p)
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
