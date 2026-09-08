from fastapi import APIRouter, HTTPException

from services.config_service import ConfigError, load_config, save_config

router = APIRouter()


@router.get("/")
def get_config():
    return load_config()


@router.post("/")
def update_config(config: dict):
    try:
        current = load_config()
        current.update(config)
        validated = save_config(current)
    except ConfigError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return {"success": True, "config": validated}
