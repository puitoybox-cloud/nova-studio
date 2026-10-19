import unittest
from generation_budget import RangeBudget, memory_snapshot

class Tokenizer:
    def tokens2event(self, row): return row

class BudgetTests(unittest.TestCase):
    def test_future_subbeat_can_move_backwards(self):
        b = RangeBudget(Tokenizer(), [], 1920, False)
        self.assertFalse(b.reached(['note', 3, 15]))
        self.assertFalse(b.reached(['note', 0, 0]))
        self.assertTrue(b.reached(['note', 1, 0]))

    def test_source_anchor_uses_first_continuation_not_prompt_end(self):
        b = RangeBudget(Tokenizer(), [['note', 7, 8]], 1920, True)
        self.assertFalse(b.reached(['set_tempo', 2, 0]))
        self.assertFalse(b.reached(['note', 3, 8]))
        self.assertFalse(b.reached(['note', 4, 0]))
        self.assertTrue(b.reached(['note', 1, 0]))

    def test_control_event_can_prove_range_end_and_invalid_row_ignored(self):
        b = RangeBudget(Tokenizer(), [], 480, False)
        self.assertFalse(b.reached([]))
        self.assertTrue(b.reached(['set_tempo', 1, 0]))

    def test_actual_v2_token_clock_matches_detokenized_range(self):
        from vendor.midi_tokenizer import MIDITokenizer
        t = MIDITokenizer('v2')
        rows = t.tokenize([480, [['patch_change',0,0,0], ['note',0,360,0,60,80], ['note',480,360,0,64,80], ['note',1920,360,0,67,80]]])
        b = RangeBudget(t, [], 1920, False)
        stopped = False
        for row in rows:
            if b.reached(row):
                event = t.tokens2event(row)
                self.assertEqual(event[0], 'note')
                stopped = True
                break
        self.assertTrue(stopped)

    def test_memory_labels_lifetime_scope(self):
        m = memory_snapshot()
        self.assertGreater(m['processPeakRssBytes'], 0)
        self.assertEqual(m['peakScope'], 'host-process-lifetime')

if __name__ == '__main__': unittest.main()
