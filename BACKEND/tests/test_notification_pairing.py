import unittest
from unittest.mock import patch

from services import notification_pairing


class NotificationPairingTests(unittest.TestCase):
    def setUp(self):
        notification_pairing._CODES.clear()

    def tearDown(self):
        notification_pairing._CODES.clear()

    def test_pairing_code_is_single_use(self):
        with patch.object(notification_pairing.time, "monotonic", return_value=100.0):
            created = notification_pairing.create_code("http://192.168.1.12:8000")
        with patch.object(notification_pairing.time, "monotonic", return_value=101.0):
            first = notification_pairing.consume_code(created["code"])
            second = notification_pairing.consume_code(created["code"])
        self.assertEqual(first, {"backend_url": "http://192.168.1.12:8000"})
        self.assertIsNone(second)

    def test_pairing_code_expires(self):
        with patch.object(notification_pairing.time, "monotonic", return_value=100.0):
            created = notification_pairing.create_code("http://192.168.1.12:8000")
        with patch.object(notification_pairing.time, "monotonic", return_value=281.0):
            self.assertIsNone(notification_pairing.consume_code(created["code"]))

    def test_expired_codes_are_cleaned_before_new_code(self):
        with patch.object(notification_pairing.time, "monotonic", return_value=100.0):
            first = notification_pairing.create_code("http://192.168.1.12:8000")
        with patch.object(notification_pairing.time, "monotonic", return_value=281.0):
            notification_pairing.create_code("http://192.168.1.13:8000")
        self.assertNotIn(first["code"], notification_pairing._CODES)


if __name__ == "__main__":
    unittest.main()
