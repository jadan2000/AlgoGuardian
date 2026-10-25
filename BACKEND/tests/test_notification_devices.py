import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from services import notification_devices


class NotificationDeviceRegistryTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.registry_path = Path(self.temp_dir.name) / "notification_devices.json"
        self.path_patch = patch.object(notification_devices, "_REGISTRY_FILE", self.registry_path)
        self.path_patch.start()

    def tearDown(self):
        self.path_patch.stop()
        self.temp_dir.cleanup()

    def test_register_device_and_never_return_tokens_from_listing(self):
        token = "fcm-device-token-" + "a" * 40
        result = notification_devices.register_device(token, "Jibril phone")
        self.assertTrue(result["registered"])
        self.assertEqual(result["device_count"], 1)
        self.assertEqual(notification_devices.registered_tokens(), [token])
        listed = notification_devices.list_devices()
        self.assertEqual(listed[0]["device_name"], "Jibril phone")
        self.assertNotIn("token", listed[0])

    def test_registering_same_token_updates_name_without_duplicate(self):
        token = "fcm-device-token-" + "b" * 40
        notification_devices.register_device(token, "Old name")
        result = notification_devices.register_device(token, "Updated phone")
        self.assertEqual(result["device_count"], 1)
        self.assertEqual(notification_devices.list_devices()[0]["device_name"], "Updated phone")

    def test_remove_device_only_removes_matching_token(self):
        token_a = "fcm-device-token-" + "c" * 40
        token_b = "fcm-device-token-" + "d" * 40
        notification_devices.register_device(token_a, "Phone A")
        notification_devices.register_device(token_b, "Phone B")
        self.assertTrue(notification_devices.remove_device(token_a))
        self.assertFalse(notification_devices.remove_device(token_a))
        self.assertEqual(notification_devices.registered_tokens(), [token_b])

    def test_registry_has_a_ten_device_limit(self):
        for index in range(10):
            notification_devices.register_device("fcm-device-token-" + str(index) + "x" * 40, f"Phone {index}")
        with self.assertRaisesRegex(ValueError, "at most 10"):
            notification_devices.register_device("fcm-device-token-overflow-" + "z" * 40, "Extra")

    def test_corrupt_registry_is_not_silently_overwritten(self):
        self.registry_path.write_text("{not-json", encoding="utf-8")
        with self.assertRaises(notification_devices.NotificationRegistryError):
            notification_devices.register_device("fcm-device-token-" + "e" * 40, "Phone")


if __name__ == "__main__":
    unittest.main()
