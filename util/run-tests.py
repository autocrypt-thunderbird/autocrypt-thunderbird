#!/usr/bin/env python
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

from __future__ import print_function

import sys
import os
import subprocess
import select
import re
import random

class TestRunner:
    IGNORED_TESTS = ['./ipc/tests']
    TEST_OUTPUT_FILE = 'test_output.log'

    @staticmethod
    def is_test_file(file):
        return file.endswith("-test.js")

    @staticmethod
    def is_ignored(root, file):
        for ign in TestRunner.IGNORED_TESTS:
            if os.path.join(root, file).startswith(ign):
                return True
        return False

    @staticmethod
    def all_tests():
        for root, dirs, files in os.walk("."):
            for file in files:
                if TestRunner.is_test_file(file) and not TestRunner.is_ignored(root, file):
                    yield os.path.join(root, file)

    def __init__(self, tbpath, tests):
        self.tbpath = tbpath
        self.tests = tests

    def reset_total(self):
        self.total_executed = 0
        self.total_succeeded = 0
        self.total_failed = 0

    def reset_stats(self):
        self.executed = 0
        self.succeeded = 0
        self.failed = 0

    def run(self):
        with open(TestRunner.TEST_OUTPUT_FILE, 'w') as test_output:
            self.test_output = test_output
            self.reset_total()
            for t in self.tests:
                self.run_test(t)
            return (self.total_executed, self.total_succeeded, self.total_failed)

    def start_poll(self, tsk):
        poll = select.poll()
        poll.register(tsk.stdout,select.POLLIN | select.POLLHUP)
        poll.register(tsk.stderr,select.POLLIN | select.POLLHUP)
        return poll

    def check_output(self, rfd, std, on):
        if rfd == std.fileno():
            line = std.readline()
            if len(line) > 0:
                on(line[:-1])

    def poll(self, pollc, events, poll, tsk, on_stdout, on_stderr):
        for event in events:
            (rfd,event) = event
            if event & select.POLLIN:
                self.check_output(rfd, tsk.stdout, on_stdout)
                self.check_output(rfd, tsk.stderr, on_stderr)
            if event & select.POLLHUP:
                poll.unregister(rfd)
                pollc = pollc - 1
            if pollc > 0:
                events = poll.poll()
        return (pollc, events)

    def polling(self, tsk, on_stdout, on_stderr):
        pollc = 2
        poll = self.start_poll(tsk)
        events = poll.poll()
        while pollc > 0 and len(events) > 0:
            (pollc, events) = self.poll(pollc, events, poll, tsk, on_stdout, on_stderr)
        return tsk.wait()

    def is_jsunit(self, str):
        return str.startswith("TestResult: ") or str.startswith("AssertionError: ") or str.startswith("RuntimeError: ")

    def extract_number(self, str):
        return int(re.search('\d+', str).group(0))

    def analyze_output(self, str):
        if str.startswith("TestResult: executed :"):
            self.executed = self.extract_number(str)
        elif str.startswith("TestResult: succeeded:"):
            self.succeeded = self.extract_number(str)
        elif str.startswith("TestResult: failed   :"):
            self.failed = self.extract_number(str)
        elif str.startswith("Succeed: "):
            pass
        else:
            print(str)

    def write_to_log(self):
        def ret(str):
            if self.test_output:
                self.test_output.write(str + "\n")
                self.test_output.flush()
        return ret

    def combine(self, left, right):
        def ret(str):
            left(str)
            right(str)
        return ret

    def reporting(self):
        def ret(str):
            if self.is_jsunit(str):
                self.analyze_output(str)
        return ret

    def add_stats(self):
        self.total_executed = self.total_executed + self.executed
        self.total_succeeded = self.total_succeeded + self.succeeded
        self.total_failed = self.total_failed + self.failed
    def spin_test(self, dir_name, tmp_file):
        tsk = subprocess.Popen([self.tbpath, '-jsunit', os.path.basename(tmp_file)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=dir_name)
        ret = self.polling(tsk, self.combine(self.write_to_log(), self.reporting()), self.write_to_log())
        self.add_stats()
        return ret

    def run_test(self, t):
        test_name = os.path.basename(t)
        dir_name = os.path.dirname(t)
        tmp_file = t.replace(".js", "-loader.js")
        print("running", t, test_name)

        self.reset_stats()

        try:
            with open(tmp_file, 'w') as f:
                f.write("do_subtest(\"" + test_name + "\");\n")
            return self.spin_test(dir_name, tmp_file)
        finally:
            os.remove(tmp_file)


class OptionsEvaluator:
    SEED_OPTION = ['--seed=', '-s=']
    HELP_OPTION = ['-h', '--help']

    @staticmethod
    def print_help():
        print('Usage: run-tests.py [OPTION] [PATH TO TEST FILES]')
        print('')
        print('By default, this will run all the tests in random order based on a seed, which will be printed before the tests. You can rerun an order by using the -seed option below.')
        print('  [OPTIONS]')
        print('  --seed=\t Specify a seed to get the same shuffle order more than once')
        print('  -h, --help\t Print usage')

    @staticmethod
    def random_shuffle(seed, tests):
        if seed:
            random.seed(seed)
        else:
            seed = random.randint(0, sys.maxint)
            random.seed(seed)
            print("Seed used for random shuffle: %d" % seed)
        random.shuffle(tests)
        return tests

    def evaluate(self):
        for op in OptionsEvaluator.HELP_OPTION:
            if op in sys.argv:
                self.print_help()
                sys.exit(1)

        if len(sys.argv) == 1:
            return OptionsEvaluator.random_shuffle(False, [f for f in TestRunner.all_tests()])
        elif len(sys.argv) == 2:
            tests = [f for f in TestRunner.all_tests()]
        elif len(sys.argv) > 2:
            tests = [f for f in sys.argv[2:]]

        if self.grab_seed():
            return OptionsEvaluator.random_shuffle(self.grab_seed(), tests)
        else:
            return OptionsEvaluator.random_shuffle(False, [f for f in sys.argv[1:]])

    def grab_seed(self):
        for op in OptionsEvaluator.SEED_OPTION:
            for arg in sys.argv:
                if op in arg:
                    return arg.split(op)[1]
        return False

if __name__ == '__main__':
    tbpath = os.environ.get('TB_PATH', '/usr/bin/thunderbird')
    tests = OptionsEvaluator().evaluate()
    (ran, suc, fail) = TestRunner(tbpath, tests).run()
    print("Ran " + str(ran) + " tests")
    if fail > 0:
        print("  Had " + str(fail) + " failures")
        sys.exit(1)
