#ifndef _MIMEDUMMY_H_
#define _MIMEDUMMY_H_

#include "mimecont.h"
#include "mimecryp.h"
#include "mimeenig.h"
#include "nsCRT.h"
#include "nspr.h"

typedef struct MimeDummyClass MimeDummyClass;
typedef struct MimeDummy      MimeDummy;

struct MimeDummyClass {
  MimeContainerClass container;

};

extern MimeContainerClass* mimeContainerClassP;
extern MimeEncryptedClass* mimeEncryptedClassP;

extern MimeDummyClass mimeDummyClass;

struct MimeDummy {
  MimeContainer container;		 /* superclass variables */
};

#endif /* _MIMEDUMMY_H_ */
