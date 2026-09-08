from fastapi import APIRouter
from services.log_service import get_logs

router = APIRouter()

@router.get("/")
def list_logs():
    return get_logs()
