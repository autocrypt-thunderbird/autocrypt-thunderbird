API Overview
============

CryptoAPI is the API that contains all functionality related to cryptographic
operations and generic function that are related to OpenPGP. The goal is that
there is no call to GnuPG, openpgp.js or any other crypto-library outside this
structure.

The API should be accessed via CryptoAPI.jsm, which will (in the future)
determine which API the user selected or is appropriate. Currently only the
GnuPGCryptoAPI will be returned and is directly accessible.


Class Hierarchy
---------------

CryptoAPI (interface.js)
 |
 |----- OpenPGPjsCryptoAPI (openpgp-js.js)
 |  |
 |  |-- GnuPGCryptoAPI (gnupg.js)
 |
 |----- [SequoiaCryptoAPI (tbd)]


CryptoAPI is the generic API that does not contain any functionality, except
for sync().

- OpenPGPjsCryptoAPI holds the implementation for OpenPGP.js (https://openpgpjs.org/).
- GnuPGCryptoAPI holds the implementation for GnuPG (https://gnupg.org/). Some of its functionality
  bases on OpenPGP.js.
- SequoiaCryptoAPI will maybe hold in the future the implementation for Sequoia (https://sequoia-pgp.org/).


Implementation Details
----------------------

All methods and properties are public, unless they start with an underscore _.
