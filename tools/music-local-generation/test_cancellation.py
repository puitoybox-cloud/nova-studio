"""Cancellation contracts, without substituting these tests for real inference."""
import unittest
from unittest.mock import patch
from cancellation import ComposerJobs
from compose import compose


class Cancellation(unittest.TestCase):
    def test_cancel_active_and_never_reuse_ids(self):
        jobs = ComposerJobs(); key = 'whole_test_active_123'
        check = jobs.begin(key); check(); jobs.cancel(key)
        with self.assertRaisesRegex(ValueError, 'cancelled'): check()
        jobs.finish(key)
        with self.assertRaisesRegex(ValueError, 'reused'): jobs.begin(key)
        jobs.begin('whole_new_session_123')()

    def test_late_request_and_capacity_are_bounded(self):
        jobs = ComposerJobs(); key = 'whole_test_pending_123'
        jobs.cancel(key)
        with self.assertRaisesRegex(ValueError, 'cancelled'): jobs.begin(key)
        for n in range(1023): jobs.cancel('whole_pending_%05d' % n)
        with self.assertRaisesRegex(ValueError, 'registry-full'): jobs.cancel('whole_pending_overflow')
        self.assertEqual(len(jobs.jobs), 1024)
        for key in [None, '', 'short', '../outside/' * 3]:
            with self.assertRaisesRegex(ValueError, 'invalid-compose-request-id'): jobs.cancel(key)

    def test_abandoned_request_expires_between_model_steps(self):
        jobs = ComposerJobs()
        with patch('cancellation.time.monotonic', return_value=100):
            check = jobs.begin('whole_deadline_test_123')
            check()
        with patch('cancellation.time.monotonic', return_value=340):
            with self.assertRaisesRegex(ValueError, 'deadline-exceeded'): check()
        jobs.finish('whole_deadline_test_123')
        with self.assertRaisesRegex(ValueError, 'reused'): jobs.begin('whole_deadline_test_123')

    def test_cancelled_composition_does_not_import_or_open_model(self):
        def cancelled(): raise ValueError('test-cancelled')
        with self.assertRaisesRegex(ValueError, 'test-cancelled'):
            compose('/not/a/model', '/not/an/output', cancel=cancelled)


if __name__ == '__main__': unittest.main()
