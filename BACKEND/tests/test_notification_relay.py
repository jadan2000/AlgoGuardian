import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from services import notification_relay


class NotificationRelayIdentityTests(unittest.TestCase):
    def test_identity_is_created_once_and_reused(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "notification_identity.json"
            with patch.object(notification_relay, "_IDENTITY_FILE", path):
                first = notification_relay._read_or_create_identity()
                second = notification_relay._read_or_create_identity()
            self.assertEqual(first, second)
            self.assertEqual(len(first["installation_id"]), 36)
            self.assertGreaterEqual(len(first["installation_secret"]), 40)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), first)

    def test_corrupt_identity_fails_closed_instead_of_rotating(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "notification_identity.json"
            path.write_text("{bad json", encoding="utf-8")
            with patch.object(notification_relay, "_IDENTITY_FILE", path):
                with self.assertRaises(notification_relay.NotificationRelayError):
                    notification_relay._read_or_create_identity()


if __name__ == "__main__":
    unittest.main()
