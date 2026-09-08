from datetime import datetime


class SessionManager:

    def london_open(self):

        hour = datetime.utcnow().hour

        return 8 <= hour < 17

    def newyork_open(self):

        hour = datetime.utcnow().hour

        return 13 <= hour < 22

    def can_trade(
        self,
        allow_london,
        allow_ny,
        demo_mode=False
    ):

        if demo_mode:
            return True

        if allow_london and self.london_open():
            return True

        if allow_ny and self.newyork_open():
            return True

        return False