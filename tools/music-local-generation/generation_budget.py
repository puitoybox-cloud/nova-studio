"""Bound sequential decoding by musical range, without changing sampled tokens."""
import resource
import sys


class RangeBudget:
    def __init__(self, tokenizer, prompt, max_ticks, source):
        self.tokenizer = tokenizer
        self.max_ticks = max_ticks
        self.beats = 0
        self.anchor = None if source else 0
        for row in prompt:
            event = tokenizer.tokens2event(row)
            if event:
                self.beats += event[1]

    def reached(self, row):
        event = self.tokenizer.tokens2event(row)
        if not event:
            return False
        self.beats += event[1]
        if self.anchor is None and event[0] == 'note':
            self.anchor = self.beats * 480 + event[2] * 30
        # time2 can move backwards within a beat; only the monotonic beat
        # lower bound proves that every subsequent event is outside the range.
        return self.anchor is not None and self.beats * 480 >= self.anchor + self.max_ticks


def memory_snapshot():
    # ru_maxrss is a process lifetime high-water mark, not a per-request peak.
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    result = {'processPeakRssBytes': int(peak if sys.platform == 'darwin' else peak * 1024),
              'peakScope': 'host-process-lifetime'}
    if sys.platform.startswith('linux'):
        try:
            from pathlib import Path
            for line in Path('/proc/self/status').read_text().splitlines():
                if line.startswith('VmRSS:'):
                    result['rssBytes'] = int(line.split()[1]) * 1024
        except (OSError, ValueError):
            pass
    return result
