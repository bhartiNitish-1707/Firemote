import json
import logging
from typing import Any, Dict, Iterable, Optional, Sequence

from homeassistant.core import HomeAssistant

from .const import (
    APPLE_TV_FAMILY,
    CHROMECAST_FAMILY,
    FIRE_TV_FAMILY,
    HOMATICS_FAMILY,
    NVIDIA_SHIELD_FAMILY,
    ONN_FAMILY,
    ROKU_FAMILY,
    XIAOMI_FAMILY,
)
from .device_models import is_stick_model, resolve_event_path

_LOGGER = logging.getLogger(__name__)


class FiremoteAdapter:
    def __init__(
        self,
        hass: HomeAssistant,
        entity_id: str,
        device_family: str,
        remote_id: Optional[str] = None,
        android_tv_remote_id: Optional[str] = None,
        apple_tv_remote_id: Optional[str] = None,
        roku_remote_id: Optional[str] = None,
        device_type: Optional[str] = None,
        compatibility_mode: Optional[str] = None,
    ) -> None:
        self.hass = hass
        self.entity_id = entity_id
        self.device_family = device_family
        self.remote_id = remote_id
        self.android_tv_remote_id = android_tv_remote_id
        self.apple_tv_remote_id = apple_tv_remote_id
        self.roku_remote_id = roku_remote_id
        self.device_type = device_type
        self.compatibility_mode = compatibility_mode or "default"

        self.event_path = resolve_event_path(device_type, self.compatibility_mode)
        self.use_strong_mode = self.compatibility_mode == "strong" or self.event_path == "undefined"
        self.atv_remote = (
            self.android_tv_remote_id
            if self.android_tv_remote_id and self.device_family != FIRE_TV_FAMILY
            else None
        )

    async def _async_call_service(self, domain: str, service: str, data: Dict[str, Any]) -> None:
        await self.hass.services.async_call(domain, service, data, blocking=True)

    async def adb(self, command: str) -> None:
        await self._async_call_service(
            "androidtv",
            "adb_command",
            {"entity_id": self.entity_id, "command": command},
        )

    async def remote_cmd(
        self,
        remote_entity_id: Optional[str],
        command: str,
        options: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not remote_entity_id:
            return

        data: Dict[str, Any] = {"entity_id": remote_entity_id, "command": [command]}
        if options:
            data.update(options)

        await self._async_call_service("remote", "send_command", data)

    async def media_player_service(self, service: str, extra: Optional[Dict[str, Any]] = None) -> None:
        data = {"entity_id": self.entity_id}
        if extra:
            data.update(extra)
        await self._async_call_service("media_player", service, data)

    def _sendevent_tap(self, key_code: int) -> str:
        return (
            f"sendevent {self.event_path} 1 {key_code} 1 && "
            f"sendevent {self.event_path} 0 0 0 && "
            f"sendevent {self.event_path} 1 {key_code} 0 && "
            f"sendevent {self.event_path} 0 0 0"
        )

    async def send_command(self, command: str) -> None:
        if not command:
            return

        command = command.strip()

        if command == "up":
            await self._nav_key("up", "KEYCODE_DPAD_UP", "UP", 103)
        elif command == "down":
            await self._nav_key("down", "KEYCODE_DPAD_DOWN", "DOWN", 108)
        elif command == "left":
            await self._nav_key("left", "KEYCODE_DPAD_LEFT", "LEFT", 105)
        elif command == "right":
            await self._nav_key("right", "KEYCODE_DPAD_RIGHT", "RIGHT", 106)
        elif command in ("center", "select"):
            await self._center_key()
        elif command == "back":
            await self._back_key()
        elif command == "home":
            await self._home_key()
        elif command in ("menu", "hamburger"):
            await self._menu_key()
        elif command == "play_pause":
            await self._play_pause()
        elif command == "rewind":
            await self._rewind()
        elif command == "fast_forward":
            await self._fast_forward()
        elif command == "replay":
            if self.device_family == ROKU_FAMILY and self.roku_remote_id:
                await self.remote_cmd(self.roku_remote_id, "replay")
        elif command == "options":
            if self.device_family == ROKU_FAMILY and self.roku_remote_id:
                await self.remote_cmd(self.roku_remote_id, "info")
        elif command == "volume_up":
            await self.volume_up()
        elif command == "volume_down":
            await self.volume_down()
        elif command == "mute":
            await self._mute()
        elif command == "channel_up":
            await self._channel_up()
        elif command == "channel_down":
            await self._channel_down()
        elif command == "power":
            await self.toggle_power()
        elif command == "profile":
            await self.adb("adb shell input keyevent KEYCODE_PROFILE_SWITCH")
        elif command == "apps":
            await self._apps_key()
        elif command == "settings":
            await self._settings_key()
        elif command == "app_switch":
            await self._app_switch()
        elif command == "tv":
            await self._tv_key()
        elif command == "headset":
            await self._headset_key()
        elif command == "programmable_1":
            await self._programmable_1()
        elif command == "programmable_2":
            await self._programmable_2()
        elif command == "info":
            if self.device_family == HOMATICS_FAMILY:
                await self.adb("adb shell input keyevent 165")
        elif command == "bookmark":
            if self.device_family == HOMATICS_FAMILY:
                await self.adb("adb shell input keyevent KEYCODE_BOOKMARK")
        elif command.startswith("num_") and command[4:].isdigit():
            number = int(command[4:])
            await self._num_key(number, 7 + number)
        else:
            _LOGGER.warning("Unknown Firemote command: %s", command)

    async def launch_app(self, app_descriptor: Any) -> None:
        if isinstance(app_descriptor, str):
            await self.media_player_service("select_source", {"source": app_descriptor})
            return

        if isinstance(app_descriptor, dict):
            remote_command = app_descriptor.get("remote_command")
            if remote_command and self.device_family in (APPLE_TV_FAMILY, ROKU_FAMILY):
                data = json.loads(remote_command) if isinstance(remote_command, str) else remote_command
                if self.device_family == APPLE_TV_FAMILY and self.apple_tv_remote_id:
                    data.setdefault("entity_id", self.apple_tv_remote_id)
                elif self.device_family == ROKU_FAMILY and self.roku_remote_id:
                    data.setdefault("entity_id", self.roku_remote_id)
                await self._async_call_service("remote", "send_command", data)
                return

            adb_launch_command = app_descriptor.get("adb_launch_command")
            if adb_launch_command:
                await self.adb(adb_launch_command)
                return

            app_name = app_descriptor.get("app_name")
            if app_name:
                await self.media_player_service("select_source", {"source": app_name})
                return

        _LOGGER.debug("Unsupported app descriptor for Firemote launch_app: %s", app_descriptor)

    async def switch_source(self, source_name: str) -> None:
        if self.device_family == FIRE_TV_FAMILY:
            await self.adb(
                "adb shell am start -n "
                "com.amazon.tv.inputpreference.service/"
                "com.amazon.tv.inputpreference.player.InputChooserActivity"
            )
            return

        await self.media_player_service("select_source", {"source": source_name})

    async def toggle_power(self) -> None:
        state = self.hass.states.get(self.entity_id)
        state_str = state.state if state else "off"
        is_off = state_str in ("off", "unavailable", "standby", "unknown")

        if self.device_family in (APPLE_TV_FAMILY, ROKU_FAMILY):
            await self.media_player_service("turn_on" if is_off else "turn_off")
            return

        if self.atv_remote:
            await self.remote_cmd(self.atv_remote, "KEYCODE_POWER")
            return

        if self.device_type == "fire_tv_cube_third_gen" and self.event_path != "undefined":
            await self.adb(
                "sendevent "
                f"{self.event_path} 1 116 1 && sendevent {self.event_path} 0 0 0 && "
                f"sendevent {self.event_path} 1 116 0 && sendevent {self.event_path} 0 0 0 && "
                "/dev/input/event2 1 9 1 && sendevent /dev/input/event2 0 0 0 && "
                "/dev/input/event2 1 9 0 && sendevent /dev/input/event2 0 0 0"
            )
            return

        if self.device_family == FIRE_TV_FAMILY and is_stick_model(self.device_type):
            await self.media_player_service("turn_on" if is_off else "turn_off")
            return

        await self.adb("POWER")

    async def set_volume(self, level: float) -> None:
        clamped = max(0.0, min(1.0, level))
        await self.media_player_service("volume_set", {"volume_level": clamped})

    async def volume_up(self) -> None:
        if self.device_family == APPLE_TV_FAMILY and self.apple_tv_remote_id:
            await self.remote_cmd(self.apple_tv_remote_id, "volume_up")
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, "volume_up")
            return
        if self.atv_remote:
            await self.remote_cmd(self.atv_remote, "KEYCODE_VOLUME_UP")
            return
        if self.device_family == NVIDIA_SHIELD_FAMILY:
            await self.adb("adb shell cmd media_session volume --show --adj raise")
            return
        if self.use_strong_mode:
            await self.adb("VOLUME_UP")
            return
        await self.adb(self._sendevent_tap(115))

    async def volume_down(self) -> None:
        if self.device_family == APPLE_TV_FAMILY and self.apple_tv_remote_id:
            await self.remote_cmd(self.apple_tv_remote_id, "volume_down")
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, "volume_down")
            return
        if self.atv_remote:
            await self.remote_cmd(self.atv_remote, "KEYCODE_VOLUME_DOWN")
            return
        if self.device_family == NVIDIA_SHIELD_FAMILY:
            await self.adb("adb shell cmd media_session volume --show --adj lower")
            return
        if self.use_strong_mode:
            await self.adb("VOLUME_DOWN")
            return
        await self.adb(self._sendevent_tap(114))

    async def send_text(self, text: str) -> None:
        if not text:
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, f"Lit_{text}")
            return

        escaped = text.replace('"', '\\"')
        await self.adb(f"input text \"{escaped}\"")

    async def _nav_key(
        self,
        apple_roku_cmd: str,
        keycode_cmd: str,
        adb_cmd: str,
        sendevent_code: int,
    ) -> None:
        if self.device_family == APPLE_TV_FAMILY and self.apple_tv_remote_id:
            await self.remote_cmd(self.apple_tv_remote_id, apple_roku_cmd)
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, apple_roku_cmd)
            return
        if self.atv_remote:
            await self.remote_cmd(self.atv_remote, keycode_cmd)
            return
        if self.use_strong_mode:
            await self.adb(adb_cmd)
            return
        await self.adb(self._sendevent_tap(sendevent_code))

    async def _center_key(self) -> None:
        if self.device_family == APPLE_TV_FAMILY and self.apple_tv_remote_id:
            await self.remote_cmd(self.apple_tv_remote_id, "select")
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, "select")
            return
        if self.atv_remote:
            await self.remote_cmd(self.atv_remote, "KEYCODE_DPAD_CENTER")
            return
        if self.use_strong_mode:
            await self.adb("CENTER")
            return

        center_code = 28
        if self.device_type in ("fire_tv_4_series", "fire_tv_toshiba_v35", "fire_tv_jvc-4k-2021"):
            center_code = 28
        elif self.device_type == "mi-box-s":
            center_code = 353
        else:
            center_code = 96

        await self.adb(self._sendevent_tap(center_code))

    async def _back_key(self) -> None:
        if self.device_family == APPLE_TV_FAMILY and self.apple_tv_remote_id:
            await self.remote_cmd(self.apple_tv_remote_id, "menu")
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, "back")
            return
        if self.atv_remote:
            await self.remote_cmd(self.atv_remote, "KEYCODE_BACK")
            return
        await self.adb("BACK")

    async def _home_key(self) -> None:
        if self.device_family == APPLE_TV_FAMILY and self.apple_tv_remote_id:
            await self.remote_cmd(self.apple_tv_remote_id, "top_menu")
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, "home")
            return
        if self.atv_remote:
            await self.remote_cmd(self.atv_remote, "KEYCODE_HOME")
            return
        await self.adb("HOME")

    async def _menu_key(self) -> None:
        if self.device_family in (APPLE_TV_FAMILY, ROKU_FAMILY, ONN_FAMILY):
            return
        if self.device_type in ("shield-tv-pro-2019", "shield-tv-2019"):
            await self.adb("am start -a android.settings.SETTINGS")
            return
        if self.device_family == XIAOMI_FAMILY:
            await self.adb(
                "adb shell am start -n com.android.tv.settings/com.android.tv.settings.MainSettings"
            )
            return
        if self.use_strong_mode:
            await self.adb("MENU")
            return
        await self.adb(self._sendevent_tap(139))

    async def _play_pause(self) -> None:
        if self.device_family == APPLE_TV_FAMILY and self.apple_tv_remote_id:
            state = self.hass.states.get(self.entity_id).state if self.hass.states.get(self.entity_id) else None
            command = "play" if state == "paused" else "pause"
            await self.remote_cmd(self.apple_tv_remote_id, command)
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, "play")
            return
        if self.atv_remote:
            await self.remote_cmd(self.atv_remote, "KEYCODE_MEDIA_PLAY_PAUSE")
            return
        if self.use_strong_mode or self.device_type == "mi-box-s":
            await self.media_player_service("media_play_pause")
            return
        await self.adb(self._sendevent_tap(164))

    async def _rewind(self) -> None:
        if self.device_family == APPLE_TV_FAMILY and self.apple_tv_remote_id:
            await self.remote_cmd(self.apple_tv_remote_id, "skip_backward")
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, "reverse")
            return
        if self.atv_remote:
            await self.remote_cmd(self.atv_remote, "KEYCODE_MEDIA_REWIND")
            return
        if self.use_strong_mode or self.device_type == "mi-box-s":
            await self.adb("REWIND")
            return
        await self.adb(self._sendevent_tap(168))

    async def _fast_forward(self) -> None:
        if self.device_family == APPLE_TV_FAMILY and self.apple_tv_remote_id:
            await self.remote_cmd(self.apple_tv_remote_id, "skip_forward")
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, "forward")
            return
        if self.atv_remote:
            await self.remote_cmd(self.atv_remote, "KEYCODE_MEDIA_FAST_FORWARD")
            return
        if self.use_strong_mode or self.device_type == "mi-box-s":
            await self.adb("FAST_FORWARD")
            return

        ff_code = 159 if self.device_type in ("fire_tv_4_series", "fire_tv_toshiba_v35", "fire_tv_jvc-4k-2021") else 208
        await self.adb(self._sendevent_tap(ff_code))

    async def _mute(self) -> None:
        if self.device_family == APPLE_TV_FAMILY:
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, "volume_mute")
            return
        if self.atv_remote:
            await self.remote_cmd(self.atv_remote, "KEYCODE_VOLUME_MUTE")
            return
        if self.use_strong_mode:
            await self.adb("MUTE")
            return
        if self.device_type == "mi-box-s":
            await self.adb("adb shell input keyevent 164")
            return
        await self.adb(self._sendevent_tap(113))

    async def _channel_up(self) -> None:
        if self.device_family in (APPLE_TV_FAMILY, CHROMECAST_FAMILY, NVIDIA_SHIELD_FAMILY, XIAOMI_FAMILY):
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, "channel_up")
            return
        if self.device_family == HOMATICS_FAMILY or self.device_type in (
            "fire_tv_stick_4k_second_gen",
            "fire_tv_stick_4k_max_second_gen",
            "onn-streaming-device-4k-pro",
            "onn-4k-streaming-box",
            "onn-full-hd-streaming-stick",
        ):
            await self.adb("adb shell input keyevent KEYCODE_CHANNEL_UP")
            return
        await self.adb(self._sendevent_tap(402))

    async def _channel_down(self) -> None:
        if self.device_family in (APPLE_TV_FAMILY, CHROMECAST_FAMILY, NVIDIA_SHIELD_FAMILY, XIAOMI_FAMILY):
            return
        if self.device_family == ROKU_FAMILY and self.roku_remote_id:
            await self.remote_cmd(self.roku_remote_id, "channel_down")
            return
        if self.device_family == HOMATICS_FAMILY or self.device_type in (
            "fire_tv_stick_4k_second_gen",
            "fire_tv_stick_4k_max_second_gen",
            "onn-streaming-device-4k-pro",
            "onn-4k-streaming-box",
            "onn-full-hd-streaming-stick",
        ):
            await self.adb("adb shell input keyevent KEYCODE_CHANNEL_DOWN")
            return
        await self.adb(self._sendevent_tap(403))

    async def _num_key(self, number: int, keycode: int) -> None:
        if self.atv_remote:
            await self.remote_cmd(self.atv_remote, str(keycode))
            return
        if self.use_strong_mode:
            await self.adb(str(keycode))
            return
        await self.adb(self._sendevent_tap(keycode))
