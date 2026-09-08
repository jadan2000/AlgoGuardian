from fastapi import APIRouter
from services.config_service import load_config, save_config

router = APIRouter()


@router.get("/")
def get_config():
    return load_config()


@router.post("/")
def update_config(config: dict):

    current = load_config()

    current.update(config)

    save_config(current)

    return {
        "success": True,
        "config": current
    }