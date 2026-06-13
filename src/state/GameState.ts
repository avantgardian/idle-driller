import { DRILL_RATE } from '../config';

export interface SaveData {
  version: number;
  scrap: number;
  baseLevel: number;
  drillCount: number;
  unlockedNodeCount: number;
  nodes: { col: number; row: number; drillLevel: number; capacityUpgraded: boolean }[];
}

export type GameListener = () => void;

export class GameState {
  private listeners: Set<GameListener> = new Set();

  scrap = 25;
  scrapRate = 0;
  baseLevel = 1;
  drillCount = 0;
  unlockedNodeCount = 1;
  drillTargetValid = false;
  addDroneTargetValid = false;
  addDroneLevel = 1;
  capacityUpgradeTargetValid = false;
  overdrivePressure = 0;
  private lastOverdriveClick = 0;
  private lastTickTime = Date.now();

  constructor() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.save();
      else this.sync();
    });
  }

  private saveKey = "idle-driller-save";
  nodesRef: { col: number; row: number; drillLevel: number; capacityUpgraded: boolean }[] | null = null;

  clearSave() {
    localStorage.removeItem(this.saveKey);
    this.nodesRef = null;
    this.scrap = 25;
    this.scrapRate = 0;
    this.baseLevel = 1;
    this.drillCount = 0;
    this.unlockedNodeCount = 1;
    this.addDroneLevel = 1;
    this.lastTickTime = Date.now();
    this.overdrivePressure = 0;
    this.lastOverdriveClick = 0;
    this.notify();
  }

  save() {
    const nodes = this.nodesRef;
    if (!nodes || nodes.length === 0) return;
    const data: SaveData = {
      version: 1,
      scrap: this.scrap,
      baseLevel: this.baseLevel,
      drillCount: this.drillCount,
      unlockedNodeCount: this.unlockedNodeCount,
      nodes,
    };
    try {
      localStorage.setItem(this.saveKey, JSON.stringify(data));
    } catch {
      // storage full or unavailable
    }
  }

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (!raw) {
        console.log("LOAD: no save data found");
        return null;
      }
      const data = JSON.parse(raw) as SaveData;
      console.log("LOAD: found save data", data);
      if (data.version !== 1) {
        console.log("LOAD: wrong version", data.version);
        return null;
      }
      if (!data.nodes || data.nodes.length === 0) {
        console.log("LOAD: empty save (no drills), treating as fresh game");
        return null;
      }
      if (data.nodes.length !== data.drillCount) {
        console.log("LOAD: inconsistent save, treating as fresh game");
        return null;
      }
      this.scrap = data.scrap;
      this.baseLevel = data.baseLevel;
      this.drillCount = data.drillCount;
      this.unlockedNodeCount = data.unlockedNodeCount ?? 1;
      this.updateScrapRate();
      this.notify();
      return data;
    } catch (e) {
      console.error("LOAD error:", e);
      return null;
    }
  }

  subscribe(fn: GameListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  sync() {
    const now = Date.now();
    const elapsed = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    if (elapsed > 1.5) {
      const gained = this.scrapRate * elapsed;
      if (gained > 0) {
        this.scrap += gained;
        this.notify();
      }
    }

    if (this.overdrivePressure > 0) {
      const sinceClick = (now - this.lastOverdriveClick) / 1000;
      if (sinceClick > 0.5) {
        this.overdrivePressure = Math.max(0, this.overdrivePressure - elapsed * 0.1);
        this.updateScrapRate();
        this.notify();
      }
    }
  }

  clickOverdrive() {
    this.overdrivePressure = Math.min(1, this.overdrivePressure + 0.01);
    this.lastOverdriveClick = Date.now();
    this.updateScrapRate();
    this.notify();
  }

  get overdriveMultiplier(): number {
    return 1 + this.overdrivePressure * 4;
  }

  addScrap(amount: number) {
    this.scrap += amount;
    this.notify();
  }

  spendScrap(amount: number): boolean {
    if (this.scrap < amount) return false;
    this.scrap -= amount;
    this.notify();
    return true;
  }

  get drillCost(): number {
    return 25 * Math.pow(2, this.drillCount);
  }

  get upgradeCost(): number {
    return this.baseLevel * this.baseLevel * 200;
  }

  get criticalChance(): number {
    return Math.min(this.baseLevel * 0.05, 0.5);
  }

  canBuyDrill(): boolean {
    return this.scrap >= this.drillCost;
  }

  get addDroneCost(): number {
    return 100 * this.addDroneLevel;
  }

  get capacityUpgradeCost(): number {
    return 250;
  }

  canAffordAddDrone(): boolean {
    return this.scrap >= this.addDroneCost;
  }

  canAffordCapacityUpgrade(): boolean {
    return this.scrap >= this.capacityUpgradeCost;
  }

  setDrillTargetValid(valid: boolean) {
    this.drillTargetValid = valid;
    this.notify();
  }

  setAddDroneTargetValid(valid: boolean) {
    this.addDroneTargetValid = valid;
    this.notify();
  }

  setCapacityUpgradeTargetValid(valid: boolean) {
    this.capacityUpgradeTargetValid = valid;
    this.notify();
  }

  private updateScrapRate() {
    this.scrapRate = this.drillCount * DRILL_RATE * this.overdriveMultiplier;
  }

  upgradeBase(): boolean {
    const cost = this.upgradeCost;
    if (!this.spendScrap(cost)) return false;
    this.baseLevel++;
    this.updateScrapRate();
    this.notify();
    return true;
  }

  addDrone(): boolean {
    if (!this.spendScrap(this.addDroneCost)) return false;
    this.notify();
    return true;
  }

  upgradeCapacity(): boolean {
    if (!this.spendScrap(this.capacityUpgradeCost)) return false;
    this.notify();
    return true;
  }

  buyDrill(): boolean {
    if (!this.spendScrap(this.drillCost)) return false;
    this.drillCount++;
    this.updateScrapRate();
    this.notify();
    return true;
  }
}
