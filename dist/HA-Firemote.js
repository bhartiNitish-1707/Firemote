(function () {
  const CARD_TYPE = 'custom:firemote-card';
  const CARD_TAG = 'firemote-card';
  const DEFAULT_CONFIG = {
    compatibility_mode: 'default'
  };
  const ACTION_BUTTONS = [
    { action: 'power', label: 'Power' },
    { action: 'home', label: 'Home' },
    { action: 'back', label: 'Back' },
    { action: 'menu', label: 'Menu' }
  ];
  const NAV_BUTTONS = [
    { action: 'up', label: 'Up' },
    { action: 'left', label: 'Left' },
    { action: 'select', label: 'OK' },
    { action: 'right', label: 'Right' },
    { action: 'down', label: 'Down' }
  ];
  const MEDIA_BUTTONS = [
    { action: 'rewind', label: 'Rewind' },
    { action: 'play_pause', label: 'Play/Pause' },
    { action: 'fast_forward', label: 'Fast Forward' }
  ];
  const VOLUME_BUTTONS = [
    { action: 'volume_down', label: 'Vol -' },
    { action: 'mute', label: 'Mute' },
    { action: 'volume_up', label: 'Vol +' }
  ];
  function escapeHtml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  class FiremoteCard extends HTMLElement {
    constructor() {
      super();
      this._config = null;
      this._hass = null;
      this.attachShadow({ mode: 'open' });
    }
    setConfig(config) {
      if (!config || (!config.device_name && !config.media_player_entity)) {
        throw new Error('Firemote card requires device_name or media_player_entity in configuration.');
      }
      this._config = Object.assign(Object.assign({}, DEFAULT_CONFIG), config);
      this.render();
    }
    getCardSize() {
      return 7;
    }
    set hass(hass) {
      this._hass = hass;
      this.render();
    }
    render() {
      if (!this._config) {
        return;
      }
      const title = escapeHtml(this._config.title || this._config.device_name || 'Firemote');
      const subtitle = [
        this._config.device_family,
        this._config.device_type,
        this._config.compatibility_mode ? `mode: ${this._config.compatibility_mode}` : undefined
      ]
        .filter(Boolean)
        .join(' · ');
      const mediaState = this._config.media_player_entity && this._hass ? this._hass.states[this._config.media_player_entity] : undefined;
      const volumeLevel = typeof (mediaState === null || mediaState === void 0 ? void 0 : mediaState.attributes.volume_level) === 'number' ? mediaState.attributes.volume_level : null;
      const volumeText = volumeLevel !== null ? `Volume ${Math.round(volumeLevel * 100)}%` : 'Volume';
      const sliderValue = volumeLevel !== null ? Math.round(volumeLevel * 100) : 50;
      const sliderDisabled = volumeLevel === null ? 'disabled' : '';
      this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--ha-card-font-family, 'Arial', sans-serif);
        }
        .firemote-card {
          padding: 16px;
          color: var(--primary-text-color);
        }
        h1 {
          margin: 0 0 8px;
          font-size: 1.1rem;
        }
        .subtitle {
          color: var(--secondary-text-color);
          font-size: 0.85rem;
          margin-bottom: 12px;
        }
        .button-row,
        .nav-grid,
        .media-row,
        .volume-row,
        .text-row {
          display: grid;
          gap: 8px;
          margin-bottom: 12px;
        }
        .button-row,
        .media-row,
        .volume-row {
          grid-template-columns: repeat(4, 1fr);
        }
        .nav-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          align-items: center;
          justify-items: center;
        }
        .nav-grid button:nth-child(1) {
          grid-column: 2 / 3;
        }
        .nav-grid button:nth-child(2) {
          grid-column: 1 / 2;
        }
        .nav-grid button:nth-child(3) {
          grid-column: 2 / 3;
        }
        .nav-grid button:nth-child(4) {
          grid-column: 3 / 4;
        }
        .nav-grid button:nth-child(5) {
          grid-column: 2 / 3;
        }
        button {
          border: none;
          border-radius: 8px;
          background: var(--paper-card-background-color);
          color: var(--primary-text-color);
          font-size: 0.9rem;
          padding: 12px 8px;
          box-shadow: var(--ha-card-box-shadow, none);
          cursor: pointer;
          transition: transform 0.1s ease, filter 0.1s ease;
          min-height: 44px;
        }
        button:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
        }
        button:active {
          transform: translateY(0);
        }
        button.primary {
          background: var(--primary-color);
          color: white;
        }
        button.secondary {
          background: rgba(0, 0, 0, 0.08);
        }
        input[type='text'] {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--divider-color);
          font-size: 0.95rem;
          box-sizing: border-box;
        }
        input[type='range'] {
          width: 100%;
        }
        .text-row {
          grid-template-columns: 1fr auto;
        }
      </style>
      <div class="firemote-card">
        <h1>${title}</h1>
        <div class="subtitle">${escapeHtml(subtitle || this._config.media_player_entity || '')}</div>
        <div class="button-row">
          ${ACTION_BUTTONS.map(btn => `<button data-action="${btn.action}">${btn.label}</button>`).join('')}
        </div>
        <div class="nav-grid">
          ${NAV_BUTTONS.map(btn => `<button data-action="${btn.action}">${btn.label}</button>`).join('')}
        </div>
        <div class="media-row">
          ${MEDIA_BUTTONS.map(btn => `<button data-action="${btn.action}">${btn.label}</button>`).join('')}
        </div>
        <div class="volume-row">
          ${VOLUME_BUTTONS.map(btn => `<button data-action="${btn.action}">${btn.label}</button>`).join('')}
        </div>
        <div class="text-row">
          <input id="firemote-text-input" type="text" placeholder="Send text" />
          <button id="firemote-text-send" class="primary">Send</button>
        </div>
        <div class="text-row">
          <label for="firemote-volume-slider">${escapeHtml(volumeText)}</label>
          <input id="firemote-volume-slider" type="range" min="0" max="100" value="${sliderValue}" ${sliderDisabled} />
        </div>
      </div>
    `;
      this.attachListeners();
    }
    attachListeners() {
      const buttons = Array.from(this.shadowRoot.querySelectorAll('button[data-action]'));
      buttons.forEach(button => {
        button.addEventListener('click', () => this.handleButton(button.dataset.action || ''));
      });
      const sendTextButton = this.shadowRoot.querySelector('#firemote-text-send');
      const textInput = this.shadowRoot.querySelector('#firemote-text-input');
      if (sendTextButton) {
        sendTextButton.addEventListener('click', () => this.handleSendText(textInput ? textInput.value : ''));
      }
      const volumeSlider = this.shadowRoot.querySelector('#firemote-volume-slider');
      if (volumeSlider) {
        volumeSlider.addEventListener('change', () => this.handleVolumeSlider(Number(volumeSlider.value) / 100));
      }
    }
    handleButton(action) {
      switch (action) {
        case 'power':
          this.callService('toggle_power', {});
          break;
        case 'home':
        case 'back':
        case 'menu':
        case 'up':
        case 'down':
        case 'left':
        case 'right':
        case 'select':
        case 'rewind':
        case 'play_pause':
        case 'fast_forward':
          this.callCommand(action);
          break;
        case 'volume_up':
          this.adjustVolume(0.05);
          break;
        case 'volume_down':
          this.adjustVolume(-0.05);
          break;
        case 'mute':
          this.callService('set_volume', { volume_level: 0 });
          break;
        default:
          break;
      }
    }
    handleSendText(value) {
      const text = value ? value.trim() : '';
      if (!text) {
        return;
      }
      this.callService('send_text', { text });
    }
    handleVolumeSlider(level) {
      this.callService('set_volume', { volume_level: Math.min(1, Math.max(0, level)) });
    }
    adjustVolume(delta) {
      const current = this.getVolumeLevel();
      if (current === null) {
        const fallback = delta > 0 ? 0.8 : 0.2;
        this.callService('set_volume', { volume_level: fallback });
        return;
      }
      const nextVolume = Math.min(1, Math.max(0, current + delta));
      this.callService('set_volume', { volume_level: nextVolume });
    }
    getVolumeLevel() {
      if (!this._config || !this._config.media_player_entity || !this._hass) {
        return null;
      }
      const state = this._hass.states[this._config.media_player_entity];
      const volume = state && state.attributes ? state.attributes.volume_level : undefined;
      return typeof volume === 'number' ? volume : null;
    }
    callCommand(command) {
      this.callService('send_command', { command });
    }
    callService(service, data) {
      if (!this._config || !this._hass) {
        return;
      }
      const serviceData = Object.assign({ device_name: this._config.device_name || this._config.media_player_entity }, data);
      if (this._config.media_player_entity) {
        serviceData.media_player_entity = this._config.media_player_entity;
      }
      if (this._config.device_family) {
        serviceData.device_family = this._config.device_family;
      }
      if (this._config.device_type) {
        serviceData.device_type = this._config.device_type;
      }
      if (this._config.compatibility_mode) {
        serviceData.compatibility_mode = this._config.compatibility_mode;
      }
      this._hass.callService('firemote', service, serviceData);
    }
  }
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CARD_TYPE,
    name: 'Firemote Card',
    description: 'A Lovelace card to control Firemote devices with Home Assistant backend services.'
  });
  customElements.define(CARD_TAG, FiremoteCard);
})();
