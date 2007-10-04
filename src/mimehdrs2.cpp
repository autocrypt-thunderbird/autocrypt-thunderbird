/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: NPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Netscape Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/NPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the NPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the NPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
#define MOZILLA_INTERNAL_API
#include "nspr.h"
#include "nsCOMPtr.h"
#include "msgCore.h"
#include "plstr.h"
#include "nsEscape.h"
#include "nsMailHeaders.h"
#include "msgCore.h"
#include "mimehdrs2.h"
#undef MOZILLA_INTERNAL_API

PRBool MimeHeaders_IsAsciiSpace(PRUnichar aChar) {
  return ((aChar == ' ') || (aChar == '\r') ||
          (aChar == '\n') || (aChar == '\t'));
}

char *
MimeHeaders_get_parameter (const char *header_value, const char *parm_name,
						   char **charset, char **language)
{
  const char *str;
  char *s = NULL; /* parm value to be returned */
  PRInt32 parm_len;
  if (!header_value || !parm_name || !*header_value || !*parm_name)
	return 0;

  /* The format of these header lines is
	 <token> [ ';' <token> '=' <token-or-quoted-string> ]*
   */

  if (charset) *charset = NULL;
  if (language) *language = NULL;

  str = header_value;
  parm_len = strlen(parm_name);

  /* Skip forward to first ';' */
  for (; *str && *str != ';' && *str != ','; str++)
	;
  if (*str)
	str++;
  /* Skip over following whitespace */
  for (; *str && MimeHeaders_IsAsciiSpace(*str); str++)
	;
  if (!*str)
	return 0;

  while (*str)
	{
	  const char *token_start = str;
	  const char *token_end = 0;
	  const char *value_start = str;
	  const char *value_end = 0;

	  PR_ASSERT(!MimeHeaders_IsAsciiSpace(*str)); /* should be after whitespace already */

	  /* Skip forward to the end of this token. */
	  for (; *str && !MimeHeaders_IsAsciiSpace(*str) && *str != '=' && *str != ';'; str++)
		;
	  token_end = str;

	  /* Skip over whitespace, '=', and whitespace */
	  while (MimeHeaders_IsAsciiSpace (*str)) str++;
	  if (*str == '=') str++;
	  while (MimeHeaders_IsAsciiSpace (*str)) str++;

	  if (*str != '"')
		{
		  /* The value is a token, not a quoted string. */
		  value_start = str;
		  for (value_end = str;
			   *value_end && !MimeHeaders_IsAsciiSpace (*value_end) && *value_end != ';';
			   value_end++)
			;
		  str = value_end;
		}
	  else
		{
		  /* The value is a quoted string. */
		  str++;
		  value_start = str;
		  for (value_end = str; *value_end; value_end++)
			{
			  if (*value_end == '\\')
				value_end++;
			  else if (*value_end == '"')
				break;
			}
		  str = value_end+1;
		}

	  /* See if this is the parameter we're looking for.
		 If so, copy it and return.
	   */
	  if (token_end - token_start == parm_len &&
		  !PL_strncasecmp(token_start, parm_name, parm_len))
		{
		  s = (char *) PR_MALLOC ((value_end - value_start) + 1);
		  if (! s) return 0;  /* MIME_OUT_OF_MEMORY */
		  memcpy (s, value_start, value_end - value_start);
		  s [value_end - value_start] = 0;
		  /* if the parameter spans across multiple lines we have to strip out the
			 line continuatio -- jht 4/29/98 */
		  MIME_StripContinuations(s);
		  return s;
		}
	  else if (token_end - token_start > parm_len &&
			   !PL_strncasecmp(token_start, parm_name, parm_len) &&
			   *(token_start+parm_len) == '*')
	  {
		  /* RFC2231 - The legitimate parm format can be:
			 title*=us-ascii'en-us'This%20is%20weired.
			    or
			 title*0*=us-ascii'en'This%20is%20weired.%20We
			 title*1*=have%20to%20support%20this.
			 title*3="Else..."
			    or
			 title*0="Hey, what you think you are doing?"
			 title*1="There is no charset and language info."
		   */
		  const char *cp = token_start+parm_len+1; /* 1st char pass '*' */
		  PRBool needUnescape = *(token_end-1) == '*';
		  if ((*cp == '0' && needUnescape) || (token_end-token_start == parm_len+1))
		  {
			  const char *s_quote1 = PL_strchr(value_start, 0x27);
			  const char *s_quote2 = (char *) (s_quote1 ? PL_strchr(s_quote1+1, 0x27) : NULL);
			  PR_ASSERT(s_quote1 && s_quote2);
			  if (charset && s_quote1 > value_start && s_quote1 < value_end)
			  {
				  *charset = (char *) PR_MALLOC(s_quote1-value_start+1);
				  if (*charset)
				  {
					  memcpy(*charset, value_start, s_quote1-value_start);
					  *(*charset+(s_quote1-value_start)) = 0;
				  }
			  }
			  if (language && s_quote1 && s_quote2 && s_quote2 > s_quote1+1 &&
				  s_quote2 < value_end)
			  {
				  *language = (char *) PR_MALLOC(s_quote2-(s_quote1+1)+1);
				  if (*language)
				  {
					  memcpy(*language, s_quote1+1, s_quote2-(s_quote1+1));
					  *(*language+(s_quote2-(s_quote1+1))) = 0;
				  }
			  }
			  if (s_quote2 && s_quote2+1 < value_end)
			  {
				  PR_ASSERT(!s);
				  s = (char *) PR_MALLOC(value_end-(s_quote2+1)+1);
				  if (s)
				  {
					  memcpy(s, s_quote2+1, value_end-(s_quote2+1));
					  *(s+(value_end-(s_quote2+1))) = 0;
					  if (needUnescape)
					  {
						  nsUnescape(s);
						  if (token_end-token_start == parm_len+1)
							  return s; /* we done; this is the simple case of
										   encoding charset and language info
										 */
					  }
				  }
			  }
		  }
		  else if (IS_DIGIT(*cp))
		  {
			  PRInt32 len = 0;
			  char *ns = NULL;
			  if (s)
			  {
				  len = strlen(s);
				  ns = (char *) PR_Realloc(s, len+(value_end-value_start)+1);
				  if (!ns)
                    {
					  PR_FREEIF(s);
                    }
				  else if (ns != s)
					  s = ns;
			  }
			  else if (*cp == '0') /* must be; otherwise something is wrong */
			  {
				  s = (char *) PR_MALLOC(value_end-value_start+1);
			  }
			  /* else {} something is really wrong; out of memory */
			  if (s)
			  {
				  memcpy(s+len, value_start, value_end-value_start);
				  *(s+len+(value_end-value_start)) = 0;
				  if (needUnescape)
					  nsUnescape(s+len);
			  }
		  }
	  }

	  /* str now points after the end of the value.
		 skip over whitespace, ';', whitespace. */
	  while (MimeHeaders_IsAsciiSpace (*str)) str++;
	  if (*str == ';') str++;
	  while (MimeHeaders_IsAsciiSpace (*str)) str++;
	}
  return s;
}

/* Strip CR+LF runs within (original).
   Since the string at (original) can only shrink,
   this conversion is done in place. (original)
   is returned. */
extern "C" char *
MIME_StripContinuations(char *original)
{
	char *p1, *p2;

	/* If we were given a null string, return it as is */
	if (!original) return NULL;

	/* Start source and dest pointers at the beginning */
	p1 = p2 = original;

	while(*p2)
	{
		/* p2 runs ahead at (CR and/or LF) */
		if ((p2[0] == '\r') || (p2[0] == '\n'))
		{
            p2++;
		} else {
            *p1++ = *p2++;
        }
	}
	*p1 = '\0';

	return original;
}
