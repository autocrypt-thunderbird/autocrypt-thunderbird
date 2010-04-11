/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "MPL"); you may not use this file except in
 * compliance with the MPL. You may obtain a copy of the MPL at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the MPL
 * for the specific language governing rights and limitations under the
 * MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is
 * Ramalingam Saravanan <sarava@sarava.net>
 * Portions created by the Initial Developer are Copyright (C) 2002
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
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#ifndef nsEnigMimeWriter_h__
#define nsEnigMimeWriter_h__

#include "enigmail.h"
#include "nspr.h"

#include "nsIEnigMimeWriter.h"
#include "nsCOMPtr.h"
#include "nsStringAPI.h"

// Implementation class for nsIEnigMimeWriter
class nsEnigMimeWriter : public nsIEnigMimeWriter
{
public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIREQUESTOBSERVER
    NS_DECL_NSISTREAMLISTENER
    NS_DECL_NSIENIGMIMEWRITER

    nsEnigMimeWriter();
    virtual ~nsEnigMimeWriter();

    // Define a Create method to be used with a factory:
    static NS_METHOD
    Create(nsISupports *aOuter, REFNSIID aIID, void **aResult);

protected:

    nsresult WriteStream(const char* buf, PRUint32 count);

#ifdef _ENIG_MOZILLA_1_8
    nsOutputFileStream*                 mStream;
#else
    nsIOutputStream*                    mStream;
#endif
    PRBool                              mForceCRLF;

    PRBool                              mClosed;
    PRBool                              mLastCR;

    PRUint32                            mByteCount;
};

#endif // nsEnigMimeWriter_h__
