from datetime import datetime
from zoneinfo import ZoneInfo


class SessionManager:
    """Session windows using real IANA time zones so DST is handled automatically."""

    LONDON_TZ = ZoneInfo("Europe/London")
    NEW_YORK_TZ = ZoneInfo("America/New_York")

    @staticmethod
    def _hour_minute(tz_name: str):
        now = datetime.now(ZoneInfo(tz_name))
        return now.hour, now.minute

    def london_open(self):
        hour, _ = self._hour_minute("Europe/London")
        return 8 <= hour < 17

    def newyork_open(self):
        hour, _ = self._hour_minute("America/New_York")
        return 8 <= hour < 17

    def current_session(self):
        if self.london_open():
            return "LONDON"
        if self.newyork_open():
            return "NEW YORK"
        return "CLOSED"

    def can_trade(self, allow_london, allow_ny, demo_mode=False):
        if demo_mode:
            return True
        if allow_london and self.london_open():
            return True
        if allow_ny and self.newyork_open():
            return True
        return False
