#ifndef _MIMEENIG_H_
#define _MIMEENIG_H_

#include "mimedummy.h"

typedef struct MimeEncryptedEnigClass MimeEncryptedEnigClass;
typedef struct MimeEncryptedEnig      MimeEncryptedEnig;

struct MimeEncryptedEnigClass {
  MimeEncryptedClass encrypted;
};

extern MimeEncryptedEnigClass mimeEncryptedEnigClass;

struct MimeEncryptedEnig {
  MimeEncrypted encrypted;
};

#endif /* _MIMEENIG_H_ */
