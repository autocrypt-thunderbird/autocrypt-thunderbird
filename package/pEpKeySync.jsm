/*global Components: false*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailPEPKeySync"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://enigmail/rng.jsm"); /*global EnigmailRNG: false */
Cu.import("resource://enigmail/mime.jsm"); /*global EnigmailMime: false */
Cu.import("resource://gre/modules/jsmime.jsm"); /*global jsmime: false*/
Cu.import("resource://enigmail/data.jsm"); /*global EnigmailData: false */
Cu.import("resource://enigmail/files.jsm"); /*global EnigmailFiles: false */
Cu.import("resource://enigmail/log.jsm"); /*global EnigmailLog: false */
Cu.import("resource://enigmail/send.jsm"); /*global EnigmailSend: false */
Cu.import("resource://enigmail/locale.jsm"); /*global EnigmailLocale: false */
Cu.import("resource://enigmail/pEp.jsm"); /*global EnigmailpEp: false */
Cu.import("resource://enigmail/windows.jsm"); /*global EnigmailWindows: false */
Cu.import("resource://enigmail/promise.jsm"); /*global Promise: false */


const testMessage = {
  "dir": 1,
  "shortmsg": "pEp",
  "longmsg": "this message was encrypted with p≡p https://pEp-project.org",
  "attachments": [{
    "value": "VmVyc2lvbjogMQ==",
    "size": 10,
    "mime_type": "application/pgp-encrypted"
  }, {
    "value": "LS0tLS1CRUdJTiBQR1AgTUVTU0FHRS0tLS0tCgpoUUlNQThNZGNTR0taTkJxQVEvL1NBUzZUTVlOOHZtUDFJZnoreTk4QUU1Wjc3QXZOck8vdHo5MFlNN21leldyCndhM0lYdjVXMTBrMnJ2dmZDSkpEQWlqMHE3Y3EzaUJlZ3kweGZHMVlkUzlPT3BoYTg4MjBRRy91Z3kwRGxjWk0KeCtZR3dPS2lpbUF2dWUxR2NNeUc4V3BTZ05aV25zeVBib2tUQXFVMlVKY09ReTdhRnd3cmhQZ0JJOTQzSWlqRgpyandYKzZVQnNwakpTODV5ZXVwbTVqaTR6OUg5VnBSRW5ZMkVmN0dEVHJudGVyRDZlTkhMbXh2djhhdVIyZytPCmZPVmgycytqTTVsOFZDTDBpOGhuVUZYYjZNUXZ0encrM3dwVUNDSTdoeTNhMEpocXdJWi9tWDc1VTVnS1VPVTYKZlVSWktJVWNZRS84OTZPRzh4Q0x4ZThqWW1ldnoyLzdZbEREbEd4ZHZvbUFuSkVJUThPTWY2VjBBc0ZZTHkwWQpIVSszWk9Vb1k1VTFEZE14Mlp4a3cxY1YxZFp0eE9wS1VsaTQ1WlNzOXM5bUpvVHNtaEtZSVhER1BYNXpKZHpYCm5sM05lbVJZNUZlR2ZuNktCOCtaV0RlZ3RtamtQaTI4b1VNTk5WUmd5bmVaRTRqemRiSTNobGNJa0RjZjhHbGYKSGg0S1laK294bVBYMWh6RWhHK0VSOXRIRTBsVWNmWGMvNWQ0a3pESnliZks2amt1SzZiUWh3ay95eVgyWk1tcApLQUJ4QUg2V2NiS2lDTEVlTWpJTlJCMk9ndkI1ZlJiSHVTU0s4Mk8zQWlSeW9vKzdQZWJIekwyMG04YmlPUlJ0CmhYQmFVUGVWUmRkai9XTTA5MlJXeVZ1SFNYcHBZNkJBSHFwUGNIS0o2YWtCV2RCanUrZ3lYelhhM1lmeitycUYKQWd3REs5Y2F4Uld5NFRZQkQvMFFJeW5KZnQwQjN3TTNxUXBnRnNWdFIvZ2ZDR2k2TGp1Y1NTMGRzQjZ2RVRETwp5ZGgyV3dXMzl4bTcxUHV2ck9GVk9oOTlRNUFaY2VIOURMVkxxdGc3Z0dGZ1pOWmQ2bVEyck5lWVdLNVluaW1NClEzLzRicTBIS2YvN3liNlJ1dm55UWlQdVNEUHdjUmNlaWhNN3V1blFZNzVhZ1pQVlNGWVplUk9OMHhrWHV5dVkKTk9NQWFnM3RXTCticEdScU1aTE9PRHhRZXArc0FNbENrbUdkZEtETFpkUnZndWRWaWw4dEI3ejVSUk44NVJjUAo0aWs5SkZ0SzU5YkkvdTdqbmdaaUhOSmkvcVNsd0lKMHRVZzlmMTd5OFFFNjRVc256aDhld2JFcThjcDVJd05BCm5FNFo3cjNDeEFVMTd3eXI0UytqTFd4N2tjempiNFcvUEEwVnBuTGg4bFEzRzAxR2Q5bnB6R2NSMVpPVWZkUG4KN0dSZ2dtaXFOb1Y4YUJvZ2RDaDdwOFF3MFRySFpKVzR4dytyajFaQ2poZWVSUEtMUExoVlBEMjVHVktIeDRCMAowMHF6MW4xM1YrSzRTNTF3VUNGT3Bra1oyK0J6MXF4TFNUemlvSGJSTk1aK0FRZmttM3o1WEhKM0kzMHlTMzR4CjlUTTM4MWpaK0ZhU09ybGc1eE1TRUttb1U3aFI1Nm5tU2RsL2FvaWpwMkZvZmdDM2RTZm0zN2pjWGMrTEhnd0oKaU9QejhacDVEQXZtWkdxL0Znb004eEZXSDc2TW5GK2RiUklOajJQYTdzQXZwTlNUMVM5dUl3V2JKNVhqVVdKbQo1V051Uk9Mc0VnNXFPVWdKaGdKU2RIUHBueVNka2ZieVV6c0hlK2VpM1oxeTB5L2hhbkpQbnpTMUhwVW9HdExzCkFSVjVlSUZRbnRmbWZMaTlFcVBycWZYMEMvSGxRYVp4U0lrd3o4dUMvL29acXJOZFMxRnhGUVpZcjEwdFNKalEKck8wVHl4SHlhUG5pMUd3Nkh5OThneXhsdU0wK1FnR0k4OFR6UTk5ZmU4ZmRUQW9ZLzVqcmZaRDk3V1BzQVFVNAp5eWRmQWtzOS90aUswd29ZSDJKdXgzakFKZ1VKNFBUZEQ5WE9OeWtnSXpNZWVxbHE4Zms0dExlVEVSeWRkZUpOClNwRVVwcUN4cVc2eUJzZEJla3ZQSnhpcWc4QjBJZ0dLNG01LzJ5UUY0QjZBMHp6SkRzU3JFN0V4OVY2YlBqOHEKK3NIbTZJUzZqdi9nYzlMNkhFOUhwOTBvMlNoT2ttcTVrV3VJVXU3Mzl5cmR5ejFVNDRPeUQwajJWS0VVOWZZNQp6Y2dwWkpnbHdXazU4WnU5dmlTanpuNUFLMW50MWRhTlRLYjZaUUJNUmMrWmowUU4yRW82RTBSNGRDV0Y0RUN1CmVFQXZHRGtVM3ZZdWFwa3E3cVM1ZUwwUXRXelZkRW1aUEV3UHdaWFFKUzlYSUhxU2hPcjMxSi91SXZoZ3A5VHQKRWZrWUdWclJDS3FsVkFzekE0dU1PR0NROWhxYlQyRERvbFNYSllyZVErSGZxalREMmhCR21RWFdVTnd6dEVNMQo2clFJOHJ2cW1rTkdwNDhsWnhLdVNkNnhGc1FQU2l2d09vU0NiaTZJakwvM3RPS0ZyUDNtM2tXdjVUT2JLN1l5Cmx0UFQwL013dW1LMmpiSVhVNy9PcTB4RWVNRnZPZTJPcmZRRkFCVVlwRDJwcnZpeWFUd09NemEwMW9PcUNVQlUKTUgzdVQ4OWtFMTRBaTYwYWRJaC9RUCtDSzlBSkM1WEFhakY4QmFkTEZJaGZoR0hJeTBTVGhlM3NOTnFKUEs3VApkbU9PRjFSTkIzbzVpNTFhN2xGejlkRzZTeThPWm43anBkTU9PMVd6SU04ODBKVit4RUxFY3dSUW1UczFjZGVSCjJSMm1WL0c0R09yQXJISmhBcE5STkl5dUd0NGpoT1FhUFM2bSsvWDJMSHNUTmFjc0ZWSlRaT296WldscG1XZngKK3RaUExDaC85QzJLc3pJT25PNnArRms3a2xCRkpsRE4vaVE5TlhZQnVWRThUTWdzNUxManhieGxYVk9TSnI5Rgpmd2VLeFJaa2FydlRMSXZzTmlCcnlkb1VlLzRLOTc0ekJYT1lLUDNlOXRINC95TjJWQUM4RGlMZFdTY291eHlzCmVpK2p1UU5KVVZ3M2tFUmJuc3BOdDMzdSt2cHc5R3NxZWl1dnFtUWw0NVZvUng3LzRFOFJQK2l0S3pxK3kzWSsKVHgwNDFZSUxhcVBtaHo1VzdXeEFwbjNMWUpuMHoxem01TGExOHh0RmIzT1NlT3RabTdpZTRXSUgvRERKNC9sZwpvRE5OaFZ1cTZ4Q3BFaTJydFZURk94S3JGRWZHakxPYmZkcjVRZmRZNmovUzkwWkpvTnVGNDJtOFlJbyt0Ny9tCnhNdGQ4YTM5WHFQMXp6Q25uK3RhUlo4MG5uSThhMXpDSk1lZzFPbmE3eGJDL2dhR29ialFBSlYvSVh5cTY1UlAKNVdKQVZLbkFScEl4c3IyVWZkWTZ4bGUwNWhRSnN0UUx5M01Nc2IreGFScjFxNnBnaHJLSlpWbnF6WDNJL1VBSwpmUjZkS3l0QzRuWkxoQjRGeUdRdHYwSWlEMnNOUDIwQU9Ea1lDVFphR2lsKzZQZk9YWEc5dmF0cXZvTWd0Q0R4CmdyRzZ4M21GOVVtYlJnSG5qa3BYVVIzQVo3empLNGVJU2xLVDFVR2tEQWlJdWFMMU5qcEsvWWpxbDZPUWNLUFoKR21vQmpObm5JbGJKNFhRRVdPenZyUUtVTm1ER0NZUWtLUE9JdnN6TnpjQWkvVFZ6RkNVYkFRRG95L2JEZWVjUgpGejhMdzR1STJkek15bkQ0ZUU4NDRtbVg4RTdSamduc1psTERmOHRjZVBnaHpydzI0TE1ScXpSRU9OTE5CVlFkCmw1MDJyV1hMR2ljL2pVQVFyY2toVTA1Qk1leDNreDJtb0doVzQ4OVFZWTJTU1dsaEh5RTB5N1A4eVloRTF2ZHMKZVk3SWJEbXZrQjVhWDFyeHBPQkQ5NHlKQnpUdE5NVnMzaTl0Zi9BQ2xQbGpDSCtBZEw4V2tYRzZYMVVFWWV2dAp2cHBHMG1NR0N0WEZnL2pEZkxuZGZQY3A2SlNjK0RBcGFVVndLR0kvQnd5QnBHdG5pU1NOalBVK3hhRVhvZWNmCkJSdEd3dmltcDBPS1pERndwWWgzdkpQV01GUE8rTlVWRVVxcGQ2ZWNsZng1SHhKMU1TRXVIWjEyQlpMNEdhREwKdnFDV0dFOTFoOEcxeEgxb1ZkdUZXWitzdXJIMEZjZHE2bW9nNG4vL09pVlUzWm5pb0dHWEpFWmcyUVplQ01BMgpPR3B5Uk9XVzJUYzVYZWYwL3BoN3lSVXdiQlB3VjhIbVpHVlBXUHB1M1FIbWhPR2t2RHE0SHJhWEorZ3Y4bFpQCkg3SlNISWxDRXAzNnJVanJ6UXdNd3VVQ2JOMWViMW8vQ3BRWEhEbThnV1RFMllIODYzZjV1UzhHNjdIYTQzWWQKK2dHV3lwVjA1VjUvVVVQTDlmQi9hVWk3N2VxUG1qaTJRekFRMWNIZENRYzJ0Y2dXc0tlbU85dWZCcWFmSXlpbAoyM2NFM0p4dlJTRlVPWjJnRkRpYVNaVWgzL2tLQU1aZERIWUZ3U1BOMkdhY1c5ZEI2SEhKWDZQS2YrWXJPcUJ6CjN1RDNoN0crZ2tUS1BjY29wcXBtdW5FR0hZeGZWZjBlN1RRRWVURk1FS2c3VUFMamlLVnZNdU1aV21ML3VieUIKZ0dQWW9yMDgyekhSUE9PajJ6RUNiUERZam5URUxEWUNzakVzMVlFLzMwdTBVRFd3dnBQajd0UDRDeGhYTjRoVwpSYlRDaUJKUjB0ZVZOWGFRemJwMmhSSXJ6YkdhNWZVMC91TG1PTUxhTlpZaEhrQkp6SVRHYU1YdU1tM2hJeHpuClB1anhtazlNaEhJY2t0RDVTNFVpbklyYUZUdVlrUTZOOUlUL0pmeGQ0bHU4SldjUUlsaTZiZjI4SmtYSzZ3TFMKY3kweDdDVWJkbUtsYTUzVnpNeFhQcUsray9xL2MxV3NibU91K1pRTlBHTnBKQ2IzQUlPYVM4V1NHYmljNkY1TAphVmhKb3RveUxtelY5b0J3bzIyQVA2eENlVkVUcERhaFJJTDdHTGczRUFCbTV6VDhqalc2eFZFS0FyalJEb3I3CkR1OFFPWmdhY0JBNWVORVAzY0d1ZUZrc2plSW5aUmVIbEY5M2FDUGhkNTRUTHFmTXNrQ2xKN3FuaVI5UlBKNnkKZUNBSFRGS0ZRQjFCM0lEWElmVnlkZ0UrMWVHYU1yQU5uTG1oc2F4TjFXTUtsN0U5dmRkVkxPczN4UTRrMWxsNwozZWYweTllWnJ6TGl2Y2tSRmdseVI5SWRiRXlVOXdHVktXWlVRWTRtRnZFZ1hpandQN2JsazUrRDgyMHpCemN3Ci8yakw3TGp6dzkwdkV3TFo5My91RVA4cmZQTXVZOXYvQWJIc3JCem9lMFpmNXEyalJUMG81djRxeXVJS0pIakcKZi9xcUs5bTZydmgyY0IzSVJ1QWFmSUlLZDNMYlR3UkdXWlNseFdEY2kvR1NRY3VmNWRFVVNpMFRqdGhXdEx3bApVRGErcGlIQVZmVm5td3hEbUd5QmJjNFJNbWtPa09razB4K2RMVGllb2c4RCt0eExsWWhWNU1ZbjNqU0JTQU9OCitZRTRCaFVTWG1yU0FtUXdmMS83dHl3M2JMb1VvbjRYbmhVVG1uOWtXTUo3Q1VMY0I5RWxoQzRiWG1aTytYTk8KQzVVb0o1ZUxySDRYTW9PU21WbDZ6S2lURVZRUGc1VGhDWUxpZ1V0MFhaRzJ0cUpqd0ZkNHlybW5XcSsxaisyRgpHbEVYejM0aGNiVW5xOFN5elFKVnNVL3JFMml0cDlTQWR4QUgvWVpRQmVJSlFFQ1huMjhEZTJOLzF4N29tZlBZCkcvMDNyemtXcjNxRHJkV1B1cTZoYWgxa1M1NHVDTEFCMnhUYmpyTW1mVEd2cTN4YytPTlpDUVRyU214Y25Pa3oKZStjQUFLc0JoSU1VZyttSkpLd2orUDZKalAxVnBzNmxOOThXbUdxWFB5UTgyUnR6TkZQUlRidVczSjZXd2dkdApLaW5xKy9xOHdKMVpHSWRCWW1vUlM1SUZRYkl1VnNFak9hZGhNY0JaQTExaFAzVUFUS0FlWVdrRXVaQktwSnN1CnAxVTAyTmJvbmlZSG5oRnFHYjFBQWcrNDlHVkNyYmpwVnBvNGx1NjVxYy9Ua0hjYVlIZExnY2dtK0RFbzNQSEwKMnpJclRjQ0IzcEUxU1FzR3Y2M0M5djEwT0xpNW1qNGVwbGNnQ0h0VjF2NTNrK2VXYmlpYmhRVlQ0c0JkZjFqRgpPdDhmVm51Ni9pbTRLMG1QZEJON2tjS3B5MlNRUytYRnlEaHlRK0FieEVWeHF4azIwZ3hmY0lheUNYQjErVE5FCmovMDQ3NXU4YWdwTWIzdk56aTRtR2U0K0d3aUt4ampnZjBTWXp5Tk45Z09EVjVhTVRtTkJYMFpvemZKS3hPM3IKNi9CZ0lYZmx1aFVhVUc0MnAvSUhNOEh6OFpwa2p0WmZJV2tHUi82elZPb25iVUZLa1lLYzJuTjdHaUlnY3RrNgpWSHN3N0NnNG9QbzNqYk1vamp4QUpSQVg0SlBFWEEyZFYvMTBSZkhZNkQ2K0Z2Z3VrRmVFdmdlQXEyMjhHcXNkCmh6S0hYdkc2THNiTkVPY3p2ZnlURFZwVVoxa2Z1SjVuWjlLOGJTeE1yZjhxd0d0c2UwdldzeDd6SDJIZTV2a3AKaGhuWkYzSVZnNWRQMTJ0T1U3cEtIbUZqNHBrVVRSd0JMMzBkUzBjSE1EWGx3eUQweVBmY1U3M25tMVRjN0FRSwo2b21JUWo5OUhDc2dFV3JYUjc4WmFuSTIvOFErSFlPWlcxaEdRZVBtNExtaElsK0hCeUt3dU9RN0hyZVNONDMwCnU4NmxhbWpZei9IeGV3STJ1VTdXYXVIOGs1a09yTkVCYVJkSTh4NVhGL3M5elJLc0NKdlZ2K0g1d0VVdXFSMnkKbzVLNk85dE85anloSTFublp5SXJoZHE4UTFWUTVaQk5DeVFYaE1td2N6cFFwVDJGMHAxSHBHQVFOSHg5cU9DUwpFbTIzaDFpQUROWGRBeXpoZkg0cHlIQmNSWGRrR3BBaVhWUHIzTi9iMGtJS2c3VXkyVkFjYUhMV1cvTWE1cmhwCk5RVUJJRGtUQUdLSVdGdERSbGNWR1RBcUFlaWlFYjFFckpBb0xVc29nTHJzWEZyei9lSDNNQm0rcGkxSnZUcmkKQWVXM3pLZSsxcW9qMWlkanRiems4TjZYTG1ZRjhEMlZZYlliYW5JalNLeHhTRDkvMkFXNWhtNU9pTUZCNkw3YQphQ2QzNzgzZUNKM0NPY3N3TzJtSUFLU2lmK2NtMDN5UWJieU9XMG96RXRYUC9kLzdudW5WcEVIUkpjeXhyb2svCkxnZ09WWlhuR2swOS95LzhIdFZvOUR0MmttWFFtWkIzRjdUeThpRzBhR3ZhaEhqQ0NZU2hTWmxMVGMvalBvN3YKRlp4UmVqVEtxYTZoazF4Sm9rR1IzVjgwRWRhZGhNRVA1ekJvYWl2VmF6VGI5NEtiaHhldzRUME1HaWZ2NngzUgpuSktjc09LYVdSOERyR014OWZDVkF4a1JIR2hSTEQwWm5MSm9DTXc4YjBqWUpuZTFjNXI4Q1dtRytLVk1jK3g1ClFkd3JjTnZ4VkZsbmdFdDQ3UGdMNGkzcEwwZ2o4OXQwa2lGV0c2SmdlTzJobEpCS2xuZ3hYVE52ZW5Dd1JKcUQKWDdNeTZVQllvdU1JV01EZ3BHeHFxMEtaQ2ZPOG5rMm1UU2tpbXNFdFRlKzlMYlh6eVk0QUVJRjVFZGk5NWJkVQpYL091NFhLa1FTY1NBWFpFT2NlbU9RaTRjT1hXMUNjOFd3T0JtTzlmQVBXWElPTjVhM3lucXdlcWZCZWxtVTUxCmxEczlITC8vRHVzMTYrWUR1NTM0MmJmVFpiYzF4K3lzYklzTUIwYW5hUDUvTnNiVE5yUTV5YXR6MWFMSGhiU3AKSFVXYmNXbWdoLzdrMnI0bXZUNld0WCsvLzBubnNIWlNUZ0ExblZNSW9Bei9Sb1FTU2dxNVNpZGE2T3ZrMXBscAo1c3VUdmRhNC8rSGxBME1WYWVHQW1aUFFPTS9VNnpJN25Sb2xyVGkxcm0yV1RoQ1UxalorYXB5RTcyOEhYRTVSCnd5bHVDblU0K3NDbVd2ekQ0bWF6VExIQ0g3cElWbHAySTB5akVmQWFmbWZCQTRCVXlMTUlVRmJtN05BVk5ueU4KMmZXSlJYK3JwRS81WWtrMkR5RVU4blVlcE9xbjBvaS95dTdBV0szOVN6R0R5TVRNSmR5YnpPK0Rneno2MURUYQp5ZGVvSStibzUvZklwWkNMVytKS1orai8wS0dHMENmZkNacWtVdk9wNjVrYjZmRWtBYnZENFNXdThOTWVSWHBBCms0Y0dRbW00cUducWcwYzFhL0h0d0c3VUN4NFRzU0V4SUdRMU5rRllwa3pOWUxJZUFQZ1FJaE12TkRSczROVzAKRk5BTUZEU25TcmJKMTJ5WDlEazZoZEI3c3FQQU55bTZwNXFjYmtvUHhUczZnUlV6aTk1clR3MnJ4UlhCQ3lSdQpScTI0MDBqWlRZQ2tFZWpBUDFNYjdyY2J0ZnJUbTBJTUs2TGZIaXUvZHZheUdUcUMrTkhXYkhQeERidzM3bkJsCldnblNsY0VRckhRdjUvSVpncFBJUDZacFFiWnZmNW1ZdVJTSC9rWDJjbmRPVHAzOEMvM3lJclZuRXNiN3o0VngKSGl6T2dlakttRjdMWU9HN3RsY29NT0NGODVsMyt3cWxWL2xJRlhGTGZTaHMvMzU3UmhvajJRUDVBSkJhZmVyOApiTUFtdDM2dDlmVGkzall4ZXlZSnhCSHF2blJRcU1ESTh5dVJ4emRmQlQ0WEs3L0JyckVmOUNEUGhkTk9tNS9PCldZZ25NY0x2RnJvTkFPK3dIR1JXenhsM29MV3dUVmRvblVaaENEcGJtN0hQY0xISVF6ZkRlakNlUUtZVytwcGYKQ0JhY0p6UEpSUURQQnBBZ2s4MXA4K3A4ZTJTS1QzVHUyYUt1U3BRUHhPTlN6RTk5c2Zla0J3blNFZGt0NElDbQpQK2VIV1lsczJDR0NGS2dEZ1ZOUWFiU21UWTJmalR3SklidGZNdGdLNjJBRjZDTUl4amJBVXV5c1h2V1U1VHpOCjIvdlhaWWN0aTVFSWRhTGdOOVB1ZWNYc0VUVEZqRlp2OW94UkJLVCtLQUFZS2VJVUQyZk1BcnppdDd0VWZGQXIKbzVmM2FPS2RoRVZQT3pjR1AyNnh6YTZySE5BTGYxdldPVktrcmZ4b0w2VGxMUGh6dlZCTStYYVZ3aTNvTlNkUApKd25XNFBUb1dnak94bGFuTkV1MjNrczVCYVFJUXE3MlBJTWVhRDBLTC82UFdyeUdPQlU2ZEFBb0FMZmJWbWdkCnplNFF3OEd6ZWdRQlpqemxlSWY5SFN6emFwRWFNdG1Pc0tndkxuN1RhMlhaWk45Nmt3VTdoTHR5QStGMlBlSkcKUDhUMnR0V2I5VUg5a0ZxZ0lnY1FTWUxWSjdXV0pnT3Jaa2pyaVNpU1NvSW1XbzNWSlZnLzZ5andWNVp3VmNsTAp4Uks1eE1hSHlVdUhJUHp0NjY2SUF6L3JRZ2NETHl1M2ZDTzhqRVBrckRrS1k5M05BSnFWWjJpYThZeFFCVFVYCnlXOElLdlZGbmlyc0NaYUNpWUFFY1FXZkViUURlVHJhNlprSUJlWHNtRWRWNWhza2VaUjhNUzNIeHZDYWxSdFQKa3NHZ09mU3p5cEg5U1lOMCtudWtVcVdGMFBSY2tiakcwaE0xVWdRYlVWNWlDa3hwSmlKWkpRVjBxZk9KaDFLZQpsRkdIdU5YMjd3VzYvQWY1N3ZrdDB0UnVYaGpYdnlvQWE0eVFTVDV2RmpTaHFKK29DTnhadC8ydTFaRDlKZVhvCm5ONEQ5cDJKS3J6YTlWWWREaW00NjZlbEtDS1dGeTdULzhEdERreGFWbmRTRlhoQ2VCZmFNSG5oRURpa1pWYkYKNUlYL2JDZS95SVZJWDc5aGFlYlI1TnVSMTNFUkE1WVM0QS9CSlRQbUl1Y1p0YmxXdUlSNlF5eHBMdUFZY24zUwpTNVgwZUViTXZ2QTdCUEJFQTV2OWZIRndvMzhlQXBzSVNxM2JMUzRiQXA0d05jOHpnWGIyK2FGY1U4SUc1VmkzCmM5YXBpWEF1UWg2bmxVZXJJUmNqdysvNjE1NnVEbG16NjUxZ3ZRQTlsb1hzdWlBL0xMZG9HaFNHRTZiTlFCN0cKMFBJUFlpZWorenduenppaHlYbWpMWDdFUUpWckQwcE15MEM4WXZ6RTZyOEg1UHdwQzRFcUZxSWdBZTcvaHRldQp0bTJ5Nkk5QXBrMDBiWUYzeU9JZzFkNnFORTUrVEJuMWIyRThGcFZEd1FHU1VjZy9LdE1Cc2pJcEY0UWdNMzd3CittQmtMY1c5L25vVXJPS0sya3ZyaFEraUlrZ3ltemJBdmVPZGgvY2xMUGU3TjBiQ1cwSzRNN01XblBnK3p4V2IKM3B1QWx6bGdHY2RRaVFPaDlFekd1dS9xeXd5YlNac09TdVRVbHk3cEpGT0VqM09LdDlQdTY4UTRmeGhBa3FGMQpvUWozZmxnaTNkRGhpeU82SnNPY0h1d3ExYldoaTNrbnI2cHFKbTgwMDFWZ3FhTVFQaU1MbXlwWmF3SUl6YXd3CkxoTVoxaHZaZUxxMlFDV0xuZzRVUjk4cisxUHZjYkJTQUhHQlZXRVY3cHpCSklYdmpEWlg4RG9raDZhQlFlSGIKUVduUm1jNFhqcWFoMkRFRGc5aUdRTk9JSFY0NzFmVDFEck9FRnNXMXZUTEk2VC9lenZxYWRlbkMwaGUxY2g3eApEbTBxVk9maS9NbGhoY0w1VVF5dDBkK0lsNXdDS1h2Rk0yaDNGZTFwM01sTUFwMlJxbHZzK2xUcm1GUkowMDRhCkpLOTd1Qlk2ZmVUL1NHYjVjZUIvR3lCck1mc1NBWWhTaURQY0RwemkvdFMyWksrYzhHczFBK011dXhmcWxQdkcKVzdLZk9WQUxBamNyaWZ2QlErcjEzdTRBSUVDWU5rMVJuYXNHdWU1dGd6dVlLaGpmTGJJTFRkYVBDazFoS2taSgpreVpteThndUtVRFpOMVUxdjhIWEpxdU9aNUpFYnR1SHdLNmU0Zk13Y0NQWmZMcllHUkxRY1dzRjg0akdsQ2c1CmZYdG1XT2huN084emxTS1JJdXhSdTk1bFEwakJoRXh1OFhZMkgxbktZQnlFWjBGem5NVDBsWkJLaytRRkVlVEsKUTFGY2pka1Z2NllaWTFJaU1kamo2eDJseUV5Q3F5RVFQUEYrYlZVVDY3b2RKTUpOTUlPcFRicGRCaHo2K0srMwovTmhzc01SWkhzWnlFYy9MS2JtUVhaYXhTVGpNbnc1c1JjMkVzZjZCdXkvNTRpcWYzZXRaYW9GQXhsVXc1UGZrCnk4cTVvUXFTcGRCZjdUUkpmZDU2dlhNckFqTjJQYUJPdU56cm9heG1FQXNhV3pjVDdRZ1pkTEFDbC9xNFZGN0MKL0l4Y2NkZ2N0cmhSWk1hRmsyQTlvMThJc093QlBMMkhnZUI5K3NhSWY3ZG1KWGpObHNQQjNrRytLUDFxT2VOYwpKbVdLeGtqSWRXWkRGazZIMzFYb3dScCt0ZDhzMG1SQ0QrdEpQMmsrblJVWnBjeXEvNERQaGNzaVFqdzMzKy9yCkR0Q3UwUXJ6MkRMeVVsaDdCUFpVeXluc0lZREh5NG1QakQ4enVFaFU1N25jell1eGdkelFNUHhiMHpROExuRUYKOFN5dnNnPT0KPVdvQWYKLS0tLS1FTkQgUEdQIE1FU1NBR0UtLS0tLQo=",
    "size": 9170,
    "mime_type": "application/octet-stream",
    "filename": "msg.asc"
  }],
  "from": {
    "address": "enigtest@brunschwig.net",
    "fpr": "35639B7D397A4737F11C6160CA45EF9C1C17AB90",
    "user_id": "pEp_own_userId",
    "username": "anonymous",
    "comm_type": 255,
    "me": true,
    "flags": 1
  },
  "to": [{
    "address": "enigtest@brunschwig.net",
    "fpr": "F871CDB8990483FD6B305B8F319B7AE82E21E970",
    "user_id": "f827eb96-2f4f-11e7-8fa4-4be0b4159ac2",
    "username": "Patrick Brunschwig",
    "comm_type": 56,
    "lang": "en",
    "me": false,
    "flags": 0
  }],
  "opt_fields": [{
    "key": "pEp-auto-consume",
    "value": "yes"
  }, {
    "key": "X-pEp-Version",
    "value": "1.0"
  }],
  "enc_format": 3
};

const keySyncMsg = {
  "jsonrpc": "2.0",
  "id": 2002,
  "security_token": "mmhqlMwmlFBwd5NO3UK7jD18FRs7wW0rm5KetnSe",
  "method": "notifyHandshake",
  "params": [{
    "address": "enigtest@brunschwig.net",
    "fpr": "7A0D51844B9C06849E3C313F9B299A39D1CCD0BD",
    "user_id": "pEp_own_userId",
    "username": "anonymous",
    "comm_type": 255,
    "me": false,
    "flags": 0
  }, {
    "address": "enigtest@brunschwig.net",
    "fpr": "F871CDB8990483FD6B305B8F319B7AE82E21E970",
    "user_id": "fcb950d2-3931-11e7-a0bf-97c07b2bb40e",
    "username": "anonymous",
    "comm_type": 255,
    "lang": "en",
    "me": false,
    "flags": 0
  }, {
    "sync_handshake_signal": 1
  }]
};

const CRLF = "\r\n";

var EnigmailPEPKeySync = {


  notifyHandshake: function(pepParams) {
    let uiLocale = EnigmailLocale.getUILocale().substr(0, 2).toLowerCase();
    let useLocale = uiLocale;
    let supportedLocale = [];

    EnigmailpEp.getLanguageList().then(function _success(res) {
      let deferred = Promise.defer();

      let outArr = EnigmailpEp.processLanguageList(res);
      deferred.resolve(outArr);
    }).then(function _ok(localeList) {
      supportedLocale = localeList;

      for (let i = 0; i < localeList.length; i++) {
        if (localeList[i].short === uiLocale) {
          useLocale = localeList[i].short;
        }
      }

      return EnigmailpEp.getTrustWords(pepParams[0], pepParams[1], useLocale, false);

    }).then(function _displayDialog(data) {
      // open trustwords dialog
      if (("result" in data) && typeof data.result === "object" && typeof data.result[1] === "string") {
        let trustWords = data.result[1];

        let win = EnigmailWindows.getBestParentWin();
        let inputObj = {
          supportedLocale: supportedLocale,
          locale: useLocale,
          trustWords: trustWords,
          dialogMode: 1
        };
        win.openDialog("chrome://enigmail/content/pepTrustWords.xul",
          "", "dialog,modal,centerscreen", inputObj);
      }

    }).catch(function _err(err) {

    });


  },


  /**
   * Convert a pEp message into a regular MIME string
   *
   * @param pepMessage: Object - pEp message object
   *
   * @return Object:
   *   - data:       String - message string
   *   - compFields: nsIMsgCompFields object
   */
  mimeStringFromMessage: function(pepMessage) {
    EnigmailLog.DEBUG("pEpMessage.mimeStringFromMessage()\n");

    let boundary = EnigmailMime.createBoundary();
    let msgFormat = "plain";
    let now = new Date();
    let composeFields = Cc["@mozilla.org/messengercompose/composefields;1"].createInstance(Ci.nsIMsgCompFields);
    composeFields.characterSet = "UTF-8";
    composeFields.messageId = EnigmailRNG.generateRandomString(27) + "-enigmail";

    let mimeStr = "Message-Id: " + composeFields.messageId + CRLF;
    mimeStr += "Date: " + now.toUTCString() + CRLF;

    if ("enc_format" in pepMessage && pepMessage.enc_format === 3) {
      msgFormat = "pgpmime";
    }

    if ("from" in pepMessage) {
      let m = this.createAddress(pepMessage.from);
      let addr = jsmime.headerparser.parseAddressingHeader(m, false);
      mimeStr += jsmime.headeremitter.emitStructuredHeader("From", addr, {});
      composeFields.from = pepMessage.from.address;
    }

    if ("to" in pepMessage) {
      let m = "";
      for (let i of pepMessage.to) {
        if (m.length > 0) {
          m += ", ";
        }

        m += this.createAddress(i);
      }

      let addr = jsmime.headerparser.parseAddressingHeader(m, false);
      mimeStr += jsmime.headeremitter.emitStructuredHeader("To", addr, {});
      composeFields.to = m;
    }

    if ("cc" in pepMessage) {
      let m = "";
      for (let i of pepMessage.to) {
        if (m.length > 0) {
          m += ", ";
        }

        m += this.createAddress(i);
      }
      let addr = jsmime.headerparser.parseAddressingHeader(m, false);
      mimeStr += jsmime.headeremitter.emitStructuredHeader("Cc", addr, {});
      composeFields.cc = m;
    }

    if ("shortmsg" in pepMessage) {
      mimeStr += jsmime.headeremitter.emitStructuredHeader("Subject", pepMessage.shortmsg, {});
    }

    if ("opt_fields" in pepMessage) {
      for (let i of pepMessage.opt_fields) {
        mimeStr += i.key + ": " + i.value + CRLF;
      }
    }

    if (msgFormat === "pgpmime") {
      mimeStr += 'Content-Type: multipart/encrypted;' + CRLF +
        ' protocol="application/pgp-encrypted";' + CRLF +
        ' boundary="' + boundary + '"' + CRLF;
    }
    else if ("attachments" in pepMessage) {
      msgFormat = "multipart";
      mimeStr += 'Content-Type: multipart/mixed;' + CRLF + ' boundary="' + boundary + '"' + CRLF;
    }
    else {
      mimeStr += 'Content-Type: text/plain; charset="UTF-8"' + CRLF;
    }

    mimeStr += CRLF;

    if ("longmsg" in pepMessage && msgFormat !== "multipart") {
      mimeStr += EnigmailData.convertFromUnicode(pepMessage.longmsg, "utf-8") + CRLF;
    }

    if (msgFormat !== "plain") {

      if ("longmsg" in pepMessage && msgFormat === "multipart") {
        mimeStr += "--" + boundary + CRLF;
        mimeStr += 'Content-Type: text/plain; charset="UTF-8"' + CRLF + CRLF;
        mimeStr += EnigmailData.convertFromUnicode(pepMessage.longmsg, "utf-8") + CRLF;
      }

      if ("attachments" in pepMessage) {
        for (let att of pepMessage.attachments) {
          mimeStr += "--" + boundary + CRLF;
          mimeStr += "Content-Type: " + att.mime_type;
          if ("filename" in att) {
            mimeStr += '; name="' + att.filename + '"';
          }
          mimeStr += CRLF + "Content-Transfer-Encoding: base64" + CRLF + CRLF;

          mimeStr += att.value.replace(/(.{72})/g, "$1\r\n") + CRLF;
        }
      }

      mimeStr += "--" + boundary + "--" + CRLF;
    }

    return {
      data: mimeStr,
      compFields: composeFields
    };
  },

  createAddress: function(pepUserId) {
    let m = "";
    if ("username" in pepUserId) {
      m = pepUserId.username + " ";
    }
    m += "<" + pepUserId.address + ">";

    return m;
  },

  sendMessage: function(pepMessage, listener = null) {
    EnigmailLog.DEBUG("pEpMessage.sendMessage()\n");

    let msg = this.mimeStringFromMessage(pepMessage);

    return EnigmailSend.sendMessage(msg.data, msg.compFields, listener);
  },


  getTestMessage: function() {
    return testMessage;
  },

  getTestKeySync: function() {
    return keySyncMsg;
  }
};
