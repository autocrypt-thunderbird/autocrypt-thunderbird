**THIS PROJECT IS DEPRECATED**:

Thunderbird 78 removed support for extensions that this extension is built on.
This means that it's not possible to update this extension to work on TB78.

## Autocrypt for Thunderbird

E-Mail encryption that gets out of your way. Compatible with Autocrypt and OpenPGP.

Released at https://addons.thunderbird.net/en-US/thunderbird/addon/autocrypt/

### Build instructions

Build xpi file with `./configure; make xpi`

### Notes on the code

This code was originally based on Enigmail. Enough changed that it's no longer
compatible with upstream, but in many parts of the codebase this heritage still
shows. Don't be surprised if things are internally called "Enigmail" here and
there.
