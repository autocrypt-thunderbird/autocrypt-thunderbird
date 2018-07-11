/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Emulates pinentry programs, with a static PIN
// This can be used to bypass PIN requirement while using GnuPG/scdaemon
// and automation. Another solution is to use PSCS/OpenSC.

// Obviously, this is a hack, even if it's pretty damn clean.
// This means, do not use this if you do not know what you are doing.

// This version of pinentry-auto is adapted for use on Windows, where
// shell scripts can't be used as replacement for pinentry

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define USER_PIN "STRIKEfreedom@Qu1to"

size_t getline(char **lineptr, size_t *n, FILE *stream) {
    char *bufptr = NULL;
    char *p = bufptr;
    size_t size;
    int c;

    if (lineptr == NULL) {
    	return -1;
    }
    if (stream == NULL) {
    	return -1;
    }
    if (n == NULL) {
    	return -1;
    }
    bufptr = *lineptr;
    size = *n;

    c = fgetc(stream);
    if (c == EOF) {
    	return -1;
    }
    if (bufptr == NULL) {
    	bufptr = malloc(128);
    	if (bufptr == NULL) {
    		return -1;
    	}
    	size = 128;
    }
    p = bufptr;
    while(c != EOF) {
    	if ((p - bufptr) > (size - 1)) {
    		size = size + 128;
    		bufptr = realloc(bufptr, size);
    		if (bufptr == NULL) {
    			return -1;
    		}
    	}
    	*p++ = c;
    	if (c == '\n') {
    		break;
    	}
    	c = fgetc(stream);
    }

    *p++ = '\0';
    *lineptr = bufptr;
    *n = size;

    return p - bufptr - 1;
}

void toLowerCase(char* str) {
  int i;
  
  for (i = 0; i < strlen(str); i++) {
    if (str[i] >= 'A' && str[i] <= 'Z') {
      str[i] = str[i] + 32;
    }
  }
}

// remove trailing \r and \n from a string
void chomp(char* str) {
  int i;
  for (i = strlen(str) - 1; i >= 0; i-- ) {
    if (str[i] == '\n' || str[i] == '\r') {
      str[i] = 0;
    }
    else {
      return;
    }
  }
  
}

void reply_d(char* str)
{
	printf("D %s\n", str);
	printf("OK\n");
  fflush(stdout);
}

void reply_pid()
{
	printf("D %d\n", getpid());
	printf("OK\n");
  fflush(stdout);
}


void reply_ok(char* str)
{
	printf("OK %s\n", str);
  fflush(stdout);
}

void error()
{
	printf("ERR 83886355 unknown command\n");
  fflush(stdout);
  
}


int main( ) {

  printf("OK Your orders please\n");
  fflush(stdout);
  
  char *line = NULL;
  size_t size;
  
  int l = getline(&line, &size, stdin);
  
  while ( l != -1) {

    chomp(line);
    toLowerCase(line);
    
    if (strcmp(line, "getpin") == 0) {
      reply_d(USER_PIN);
    }
    else if (strcmp(line, "bye") == 0) {
      reply_ok("closing connection");
      break;
    }
    else if (strcmp(line, "getinfo pid") == 0) {
      reply_pid();
    }
    else {
      // This generally includes OPTION, SETDESC, SETPROMPT
      // i.e. things we don't care for if we're not displaying
      // a prompt
       reply_ok("");
		}
    
    l = getline(&line, &size, stdin);
  }

  return 0;
}