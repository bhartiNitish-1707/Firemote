import logging

from homeassistant.components.remote import RemoteEntity, SUPPORT_SEND_COMMAND, SUPPORT_TURN_ON, SUPPORT_TURN_OFF
from homeassistant.const import CONF_NAME
from homeassistant.helpers.typing import ConfigType

from .const import (
    CONF_ANDROID_TV_REMOTE_ID,
    CONF_APPLE_TV_REMOTE_ID,
    CONF_COMPATIBILITY_MODE,
    CONF_DEVICE_FAMILY,
    CONF_DEVICE_TYPE,
    CONF_DEVICES,
    CONF_MEDIA_PLAYER_ID,
    CONF_REMOTE_ID,
    CONF_ROKU_REMOTE_ID,
    DEFAULT_COMPATIBILITY_MODE,
    DOMAIN,
)
from .adapter import FiremoteAdapter

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(hass, config: ConfigType, async_add_entities, discovery_info=None):
    device_configs = config.get(DOMAIN, {}).get(CONF_DEVICES, [])
    entities = []

    for device_config in device_configs:
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
        entities.append(FiremoteRemote(device_config[CONF_NAME], adapter))

    if entities:
        async_add_entities(entities, True)


class FiremoteRemote(RemoteEntity):
    def __init__(self, name: str, adapter: FiremoteAdapter) -> None:
        self._name = name
        self._adapter = adapter

    @property
    def name(self) -> str:
        return self._name

    @property
    def supported_features(self) -> int:
        return SUPPORT_SEND_COMMAND | SUPPORT_TURN_ON | SUPPORT_TURN_OFF

    @property
    def extra_state_attributes(self):
        return {
            "media_player_id": self._adapter.entity_id,
            "device_family": self._adapter.device_family,
            "remote_id": self._adapter.remote_id,
        }

    async def async_send_command(self, command, **kwargs):
        if isinstance(command, list):
            commands = command
        else:
            commands = [command]

        for command_item in commands:
            if not command_item:
                continue
            await self._adapter.send_command(str(command_item))

    async def async_turn_on(self, **kwargs):
        await self._adapter.toggle_power()

    async def async_turn_off(self, **kwargs):
        await self._adapter.toggle_power()

    async def async_play_media(self, media_type: str, media_id: str, **kwargs):
        if media_type == "app":
            await self._adapter.launch_app(media_id)
        elif media_type == "source":
            await self._adapter.switch_source(media_id)
        else:
            _LOGGER.debug("Unsupported media_type for Firemote remote: %s", media_type)
