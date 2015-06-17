#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
FROM ubuntu

RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get install -y zip
RUN apt-get install -y wget
RUN apt-get install -y xvfb
RUN apt-get install -y thunderbird
RUN apt-get install -y gnupg2
RUN apt-get install -y make
RUN apt-get install -y python
RUN apt-get install -y gcc
RUN apt-get install -y psmisc
RUN apt-get install -y language-pack-en-base
RUN apt-get install -y mime-support
RUN apt-get install -y rng-tools
RUN apt-get install -y haveged
RUN wget -O /tmp/jsunit-0.1.xpi https://www.enigmail.net/jsunit/jsunit-0.1.xpi
RUN rm -rf /usr/lib/thunderbird-addons/extensions/jsunit@enigmail.net
RUN unzip /tmp/jsunit-0.1.xpi -d /usr/lib/thunderbird-addons/extensions/jsunit@enigmail.net
RUN rm -rf '/usr/lib/thunderbird-addons/extensions/{847b3a00-7ab1-11d4-8f02-006008948af5}'
RUN echo "/enigmail-src/build/dist" > '/usr/lib/thunderbird-addons/extensions/{847b3a00-7ab1-11d4-8f02-006008948af5}'
WORKDIR /enigmail-src
ENV LC_CTYPE en_US.UTF-8
ENV LANG en_US.UTF-8
