# HA-Firemote Backend Integration Plan
## for Universal Remote Card (URC)

---

## 1. Architecture Analysis

### HA-Firemote Backend (What it brings)

| Component | Description |
|-----------|-------------|
| **Device family dispatch** | Branches per `deviceFamily` (amazon-fire, apple-tv, roku, chromecast, etc.) |
| **ADB command layer** | `androidtv.adb_command` with raw POWER/UP/DOWN/... keys |
| **sendevent layer** | Low-latency raw input events per device model (`/dev/input/eventN`) |
| **Android TV Remote integration** | `remote.send_command` with KEYCODE_* for devices with the ATV Remote Integration |
| **App launcher logic** | ADB `am start` commands, `media_player.select_source`, per-app per-device branching |
| **State-aware power** | Reads `hass.states[entity].state` to decide `turn_on` vs `turn_off` vs `POWER` |
| **Text input** | ADB `input text`, Roku `Lit_` character commands |
| **Device model registry** | `supported-devices.js` — maps model slugs to sendevent paths + remote styles |
| **App launcher registry** | `launcher-buttons.js` — 200+ apps with per-family ADB commands + package names |

### Universal Remote Card (URC) Backend (What it already has)

| Component | Description |
|-----------|-------------|
| **Multi-platform action router** | `base-remote-element.ts` — routes `key`, `source`, `perform-action` etc. to correct HA service per platform |
| **Platform key maps** | `src/models/maps/fire_tv/`, `android_tv/`, `roku/`, `apple_tv/` — named button → key/action |
| **Action system** | `tap_action`, `hold_action`, `double_tap_action`, `repeat`, etc. |
| **Nunjucks templates** | Full Jinja2-like templating in all action values |
| **Platform config** | `platforms.ts` — which entity fields each platform uses |
| **IConfig interface** | `remote_id`, `media_player_id`, `keyboard_id`, `platform`, `device`, `custom_actions` |

---

## 2. Gap Analysis — What URC Is Missing vs HA-Firemote

| Capability | URC Current State | HA-Firemote Has |
|---|---|---|
| Device-model sendevent paths | ❌ None | ✅ Full model registry |
| Android TV Remote Integration auto-detect | ❌ Manual config | ✅ Auto-checked per family |
| Per-model power logic | ❌ Single key: `POWER` | ✅ 5-way branch (sticks/cubes/ATV remote/ADB) |
| App launcher registry (200+ apps) | ✅ Partial (Fire TV sources file) | ✅ Full per-device ADB commands |
| ADB `input text` keyboard | ✅ Has keyboard dialogs | ✅ Same approach |
| Compatibility mode (strong vs sendevent) | ❌ None | ✅ Yes |
| State-aware power toggle | ❌ Sends `POWER` blindly | ✅ State-aware turn_on/turn_off |

---

## 3. Integration Strategy — Selective Adoption

The goal is to **enhance URC's existing Fire TV platform** using HA-Firemote's device intelligence,
without replacing URC's action system or breaking any other platform.

### What to copy vs reimplement

| Item | Strategy |
|---|---|
| `firemote-adapter.ts` (already generated) | **Copy** — drop in as a utility module |
| Device model registry (`DEVICE_EVENT_PATHS`) | **Copy** into config schema as optional `device_type` |
| App launcher ADB commands | **Copy** relevant entries into `fire_tv/defaultSources.ts` additions |
| State-aware power | **Reimplement** as a URC custom action template |
| ATV Remote integration support | **Reimplement** via URC's existing `remote_id` field + new `android_tv_remote_id` config key |

---

## 4. Files to Modify in Your URC Project

```
src/
├── models/
│   ├── interfaces/
│   │   └── IConfig.ts                 ← ADD: android_tv_remote_id, device_type, compatibility_mode
│   └── maps/
│       └── fire_tv/
│           ├── defaultKeys.ts         ← ENHANCE: smarter power, add ATV remote variants
│           └── defaultSources.ts      ← ENHANCE: add ADB launch commands for more apps
├── utils/
│   └── firemote-adapter.ts            ← ADD: drop in the adapter module (new file)
└── universal-remote-card.ts           ← PATCH: pass new config fields to adapter
```

**New files to add:**

```
src/utils/firemote-adapter.ts          ← The logic adapter (see output file)
src/models/maps/fire_tv/deviceModels.ts ← Device model → event path registry
```

---

## 5. Step-by-Step Integration

### Step 1 — Add new config fields (non-breaking)

Edit `src/models/interfaces/IConfig.ts` — add optional fields only:

```typescript
export interface IConfig {
  // ... existing fields unchanged ...

  // HA-Firemote backend fields (Fire TV only)
  android_tv_remote_id?: string;   // remote.* entity from Android TV Remote Integration
  device_type?: string;            // e.g. "fire_stick_4k", "fire_tv_cube_third_gen"
  compatibility_mode?: 'default' | 'strong' | string;  // sendevent override
}
```

### Step 2 — Drop in the adapter

Copy `firemote-adapter.ts` to `src/utils/firemote-adapter.ts`.

### Step 3 — Add device model registry

Create `src/models/maps/fire_tv/deviceModels.ts` — see generated file.

### Step 4 — Enhance Fire TV defaultKeys

Replace the simple `power` entry in `fire_tv/defaultKeys.ts` with a template-powered
version that reads device state and routes to the right service — see generated file.

### Step 5 — Wire adapter into the card (optional — for programmatic use)

In `universal-remote-card.ts`, create the adapter in `shouldUpdate()` when `platform === 'Fire TV'`
and make it available to child elements via a custom event or property.

### Step 6 — Test with your YAML config

```yaml
type: custom:universal-remote-card
platform: Fire TV
remote_id: remote.fire_tv        # androidtv integration entity  
media_player_id: media_player.fire_tv
android_tv_remote_id: remote.fire_tv_remote  # optional: ATV Remote Integration
device_type: fire_stick_4k                   # optional: enables sendevent paths
compatibility_mode: default                  # optional: default|strong|event4 etc.
rows:
  - [power, home, back]
  - [up]
  - [left, center, right]
  - [down]
  - [volume_down, volume_mute, volume_up]
```

---

## 6. What Does NOT Change

- All other platforms (Roku, Apple TV, Samsung, etc.) are completely untouched
- URC's action system (`tap_action`, `hold_action`, templates) is preserved
- Your UI layout definition (`rows:`) stays identical
- Entity names remain exactly as configured
- The `key` action dispatcher in `base-remote-element.ts` is NOT modified
