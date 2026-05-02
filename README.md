# Firemote Home Assistant Integration

This repository now includes a Home Assistant custom integration for Firemote-style remote control logic, plus a Lovelace frontend card for `custom:firemote-card`.
It exposes services and optional `remote` entities that map existing `media_player` and `remote` HA entities to Fire TV / Android TV / Roku / Apple TV / Chromecast commands without renaming your base entities.

## Installation

1. Add this repository to HACS as a custom repository.
   - URL: `https://github.com/bhartiNitish-1707/Firemote`
   - Category: `Integration`
2. Install the `Firemote` integration from HACS.
3. Restart Home Assistant.
4. Configure `firemote:` in `configuration.yaml`.

### Frontend Lovelace Card

This repository also includes a custom Lovelace card named `custom:firemote-card`.
To use the card in Home Assistant, install the repository as a HACS Plugin or add the resource manually from the built file.

If you install the card through HACS Plugin support, the card should appear automatically in the Lovelace Add Card dialog.
If needed, add the following resource path after installation:

```yaml
resources:
  - url: /hacsfiles/firemote/dist/HA-Firemote.js
    type: module
```

Then add a card with:

```yaml
type: custom:firemote-card
device_name: "Living Room Fire TV"
media_player_entity: media_player.living_room_fire_tv
device_family: amazon-fire
device_type: fire_stick_4k
compatibility_mode: default
```

## Example `configuration.yaml`

```yaml
firemote:
  devices:
    - name: Living Room Fire TV
      device_family: amazon-fire
      media_player_id: media_player.living_room_fire_tv
      remote_id: remote.fire_tv
      android_tv_remote_id: remote.fire_tv_remote
      device_type: fire_stick_4k
      compatibility_mode: default

    - name: Bedroom Roku
      device_family: roku
      media_player_id: media_player.bedroom_roku
      roku_remote_id: remote.bedroom_roku
```

## Services

Use the following services to control your devices:

- `firemote.send_command`
- `firemote.launch_app`
- `firemote.toggle_power`
- `firemote.set_volume`
- `firemote.send_text`

## Lovelace

Use a standard button card or entity card to call Firemote services. Example:

```yaml
type: vertical-stack
cards:
  - type: entities
    title: Firemote Controls
    entities:
      - entity: media_player.living_room_fire_tv
  - type: horizontal-stack
    cards:
      - type: button
        name: Home
        tap_action:
          action: call-service
          service: firemote.send_command
          service_data:
            device_name: "Living Room Fire TV"
            command: home
      - type: button
        name: Back
        tap_action:
          action: call-service
          service: firemote.send_command
          service_data:
            device_name: "Living Room Fire TV"
            command: back
      - type: button
        name: Power
        tap_action:
          action: call-service
          service: firemote.toggle_power
          service_data:
            device_name: "Living Room Fire TV"
```

If you want a native entity, the integration also creates `remote` entities for each configured device.

## Lovelace Card Example

The new built-in Lovelace card can be added with the following configuration:

```yaml
type: custom:firemote-card
device_name: "Living Room Fire TV"
media_player_entity: media_player.living_room_fire_tv
device_family: amazon-fire
device_type: fire_stick_4k
compatibility_mode: default
```

The card exposes power, navigation, playback, directional, and volume controls plus a text input for `firemote.send_text`.

## Notes

- Existing entity names remain unchanged in the service configuration.
- Non-HA TypeScript source is isolated in the legacy `integration_output/` folder and is not required for the custom integration.
- The integration is compatible with Home Assistant OS and supervised installs.
