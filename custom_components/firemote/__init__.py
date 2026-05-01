import logging

import voluptuous as vol
from homeassistant.const import CONF_NAME, Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import (
    ATTR_COMMAND,
    ATTR_DEVICE_NAME,
    ATTR_TEXT,
    ATTR_VOLUME_LEVEL,
    CONF_ANDROID_TV_REMOTE_ID,
    CONF_APPLE_TV_REMOTE_ID,
    CONF_COMPATIBILITY_MODE,
    CONF_DEVICE_FAMILY,
    CONF_DEVICE_TYPE,
    CONF_DEVICES,
    CONF_MEDIA_PLAYER_ID,
    CONF_REMOTE_ID,
    CONF_ROKU_REMOTE_ID,
    DOMAIN,
    DEFAULT_COMPATIBILITY_MODE,
    SERVICE_LAUNCH_APP,
    SERVICE_SEND_COMMAND,
    SERVICE_SEND_TEXT,
    SERVICE_SET_VOLUME,
    SERVICE_TOGGLE_POWER,
    SUPPORTED_FAMILIES,
)

_LOGGER = logging.getLogger(__name__)

DEVICE_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_NAME): cv.string,
        vol.Required(CONF_DEVICE_FAMILY): vol.In(SUPPORTED_FAMILIES),
        vol.Required(CONF_MEDIA_PLAYER_ID): cv.entity_id,
        vol.Optional(CONF_REMOTE_ID): cv.entity_id,
        vol.Optional(CONF_ANDROID_TV_REMOTE_ID): cv.entity_id,
        vol.Optional(CONF_ROKU_REMOTE_ID): cv.entity_id,
        vol.Optional(CONF_APPLE_TV_REMOTE_ID): cv.entity_id,
        vol.Optional(CONF_DEVICE_TYPE): cv.string,
        vol.Optional(CONF_COMPATIBILITY_MODE, default=DEFAULT_COMPATIBILITY_MODE): cv.string,
    }
)

CONFIG_SCHEMA = vol.Schema(
    {
        DOMAIN: vol.Schema(
            {
                vol.Required(CONF_DEVICES): vol.All(cv.ensure_list, [DEVICE_SCHEMA])
            }
        )
    },
    extra=vol.ALLOW_EXTRA,
)

PLATFORMS = [Platform.REMOTE]

SERVICES = {
    SERVICE_SEND_COMMAND: {
        "schema": vol.Schema(
            {
                vol.Required(ATTR_DEVICE_NAME): cv.string,
                vol.Required(ATTR_COMMAND): cv.string,
            }
        )
    },
    SERVICE_LAUNCH_APP: {
        "schema": vol.Schema(
            {
                vol.Required(ATTR_DEVICE_NAME): cv.string,
                vol.Required("app_name"): cv.string,
            }
        )
    },
    SERVICE_TOGGLE_POWER: {
        "schema": vol.Schema({vol.Required(ATTR_DEVICE_NAME): cv.string})
    },
    SERVICE_SET_VOLUME: {
        "schema": vol.Schema(
            {
                vol.Required(ATTR_DEVICE_NAME): cv.string,
                vol.Required(ATTR_VOLUME_LEVEL): vol.Coerce(float),
            }
        )
    },
    SERVICE_SEND_TEXT: {
        "schema": vol.Schema(
            {
                vol.Required(ATTR_DEVICE_NAME): cv.string,
                vol.Required(ATTR_TEXT): cv.string,
            }
        )
    },
}

PLATFORMS = []


def _find_device(config, device_name):
    devices = config.get(CONF_DEVICES, [])
    for device in devices:
        if device_name == device.get(CONF_NAME):
            return device
        if device_name == device.get(CONF_MEDIA_PLAYER_ID):
            return device
        if device_name == device.get(CONF_REMOTE_ID):
            return device
        if device_name == device.get(CONF_ANDROID_TV_REMOTE_ID):
            return device
        if device_name == device.get(CONF_ROKU_REMOTE_ID):
            return device
        if device_name == device.get(CONF_APPLE_TV_REMOTE_ID):
            return device
    return None


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    hass.data[DOMAIN] = config.get(DOMAIN, {})

    async def async_service_handler(service):
        device_name = service.data[ATTR_DEVICE_NAME]
        device_config = _find_device(hass.data[DOMAIN], device_name)
        if device_config is None:
            _LOGGER.warning("Firemote service call target not found: %s", device_name)
            return

        from .adapter import FiremoteAdapter

        adapter = FiremoteAdapter(
            hass,
            device_config[CONF_MEDIA_PLAYER_ID],
            device_config[CONF_DEVICE_FAMILY],
            remote_id=device_config.get(CONF_REMOTE_ID),
            android_tv_remote_id=device_config.get(CONF_ANDROID_TV_REMOTE_ID),
            apple_tv_remote_id=device_config.get(CONF_APPLE_TV_REMOTE_ID),
            roku_remote_id=device_config.get(CONF_ROKU_REMOTE_ID),
            device_type=device_config.get(CONF_DEVICE_TYPE),
            compatibility_mode=device_config.get(CONF_COMPATIBILITY_MODE, DEFAULT_COMPATIBILITY_MODE),
        )

        if service.service == SERVICE_SEND_COMMAND:
            await adapter.send_command(service.data[ATTR_COMMAND])
        elif service.service == SERVICE_LAUNCH_APP:
            await adapter.launch_app(service.data["app_name"])
        elif service.service == SERVICE_TOGGLE_POWER:
            await adapter.toggle_power()
        elif service.service == SERVICE_SET_VOLUME:
            await adapter.set_volume(service.data[ATTR_VOLUME_LEVEL])
        elif service.service == SERVICE_SEND_TEXT:
            await adapter.send_text(service.data[ATTR_TEXT])

    for service_name, service_info in SERVICES.items():
        hass.services.async_register(
            DOMAIN,
            service_name,
            async_service_handler,
            schema=service_info["schema"],
        )

    return True
