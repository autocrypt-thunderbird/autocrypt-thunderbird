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
#include "mimecth.h"
#include "mimemoz2.h"
#include "mimeenig.h"
#include "nspr.h"
#include "plstr.h"
#include "nsCOMPtr.h"
#include "nsIURI.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsIMsgWindow.h"
#include "nsIEnigMimeDecrypt.h"

/* Set superclass to NULL and initialize by hand later */
MimeDefClass(MimeEncryptedEnig, MimeEncryptedEnigClass,
             mimeEncryptedEnigClass, NULL);

static void *MimeEnig_init(MimeObject *,
                           int (*output_fn) (const char *, PRInt32, void *),
                           void *);
static int MimeEnig_write (const char *, PRInt32, void *);
static int MimeEnig_eof (void *, PRBool);
static char* MimeEnig_generate (void *);
static void MimeEnig_free (void *);

// TEMPORARY; MOVE TO CLASS LATER
nsCOMPtr<nsIEnigMimeDecrypt> mMimeDecrypt;

static int
MimeEncryptedEnigClassInitialize(MimeEncryptedEnigClass *clazz)
{
  MimeObjectClass    *oclass = (MimeObjectClass *)    clazz;
  MimeEncryptedClass *eclass = (MimeEncryptedClass *) clazz;

  PR_ASSERT(!oclass->class_initialized);

  eclass->crypto_init          = MimeEnig_init;
  eclass->crypto_write         = MimeEnig_write;
  eclass->crypto_eof           = MimeEnig_eof;
  eclass->crypto_generate_html = MimeEnig_generate;
  eclass->crypto_free          = MimeEnig_free;

  return 0;
}


typedef struct MimeEnigData
{
  int (*output_fn) (const char *buf, PRInt32 buf_size, void *output_closure);
  void *output_closure;
  MimeObject *self;

  nsCOMPtr<nsIEnigMimeDecrypt> mimeDecrypt;

  MimeEnigData()
    :output_fn(nsnull),
     output_closure(nsnull)
  {
  }

  ~MimeEnigData()
  {
    mimeDecrypt = nsnull;
  }
} MimeEnigData;


static void*
MimeEnig_init(MimeObject *obj,
              int (*output_fn) (const char *buf, PRInt32 buf_size,
                                void *output_closure),
              void *output_closure)
{
  MimeEnigData *data;
  MimeDisplayOptions *opts;

  fprintf(stderr, "MimeEnig_init:\n");

  if (!(obj && obj->options && output_fn)) return NULL;

  opts = obj->options;

  data = new MimeEnigData;
  if (!data)
    return NULL;

  data->self = obj;
  data->output_fn = output_fn;
  data->output_closure = output_closure;

  // Enigmail stuff
  nsresult rv;
  data->mimeDecrypt = do_CreateInstance(NS_ENIGMIMEDECRYPT_CONTRACTID, &rv);
  if (NS_FAILED(rv))
    return NULL;

  PRBool verifyOnly = PR_FALSE;
  PRBool rfc2015 = PR_TRUE;
  rv = data->mimeDecrypt->Init(verifyOnly, rfc2015,
                               output_fn, output_closure);
  if (NS_FAILED(rv))
    return NULL;

  return data;
}


static int
MimeEnig_write(const char *buf, PRInt32 buf_size, void *output_closure)
{
  MimeEnigData *data = (MimeEnigData *) output_closure;

  if (!data || !data->output_fn)
    return -1;

  //nsCAutoString temStr(buf, buf_size);
  //fprintf(stderr, "MimeEnig_write:: aBuf='%s'\n", temStr.get());

  // Enigmail stuff
  if (!data->mimeDecrypt)
    return -1;

  nsresult rv;
  rv = data->mimeDecrypt->Write(buf, buf_size);
  if (NS_FAILED(rv))
    return -1;

  return 0;
}

static int
MimeEnig_eof(void* output_closure, PRBool abort_p)
{
  MimeEnigData *data = (MimeEnigData *) output_closure;

  fprintf(stderr, "MimeEnig_eof:\n");

  if (!data || !data->output_fn) {
    return -1;
  }

  if (0) {
    // TEST OUTPUT
    const char content[] = "content-type: multipart/mixed; boundary=\"ABCD\"\r\n\r\nmultipart\r\n--ABCD\r\ncontent-type: text/html \r\n\r\n<html><body><b>TEST CONTENT1<b></body></html>\r\n\r\n--ABCD\r\ncontent-type: text/plain\r\ncontent-disposition: attachment; filename=\"abcd.txt\"\r\n\r\nFILE CONTENTS\r\n--ABCD--\r\n";

    PR_SetError(0,0);
    int status = data->output_fn(content, strlen(content),
                                 data->output_closure);
    if (status < 0) {
      PR_SetError(status, 0);
      data->output_fn = 0;
      return -1;
    }

    return 0;
  }

  // Enigmail stuff
  if (!data->mimeDecrypt)
    return -1;

  mime_stream_data *msd = (mime_stream_data *) (data->self->options->stream_closure);

  nsCOMPtr<nsIURI> uri;
  nsCOMPtr<nsIMsgWindow> msgWindow;

  if (msd && msd->channel) {
    nsIChannel *channel = msd->channel;

    if (channel)
      channel->GetURI(getter_AddRefs(uri));

    nsCOMPtr<nsIMsgMailNewsUrl> msgUrl;
    if (uri)
      msgUrl = do_QueryInterface(uri);

    if (msgUrl)
      msgUrl->GetMsgWindow(getter_AddRefs(msgWindow));
  }

  nsresult rv;
  rv = data->mimeDecrypt->Finish(msgWindow, uri);
  if (NS_FAILED(rv))
    return -1;

  data->mimeDecrypt = nsnull;
  return 0;
}

static char*
MimeEnig_generate(void *output_closure)
{
  fprintf(stderr, "MimeEnig_generate:\n");

  const char htmlMsg[] = "<html><body><b>GEN MSG<b></body></html>";
  char* msg = (char *) PR_MALLOC(strlen(htmlMsg) + 1);
  if (msg) {
    PL_strcpy(msg, htmlMsg);
  }
  return msg;
}

static void
MimeEnig_free(void *output_closure)
{
  fprintf(stderr, "MimeEnig_free:\n");
}
