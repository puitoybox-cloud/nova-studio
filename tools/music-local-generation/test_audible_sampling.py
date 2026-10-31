"""Empty model responses are retried explicitly; no synthetic success path."""
import unittest
from compose import audible_sample


class AudibleSamplingTests(unittest.TestCase):
    def test_empty_sample_retries_with_recorded_distinct_actual_seed(self):
        calls = []
        def sample(seed):
            calls.append(seed)
            if len(calls) == 1:
                raise ValueError('model produced no audible notes; generation incomplete')
            return b'real-inference-output'
        result, seed, attempts = audible_sample(sample, 72, 0)
        self.assertEqual((result, seed, attempts), (b'real-inference-output', 75, 2))
        self.assertEqual(calls, [72, 75])

    def test_three_empty_samples_fail_without_publishing_a_candidate(self):
        calls = []
        def sample(seed):
            calls.append(seed)
            raise ValueError('model produced no audible notes; generation incomplete')
        with self.assertRaisesRegex(ValueError, 'no audible notes'):
            audible_sample(sample, 72, 1)
        self.assertEqual(calls, [73, 76, 79])

    def test_invalid_output_or_cancellation_is_not_retried(self):
        for error in [ValueError('corrupt-model-output'), InterruptedError('cancelled')]:
            calls = []
            def sample(seed):
                calls.append(seed)
                raise error
            with self.assertRaises(type(error)):
                audible_sample(sample, 72, 0)
            self.assertEqual(calls, [72])

    def test_source_conditioned_empty_sample_retries_and_variant_seeds_do_not_overlap(self):
        first = True
        def sample(seed):
            nonlocal first
            if first:
                first = False
                raise ValueError('model produced no new source-conditioned notes')
            return seed
        self.assertEqual(audible_sample(sample, 72, 2), (77, 77, 2))
        seeds = {(2147483645 + i + 3 * a) % 2147483648 for i in range(3) for a in range(3)}
        self.assertEqual(len(seeds), 9)


if __name__ == '__main__': unittest.main()
