/**
 * firemote-adapter.ts
 *
 * A clean, framework-agnostic Home Assistant service adapter for TV remote control.
 * Extracted and reconstructed from HA-Firemote bundle logic.
 *
 * Supports device families:
 *   - amazon-fire    (Fire TV Sticks, Cubes, Smart TVs via ADB/androidtv integration)
 *   - android-tv     (Generic Android TV with ADB + optional Android TV Remote integration)
 *   - apple-tv       (via Apple TV integration's remote entity)
 *   - chromecast     (Chromecast with Google TV via ADB)
 *   - nvidia-shield  (NVIDIA Shield via ADB)
 *   - onn            (onn. Google TV devices via ADB)
 *   - roku           (Roku via Roku integration's remote entity)
 *   - xiaomi         (Xiaomi Mi Box / Mi TV Stick via ADB + optional ATV Remote)
 *   - homatics       (Homatics Box R / Box R Plus via ADB)
 *
 * Usage:
 *   import { createRemoteAdapter } from './firemote-adapter';
 *
 *   const remote = createRemoteAdapter(hass, {
 *     entityId: 'media_player.fire_tv',
 *     deviceFamily: 'amazon-fire',
 *     deviceType: 'fire_stick_4k',
 *     // Optional: provide separate remote entity for AndroidTV Remote Integration
 *     androidTvRemoteEntityId: 'remote.fire_tv_remote',
 *     // Optional: provide Apple TV remote entity
 *     appleTvRemoteEntityId: 'remote.apple_tv',
 *     // Optional: provide Roku remote entity
 *     rokuRemoteEntityId: 'remote.roku_express',
 *   });
 *
 *   remote.sendCommand('home');
 *   remote.launchApp('netflix');
 *   remote.togglePower();
 *   remote.volumeUp();
 *   remote.setVolume(0.5);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal Home Assistant interface required by this adapter */
export interface HomeAssistant {
  callService(domain: string, service: string, data: Record<string, unknown>): void;
  states: Record<string, { state: string; attributes: Record<string, unknown> }>;
}

export type DeviceFamily =
  | "amazon-fire"
  | "android-tv"
  | "apple-tv"
  | "chromecast"
  | "nvidia-shield"
  | "onn"
  | "roku"
  | "xiaomi"
  | "homatics";

export interface RemoteAdapterConfig {
  /** The media_player entity ID (primary entity) */
  entityId: string;
  /** Which platform family this device belongs to */
  deviceFamily: DeviceFamily;
  /** Specific device model slug (used for sendevent path and model-specific overrides) */
  deviceType?: string;
  /**
   * ADB event listener binary path override.
   * Pass 'strong' to force simple ADB key commands instead of raw sendevents.
   * Leave undefined to use the device-default path derived from deviceType.
   */
  compatibilityMode?: "default" | "strong" | string;
  /** Android TV Remote Integration entity (enables KEYCODE commands via remote domain) */
  androidTvRemoteEntityId?: string;
  /** Apple TV remote entity (for apple-tv family) */
  appleTvRemoteEntityId?: string;
  /** Roku remote entity (for roku family) */
  rokuRemoteEntityId?: string;
}

/** App descriptor as stored in the launcher map */
export interface AppDescriptor {
  /** ADB shell command to launch the app (android-based devices) */
  adbLaunchCommand?: string;
  /** Source/app name (used for media_player.select_source or Apple TV / Roku) */
  appName?: string;
  /** Remote command JSON string (Roku / Apple TV — parsed and sent via remote.send_command) */
  remoteCommand?: string;
  /** Roku channel id for deep-launch */
  rokuAppId?: string | number;
}

// ---------------------------------------------------------------------------
// Default event listener bin paths per device model
// (extracted from supported-devices.js)
// ---------------------------------------------------------------------------

const DEVICE_EVENT_PATHS: Record<string, string> = {
  // Amazon Fire Smart TVs
  fire_tv_4_series: "/dev/input/event0",
  fire_tv_insignia_f20: "/dev/input/event0",
  "fire_tv_jvc-4k-2021": "/dev/input/event0",
  fire_tv_toshiba_v35: "/dev/input/event0",
  // Amazon Fire Cubes
  fire_tv_cube_third_gen: "/dev/input/event3",
  fire_tv_cube_second_gen: "/dev/input/event5",
  fire_tv_cube_first_gen: "/dev/input/event5",
  // Amazon Fire Sticks
  fire_tv_stick_4k_max: "/dev/input/event5",
  fire_tv_3rd_gen: "/dev/input/event4",
  fire_tv_stick_lite: "/dev/input/event4",
  fire_stick_4k: "/dev/input/event4",
  fire_stick_second_gen: "/dev/input/event4",
  fire_stick_basic: "/dev/input/event4",
  fire_stick_first_gen: "/dev/input/event1",
  fire_tv_third_gen_2017: "/dev/input/event3",
  fire_tv_second_gen_2015: "/dev/input/event6",
  // Other
  "mi-box-s": "undefined", // Xiaomi Mi Box S uses ADB key commands (no sendevent)
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveEventPath(config: RemoteAdapterConfig): string {
  const { compatibilityMode, deviceType } = config;
  if (compatibilityMode && compatibilityMode !== "default") {
    // If a custom path like "event4" was given, prefix it
    if (compatibilityMode !== "strong") {
      return `/dev/input/${compatibilityMode}`;
    }
    return "undefined";
  }
  if (deviceType && DEVICE_EVENT_PATHS[deviceType]) {
    return DEVICE_EVENT_PATHS[deviceType];
  }
  return "undefined";
}

function hasAndroidTvRemote(config: RemoteAdapterConfig): boolean {
  if (!config.androidTvRemoteEntityId) return false;
  if (config.deviceFamily === "amazon-fire") return false;
  return true;
}

/** Build a single sendevent tap (press + release) for a given keycode */
function sendeventTap(binPath: string, keyCode: number): string {
  return (
    `sendevent ${binPath} 1 ${keyCode} 1 && ` +
    `sendevent ${binPath} 0 0 0 && ` +
    `sendevent ${binPath} 1 ${keyCode} 0 && ` +
    `sendevent ${binPath} 0 0 0`
  );
}

/** Build a sendevent key-down (no release — caller must send key-up separately) */
function sendeventDown(binPath: string, keyCode: number): string {
  return `sendevent ${binPath} 1 ${keyCode} 1 && sendevent ${binPath} 0 0 0`;
}

/** Build a sendevent key-up */
function sendeventUp(binPath: string, keyCode: number): string {
  return `sendevent ${binPath} 1 ${keyCode} 0 && sendevent ${binPath} 0 0 0 `;
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Creates a stateless remote adapter bound to a specific entity + device config.
 * All service calls are dispatched immediately through `hass.callService`.
 */
export function createRemoteAdapter(hass: HomeAssistant, config: RemoteAdapterConfig) {
  const { entityId, deviceFamily, deviceType } = config;
  const eventPath = resolveEventPath(config);
  const useStrongMode = config.compatibilityMode === "strong" || eventPath === "undefined";
  const atvRemote = hasAndroidTvRemote(config) ? config.androidTvRemoteEntityId! : null;
  const appleTvRemote = config.appleTvRemoteEntityId ?? null;
  const rokuRemote = config.rokuRemoteEntityId ?? null;

  // ------------------------------------------------------------------
  // Low-level dispatch helpers
  // ------------------------------------------------------------------

  function adb(command: string): void {
    hass.callService("androidtv", "adb_command", { entity_id: entityId, command });
  }

  function remoteCmd(
    remoteEntityId: string,
    command: string,
    options: { num_repeats?: number; delay_secs?: number; hold_secs?: number } = {}
  ): void {
    hass.callService("remote", "send_command", {
      entity_id: remoteEntityId,
      command,
      num_repeats: options.num_repeats ?? 1,
      delay_secs: options.delay_secs ?? 0,
      hold_secs: options.hold_secs ?? 0,
    });
  }

  function mediaPlayerService(service: string, extra: Record<string, unknown> = {}): void {
    hass.callService("media_player", service, { entity_id: entityId, ...extra });
  }

  // ------------------------------------------------------------------
  // Core dispatchers by navigation key
  // ------------------------------------------------------------------

  /**
   * sendCommand — dispatch a named remote command to the device.
   *
   * Supported commands:
   *   Navigation : up | down | left | right | center | back | home | menu
   *   Media      : play_pause | rewind | fast_forward | replay | options
   *   Volume     : volume_up | volume_down | mute | channel_up | channel_down
   *   System     : power | profile | apps | settings | app_switch | keyboard | tv
   *                headset | programmable_1 | programmable_2 | info | bookmark
   *   Numbers    : num_0 … num_9
   */
  function sendCommand(command: string): void {
    switch (command) {
      // ---- Navigation ----
      case "up":
        return _navKey("up", "KEYCODE_DPAD_UP", "UP", 103);
      case "down":
        return _navKey("down", "KEYCODE_DPAD_DOWN", "DOWN", 108);
      case "left":
        return _navKey("left", "KEYCODE_DPAD_LEFT", "LEFT", 105);
      case "right":
        return _navKey("right", "KEYCODE_DPAD_RIGHT", "RIGHT", 106);
      case "center":
      case "select":
        return _centerKey();
      case "back":
        return _backKey();
      case "home":
        return _homeKey();
      case "menu":
      case "hamburger":
        return _menuKey();

      // ---- Media controls ----
      case "play_pause":
        return _playPause();
      case "rewind":
        return _rewind();
      case "fast_forward":
        return _fastForward();
      case "replay":
        if (deviceFamily === "roku" && rokuRemote) {
          remoteCmd(rokuRemote, "replay");
        }
        return;
      case "options":
        if (deviceFamily === "roku" && rokuRemote) {
          remoteCmd(rokuRemote, "info");
        }
        return;

      // ---- Volume ----
      case "volume_up":
        return _volumeUp();
      case "volume_down":
        return _volumeDown();
      case "mute":
        return _mute();
      case "channel_up":
        return _channelUp();
      case "channel_down":
        return _channelDown();

      // ---- System ----
      case "power":
        return togglePower();
      case "profile":
        adb("adb shell input keyevent KEYCODE_PROFILE_SWITCH");
        return;
      case "apps":
        return _appsKey();
      case "settings":
        return _settingsKey();
      case "app_switch":
        return _appSwitch();
      case "tv":
        return _tvKey();
      case "headset":
        return _headsetKey();
      case "programmable_1":
        return _programmable1();
      case "programmable_2":
        return _programmable2();
      case "info":
        if (deviceFamily === "homatics") adb("adb shell input keyevent 165");
        return;
      case "bookmark":
        if (deviceFamily === "homatics") adb("adb shell input keyevent KEYCODE_BOOKMARK");
        return;

      // ---- Numbers ----
      case "num_0": return _numKey(0, 7);
      case "num_1": return _numKey(1, 8);
      case "num_2": return _numKey(2, 9);
      case "num_3": return _numKey(3, 10);
      case "num_4": return _numKey(4, 11);
      case "num_5": return _numKey(5, 12);
      case "num_6": return _numKey(6, 13);
      case "num_7": return _numKey(7, 14);
      case "num_8": return _numKey(8, 15);
      case "num_9": return _numKey(9, 16);

      default:
        console.warn(`[remote-adapter] Unknown command: ${command}`);
    }
  }

  // ------------------------------------------------------------------
  // launchApp — launch by app key (maps to launcherData keys) or
  //             by providing a raw AppDescriptor directly.
  // ------------------------------------------------------------------

  /**
   * Launch an app on the device.
   *
   * @param appDescriptor  An AppDescriptor object describing how to launch the app
   *                       for this device family, OR a plain source/app name string
   *                       (will fall back to media_player.select_source).
   */
  function launchApp(appDescriptor: AppDescriptor | string): void {
    if (typeof appDescriptor === "string") {
      // Treat as a source name — works for Apple TV, Roku by name, and
      // Android TV media player sources.
      hass.callService("media_player", "select_source", {
        entity_id: entityId,
        source: appDescriptor,
      });
      return;
    }

    const { adbLaunchCommand, appName, remoteCommand } = appDescriptor;

    // Apple TV / Roku — use remote command if provided
    if (remoteCommand && (deviceFamily === "apple-tv" || deviceFamily === "roku")) {
      const data = JSON.parse(remoteCommand) as Record<string, unknown>;
      if (deviceFamily === "apple-tv" && appleTvRemote) {
        data.entity_id = appleTvRemote;
      } else if (deviceFamily === "roku" && rokuRemote) {
        data.entity_id = rokuRemote;
      }
      hass.callService("remote", "send_command", data);
      return;
    }

    // ADB launch (android-based devices)
    if (adbLaunchCommand) {
      adb(adbLaunchCommand);
      return;
    }

    // Fallback: select_source with appName
    if (appName) {
      hass.callService("media_player", "select_source", {
        entity_id: entityId,
        source: appName,
      });
    }
  }

  // ------------------------------------------------------------------
  // switchSource — change HDMI input or media source
  // ------------------------------------------------------------------

  /**
   * Switch to an HDMI input or named source.
   * On Fire TV this launches the input selector activity via ADB.
   * On all other devices it calls media_player.select_source.
   */
  function switchSource(sourceName: string): void {
    if (deviceFamily === "amazon-fire") {
      adb(
        "adb shell am start -n " +
        "com.amazon.tv.inputpreference.service/" +
        "com.amazon.tv.inputpreference.player.InputChooserActivity"
      );
      return;
    }
    hass.callService("media_player", "select_source", {
      entity_id: entityId,
      source: sourceName,
    });
  }

  // ------------------------------------------------------------------
  // togglePower — turn device on or off based on current state
  // ------------------------------------------------------------------

  function togglePower(): void {
    const state = hass.states[entityId];
    const stateStr = state?.state ?? "off";
    const isOff = ["off", "unavailable", "standby"].includes(stateStr);

    // Apple TV & Roku — use media_player turn_on / turn_off
    if (deviceFamily === "apple-tv" || deviceFamily === "roku") {
      if (isOff) {
        mediaPlayerService("turn_on");
      } else {
        mediaPlayerService("turn_off");
      }
      return;
    }

    // Android TV Remote integration — use KEYCODE_POWER
    if (atvRemote) {
      remoteCmd(atvRemote, "KEYCODE_POWER");
      return;
    }

    // "strong" compatibility or Fire TV 4K cubes with a sendevent path
    if (deviceType === "fire_tv_cube_third_gen" && eventPath !== "undefined") {
      adb(
        `sendevent ${eventPath} 1 116 1 && sendevent ${eventPath} 0 0 0 && ` +
        `sendevent ${eventPath} 1 116 0 && sendevent ${eventPath} 0 0 0 && ` +
        `sendevent /dev/input/event2 1 9 1 && sendevent /dev/input/event2 0 0 0 && ` +
        `sendevent /dev/input/event2 1 9 0 && sendevent /dev/input/event2 0 0 0`
      );
      return;
    }

    // Fire TV Sticks without ATV Remote — use media_player toggle
    const stickModels = [
      "fire_stick_4k",
      "fire_tv_stick_4k_max",
      "fire_tv_3rd_gen",
      "fire_stick_second_gen",
      "fire_tv_stick_4k_second_gen",
    ];
    if (deviceFamily === "amazon-fire" && deviceType && stickModels.includes(deviceType)) {
      if (isOff) {
        mediaPlayerService("turn_on");
      } else {
        mediaPlayerService("turn_off");
      }
      return;
    }

    // Generic ADB POWER
    adb("POWER");
  }

  // ------------------------------------------------------------------
  // setVolume — set absolute volume level (0.0–1.0)
  // ------------------------------------------------------------------

  /**
   * Set the media player volume to an absolute level.
   * Uses media_player.volume_set — supported by most integrations.
   */
  function setVolume(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    mediaPlayerService("volume_set", { volume_level: clamped });
  }

  // ------------------------------------------------------------------
  // Convenience volume step helpers
  // ------------------------------------------------------------------

  function volumeUp(): void {
    if (deviceFamily === "apple-tv" && appleTvRemote) {
      remoteCmd(appleTvRemote, "volume_up");
      return;
    }
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, "volume_up");
      return;
    }
    if (atvRemote) {
      remoteCmd(atvRemote, "KEYCODE_VOLUME_UP");
      return;
    }
    if (deviceFamily === "nvidia-shield") {
      adb("adb shell cmd media_session volume --show --adj raise");
      return;
    }
    if (useStrongMode) {
      adb("VOLUME_UP");
      return;
    }
    adb(sendeventTap(eventPath, 115));
  }

  function volumeDown(): void {
    if (deviceFamily === "apple-tv" && appleTvRemote) {
      remoteCmd(appleTvRemote, "volume_down");
      return;
    }
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, "volume_down");
      return;
    }
    if (atvRemote) {
      remoteCmd(atvRemote, "KEYCODE_VOLUME_DOWN");
      return;
    }
    if (deviceFamily === "nvidia-shield") {
      adb("adb shell cmd media_session volume --show --adj lower");
      return;
    }
    if (useStrongMode) {
      adb("VOLUME_DOWN");
      return;
    }
    adb(sendeventTap(eventPath, 114));
  }

  // ------------------------------------------------------------------
  // sendText — send a text string to the device
  // ------------------------------------------------------------------

  /**
   * Send a text string to the focused input on the device.
   * Roku uses individual Lit_ key commands. Other devices use ADB input text.
   */
  function sendText(text: string): void {
    if (!text) return;
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, `Lit_${text}`);
      return;
    }
    const escaped = text.replace(/"/g, '\\"');
    adb(`input text "${escaped}"`);
  }

  // ------------------------------------------------------------------
  // Custom service call — run any arbitrary HA service
  // ------------------------------------------------------------------

  /**
   * Execute an arbitrary Home Assistant service call.
   * Useful for button overrides and custom launcher scripts.
   *
   * @example
   * callCustomService('script.my_macro', {}, {});
   * callCustomService('media_player.play_media', { entity_id: 'media_player.tv' }, { media_content_id: '...', media_content_type: 'music' });
   */
  function callCustomService(
    actionDotService: string,
    target: Record<string, unknown>,
    data: Record<string, unknown> = {}
  ): void {
    const [domain, service] = actionDotService.split(".");
    hass.callService(domain, service, { ...target, ...data });
  }

  /**
   * Execute a Home Assistant script by name.
   */
  function runScript(scriptName: string, data: Record<string, unknown> = {}): void {
    hass.callService("script", scriptName, data);
  }

  // ==================================================================
  // Private nav + action implementations
  // ==================================================================

  function _navKey(
    appleRokuCmd: string,
    keycodeCmd: string,
    adbCmd: string,
    sendeventCode: number
  ): void {
    if (deviceFamily === "apple-tv" && appleTvRemote) {
      remoteCmd(appleTvRemote, appleRokuCmd);
      return;
    }
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, appleRokuCmd);
      return;
    }
    if (atvRemote) {
      remoteCmd(atvRemote, keycodeCmd);
      return;
    }
    if (useStrongMode) {
      adb(adbCmd);
      return;
    }
    adb(sendeventTap(eventPath, sendeventCode));
  }

  function _centerKey(): void {
    if (deviceFamily === "apple-tv" && appleTvRemote) {
      remoteCmd(appleTvRemote, "select");
      return;
    }
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, "select");
      return;
    }
    if (atvRemote) {
      remoteCmd(atvRemote, "KEYCODE_DPAD_CENTER");
      return;
    }
    if (useStrongMode) {
      adb("CENTER");
      return;
    }
    // Device-specific center event codes
    const centerCode =
      deviceType === "fire_tv_4_series" ||
      deviceType === "fire_tv_toshiba_v35" ||
      deviceType === "fire_tv_jvc-4k-2021"
        ? 28
        : deviceType === "mi-box-s"
        ? 353
        : 96;
    adb(sendeventTap(eventPath, centerCode));
  }

  function _backKey(): void {
    if (deviceFamily === "apple-tv" && appleTvRemote) {
      remoteCmd(appleTvRemote, "menu");
      return;
    }
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, "back");
      return;
    }
    if (atvRemote) {
      remoteCmd(atvRemote, "KEYCODE_BACK");
      return;
    }
    adb("BACK");
  }

  function _homeKey(): void {
    if (deviceFamily === "apple-tv" && appleTvRemote) {
      remoteCmd(appleTvRemote, "top_menu");
      return;
    }
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, "home");
      return;
    }
    if (atvRemote) {
      remoteCmd(atvRemote, "KEYCODE_HOME");
      return;
    }
    adb("HOME");
  }

  function _menuKey(): void {
    if (deviceFamily === "apple-tv" || deviceFamily === "roku" || deviceFamily === "onn") return;
    if (deviceType === "shield-tv-pro-2019" || deviceType === "shield-tv-2019") {
      adb("am start -a android.settings.SETTINGS");
      return;
    }
    if (deviceFamily === "xiaomi") {
      adb("adb shell am start -n com.android.tv.settings/com.android.tv.settings.MainSettings");
      return;
    }
    if (useStrongMode) {
      adb("MENU");
      return;
    }
    adb(sendeventTap(eventPath, 139));
  }

  function _playPause(): void {
    if (deviceFamily === "apple-tv" && appleTvRemote) {
      const state = hass.states[entityId]?.state;
      const cmd = state === "paused" ? "play" : "pause";
      remoteCmd(appleTvRemote, cmd);
      return;
    }
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, "play");
      return;
    }
    if (atvRemote) {
      remoteCmd(atvRemote, "KEYCODE_MEDIA_PLAY_PAUSE");
      return;
    }
    if (useStrongMode || deviceType === "mi-box-s") {
      mediaPlayerService("media_play_pause");
      return;
    }
    adb(sendeventTap(eventPath, 164));
  }

  function _rewind(): void {
    if (deviceFamily === "apple-tv" && appleTvRemote) {
      remoteCmd(appleTvRemote, "skip_backward");
      return;
    }
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, "reverse");
      return;
    }
    if (atvRemote) {
      remoteCmd(atvRemote, "KEYCODE_MEDIA_REWIND");
      return;
    }
    if (useStrongMode || deviceType === "mi-box-s") {
      adb("REWIND");
      return;
    }
    adb(sendeventTap(eventPath, 168));
  }

  function _fastForward(): void {
    if (deviceFamily === "apple-tv" && appleTvRemote) {
      remoteCmd(appleTvRemote, "skip_forward");
      return;
    }
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, "forward");
      return;
    }
    if (atvRemote) {
      remoteCmd(atvRemote, "KEYCODE_MEDIA_FAST_FORWARD");
      return;
    }
    if (useStrongMode || deviceType === "mi-box-s") {
      adb("FAST_FORWARD");
      return;
    }
    const ffCode =
      deviceType === "fire_tv_4_series" ||
      deviceType === "fire_tv_toshiba_v35" ||
      deviceType === "fire_tv_jvc-4k-2021"
        ? 159
        : 208;
    adb(sendeventTap(eventPath, ffCode));
  }

  function _mute(): void {
    if (deviceFamily === "apple-tv") return; // unsupported
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, "volume_mute");
      return;
    }
    if (atvRemote) {
      remoteCmd(atvRemote, "KEYCODE_VOLUME_MUTE");
      return;
    }
    if (useStrongMode) {
      adb("MUTE");
      return;
    }
    if (deviceType === "mi-box-s") {
      adb("adb shell input keyevent 164");
      return;
    }
    adb(sendeventTap(eventPath, 113));
  }

  function _channelUp(): void {
    if (["apple-tv", "chromecast", "nvidia-shield", "xiaomi"].includes(deviceFamily)) return;
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, "channel_up");
      return;
    }
    if (
      deviceFamily === "homatics" ||
      deviceType === "fire_tv_stick_4k_second_gen" ||
      deviceType === "fire_tv_stick_4k_max_second_gen" ||
      deviceType === "onn-streaming-device-4k-pro" ||
      deviceType === "onn-4k-streaming-box" ||
      deviceType === "onn-full-hd-streaming-stick"
    ) {
      adb("adb shell input keyevent KEYCODE_CHANNEL_UP");
      return;
    }
    adb(sendeventTap(eventPath, 402));
  }

  function _channelDown(): void {
    if (["apple-tv", "chromecast", "nvidia-shield", "xiaomi"].includes(deviceFamily)) return;
    if (deviceFamily === "roku" && rokuRemote) {
      remoteCmd(rokuRemote, "channel_down");
      return;
    }
    if (
      deviceFamily === "homatics" ||
      deviceType === "fire_tv_stick_4k_second_gen" ||
      deviceType === "fire_tv_stick_4k_max_second_gen" ||
      deviceType === "onn-streaming-device-4k-pro" ||
      deviceType === "onn-4k-streaming-box" ||
      deviceType === "onn-full-hd-streaming-stick"
    ) {
      adb("adb shell input keyevent KEYCODE_CHANNEL_DOWN");
      return;
    }
    adb(sendeventTap(eventPath, 403));
  }

  function _appsKey(): void {
    if (deviceType === "mi-box-s") {
      adb("adb shell am start -n com.google.android.tvlauncher/.appsview.AppsViewActivity");
      return;
    }
    if (deviceFamily === "nvidia-shield") {
      adb("adb shell input keyevent KEYCODE_APP_SWITCH");
      return;
    }
    if (deviceFamily === "amazon-fire") {
      adb("am start -n com.amazon.venezia/com.amazon.venezia.grid.AppsGridLauncherActivity");
      return;
    }
    if (deviceFamily === "onn") {
      adb("adb shell input keyevent KEYCODE_ALL_APPS");
      return;
    }
    if (deviceFamily === "roku") return;
    if (useStrongMode) {
      adb("RECENTS");
      return;
    }
    adb(sendeventTap(eventPath, 757));
  }

  function _settingsKey(): void {
    if (deviceFamily === "roku" || deviceFamily === "nvidia-shield") return;
    if (deviceFamily === "onn") {
      adb("adb shell input keyevent 83");
      return;
    }
    if (deviceType === "mi-box-s") {
      adb("adb shell am start -n com.android.tv.settings/com.android.tv.settings.MainSettings");
      return;
    }
    if (useStrongMode || deviceType === "fire_tv_cube_third_gen") {
      adb("SETTINGS");
      return;
    }
    adb(sendeventTap(eventPath, 249));
  }

  function _appSwitch(): void {
    if (
      deviceType === "fire_tv_stick_4k_second_gen" ||
      deviceType === "fire_tv_stick_4k_max_second_gen"
    ) {
      adb("adb shell input keyevent 307");
      return;
    }
    if (deviceType === "fire_tv_cube_third_gen") {
      adb("adb shell input keyevent 304");
      return;
    }
    if (deviceType === "mi-box-s") {
      adb("adb shell input keyevent KEYCODE_APP_SWITCH");
      return;
    }
    if (useStrongMode) {
      adb("RECENTS");
      return;
    }
    adb(sendeventTap(eventPath, 757));
  }

  function _tvKey(): void {
    if (["apple-tv", "roku", "nvidia-shield"].includes(deviceFamily)) return;
    if (deviceType === "fire_tv_cube_third_gen") {
      adb("adb shell input keyevent 297");
      return;
    }
    if (deviceType === "fire_tv_stick_4k_second_gen" || deviceType === "fire_tv_stick_4k_max_second_gen") {
      adb("adb shell input keyevent 300");
      return;
    }
    if (deviceType === "mi-box-s") {
      adb("adb shell am start -n com.google.android.tv/com.android.tv.MainActivity");
      return;
    }
    if (deviceFamily === "onn" || deviceFamily === "homatics") {
      adb("adb shell input keyevent KEYCODE_GUIDE");
      return;
    }
    adb(sendeventTap(eventPath, 362));
  }

  function _headsetKey(): void {
    if (deviceFamily === "amazon-fire") {
      adb("adb shell input keyevent BUTTON_3");
      return;
    }
    if (deviceFamily === "onn") {
      adb("adb shell input keyevent KEYCODE_PAIRING");
      return;
    }
    if (["chromecast", "nvidia-shield", "xiaomi"].includes(deviceFamily)) {
      adb("adb shell am start -n com.android.tv.settings/com.android.tv.settings.accessories.AddAccessoryActivity");
      return;
    }
  }

  function _programmable1(): void {
    if (deviceFamily !== "amazon-fire") return;
    if (useStrongMode) {
      adb("adb shell input keyevent BUTTON_1");
      return;
    }
    adb(sendeventTap(eventPath, 638));
  }

  function _programmable2(): void {
    if (deviceFamily !== "amazon-fire") return;
    if (useStrongMode) {
      adb("adb shell input keyevent BUTTON_2");
      return;
    }
    adb(
      `sendevent ${eventPath} 4 4 787071 && sendevent ${eventPath} 1 639 1 && ` +
      `sendevent ${eventPath} 0 0 0 && sendevent ${eventPath} 4 4 787071 && ` +
      `sendevent ${eventPath} 1 639 0 && sendevent ${eventPath} 0 0 0`
    );
  }

  function _numKey(digit: number, adbKeycode: number): void {
    if (deviceFamily === "apple-tv" || deviceFamily === "roku") return;
    if (useStrongMode) {
      adb(`adb shell input keyevent ${adbKeycode}`);
      return;
    }
    // Sendevent linux keycodes 2–11 map to digits 1–0
    const linuxCode = digit === 0 ? 11 : digit + 1;
    adb(sendeventTap(eventPath, linuxCode));
  }

  // ------------------------------------------------------------------
  // Return the public API
  // ------------------------------------------------------------------

  return {
    /**
     * Send a named remote command. See sendCommand JSDoc for full list.
     */
    sendCommand,

    /**
     * Launch an app by AppDescriptor or by source name string.
     */
    launchApp,

    /**
     * Switch the active HDMI input or media source.
     */
    switchSource,

    /**
     * Toggle the device power on or off based on current state.
     */
    togglePower,

    /**
     * Set the absolute volume level (0.0 – 1.0) via media_player.volume_set.
     */
    setVolume,

    /**
     * Increment volume by one step (device-native mechanism).
     */
    volumeUp,

    /**
     * Decrement volume by one step (device-native mechanism).
     */
    volumeDown,

    /**
     * Send a text string to the device's focused input.
     */
    sendText,

    /**
     * Execute an arbitrary Home Assistant service call.
     * Use for overrides or custom integrations.
     */
    callCustomService,

    /**
     * Trigger a Home Assistant script.
     */
    runScript,

    // Expose config + resolved state for debugging / UI introspection
    _config: config,
    _resolvedEventPath: eventPath,
    _hasAndroidTvRemote: !!atvRemote,
  };
}

export type RemoteAdapter = ReturnType<typeof createRemoteAdapter>;
