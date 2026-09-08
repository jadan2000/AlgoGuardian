from pydantic import BaseModel

class Config(BaseModel):
    symbol: str
    max_risk: float
    trade_size: float
    account: str
