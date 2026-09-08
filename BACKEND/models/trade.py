from pydantic import BaseModel

class Trade(BaseModel):
    symbol: str
    side: str
    size: float
    price: float
    status: str
