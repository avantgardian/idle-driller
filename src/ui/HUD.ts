import { GameState } from '../state/GameState';

export class HUD {
  state: GameState;
  el: HTMLElement;
  unsub: () => void;
  onDrillBuy: (() => void) | null = null;
  onBaseUpgrade: (() => void) | null = null;
  onAddDrone: (() => void) | null = null;
  onUpgradeCapacity: (() => void) | null = null;
  onSave: (() => void) | null = null;
  onRestart: (() => void) | null = null;
  onOverdriveClick: (() => void) | null = null;

  private scrapValue: HTMLElement;
  private scrapRate: HTMLElement;
  private drillBtn: HTMLButtonElement;
  private upgradeBtn: HTMLButtonElement;
  private addDroneBtn: HTMLButtonElement;
  private capacityBtn: HTMLButtonElement;
  private saveBtn: HTMLButtonElement;
  private restartBtn: HTMLButtonElement;
  private overdrivePanel: HTMLElement;
  private gaugeFill: HTMLElement;
  private pressureText: HTMLElement;
  private multText: HTMLElement;
  private overdriveBtn: HTMLButtonElement;
  private pending = false;

  constructor(state: GameState) {
    this.state = state;
    this.el = document.getElementById('hud')!;

    this.el.innerHTML = `
      <div class="hud-top">
        <div class="hud-resource">
          <span class="hud-icon">⚡</span>
          <span class="hud-value" id="hud-scrap">0</span>
          <span class="hud-rate" id="hud-rate"></span>
        </div>
      </div>
      <div class="hud-bottom">
        <button class="hud-btn" id="btn-drill">🔧 Build Drill (${state.drillCost})</button>
        <button class="hud-btn" id="btn-add-drone">⬆ Add Drone (100)</button>
        <button class="hud-btn" id="btn-capacity">⬆ Double Capacity (250)</button>
        <button class="hud-btn" id="btn-upgrade">⬆ Upgrade Base (0)</button>
      </div>
      <div class="hud-save">
        <button class="hud-btn hud-btn-save" id="btn-save">💾 Save</button>
        <button class="hud-btn hud-btn-save" id="btn-restart">🔄 Restart</button>
      </div>
      <button class="hud-btn hud-overdrive-tab" id="btn-overdrive-tab">⚡</button>
      <div class="hud-overdrive" id="hud-overdrive">
        <div class="hud-overdrive-panel">
          <div class="hud-overdrive-header">⚡ Overdrive</div>
          <div class="hud-gauge">
            <div class="hud-gauge-fill" id="hud-gauge-fill"></div>
          </div>
          <div class="hud-overdrive-info">
            <span id="hud-pressure-text">0%</span>
            <span id="hud-mult-text">1.0x</span>
          </div>
          <button class="hud-btn" id="btn-overdrive">⚡ Overdrive!</button>
          <button class="hud-btn hud-overdrive-close" id="btn-overdrive-close">✕</button>
        </div>
      </div>
    `;

    this.scrapValue = document.getElementById('hud-scrap')!;
    this.scrapRate = document.getElementById('hud-rate')!;
    this.drillBtn = document.getElementById('btn-drill') as HTMLButtonElement;
    this.addDroneBtn = document.getElementById('btn-add-drone') as HTMLButtonElement;
    this.capacityBtn = document.getElementById('btn-capacity') as HTMLButtonElement;
    this.upgradeBtn = document.getElementById('btn-upgrade') as HTMLButtonElement;
    this.saveBtn = document.getElementById('btn-save') as HTMLButtonElement;
    this.restartBtn = document.getElementById('btn-restart') as HTMLButtonElement;
    this.overdrivePanel = document.getElementById('hud-overdrive')!;
    this.gaugeFill = document.getElementById('hud-gauge-fill')!;
    this.pressureText = document.getElementById('hud-pressure-text')!;
    this.multText = document.getElementById('hud-mult-text')!;
    this.overdriveBtn = document.getElementById('btn-overdrive') as HTMLButtonElement;

    this.drillBtn.addEventListener('click', () => this.onDrillBuy?.());
    this.addDroneBtn.addEventListener('click', () => this.onAddDrone?.());
    this.capacityBtn.addEventListener('click', () => this.onUpgradeCapacity?.());
    this.upgradeBtn.addEventListener('click', () => this.onBaseUpgrade?.());
    this.saveBtn.addEventListener('click', () => this.onSave?.());
    this.restartBtn.addEventListener('click', () => this.onRestart?.());
    this.overdriveBtn.addEventListener('click', () => {
      this.onOverdriveClick?.();
      this.render();
    });
    document.getElementById('btn-overdrive-close')!.addEventListener('click', () => this.hideOverdrive());
    document.getElementById('btn-overdrive-tab')!.addEventListener('click', () => this.toggleOverdrive());

    this.render();
    this.unsub = state.subscribe(() => this.schedule());
  }

  toggleOverdrive() {
    if (this.overdrivePanel.classList.contains('open')) {
      this.hideOverdrive();
    } else {
      this.showOverdrive();
    }
  }

  showOverdrive() {
    this.overdrivePanel.classList.add('open');
    this.render();
  }

  hideOverdrive() {
    this.overdrivePanel.classList.remove('open');
  }

  private schedule() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.render();
    });
  }

  setCallbacks(onDrillBuy: () => void, onBaseUpgrade: () => void, onAddDrone: () => void, onUpgradeCapacity: () => void, onSave: () => void, onRestart: () => void, onOverdriveClick: () => void) {
    this.onDrillBuy = onDrillBuy;
    this.onBaseUpgrade = onBaseUpgrade;
    this.onAddDrone = onAddDrone;
    this.onUpgradeCapacity = onUpgradeCapacity;
    this.onSave = onSave;
    this.onRestart = onRestart;
    this.onOverdriveClick = onOverdriveClick;
  }

  private render() {
    const s = this.state;
    this.scrapValue.textContent = String(Math.floor(s.scrap));
    this.scrapRate.textContent = String(s.scrapRate.toFixed(1)) + '/s';
    this.drillBtn.textContent = s.drillTargetValid ? `🔧 Build Drill (${s.drillCost})` : '🔧 Select a node';
    this.upgradeBtn.textContent = `⬆ Upgrade Base (${s.upgradeCost})`;
    this.drillBtn.className = `hud-btn${s.canBuyDrill() && s.drillTargetValid ? '' : ' hud-btn-disabled'}`;
    this.upgradeBtn.className = `hud-btn${s.scrap >= s.upgradeCost ? '' : ' hud-btn-disabled'}`;

    if (s.addDroneTargetValid) {
      this.addDroneBtn.style.display = '';
      this.addDroneBtn.textContent = `⬆ Add Drone (${s.addDroneCost})`;
      this.addDroneBtn.className = `hud-btn${s.canAffordAddDrone() ? '' : ' hud-btn-disabled'}`;
    } else {
      this.addDroneBtn.style.display = 'none';
    }

    if (s.capacityUpgradeTargetValid) {
      this.capacityBtn.style.display = '';
      this.capacityBtn.textContent = `⬆ Double Capacity (${s.capacityUpgradeCost})`;
      this.capacityBtn.className = `hud-btn${s.canAffordCapacityUpgrade() ? '' : ' hud-btn-disabled'}`;
    } else {
      this.capacityBtn.style.display = 'none';
    }

    const pct = Math.round(s.overdrivePressure * 100);
    this.gaugeFill.style.width = pct + '%';
    this.pressureText.textContent = pct + '%';
    this.multText.textContent = s.overdriveMultiplier.toFixed(1) + 'x';
  }
}
