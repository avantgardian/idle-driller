import Phaser from "phaser";
import { TILE_W, TILE_H, MAP_COLS, MAP_ROWS } from "../config";
import { GameState } from "../state/GameState";
import { HUD } from "../ui/HUD";
import { KeybindingsLegend } from "../ui/KeybindingsLegend";

interface NodeData {
  col: number;
  row: number;
  sprite: Phaser.GameObjects.Image;
  hasDrill: boolean;
  drillSprite: Phaser.GameObjects.Sprite | null;
  drillLevel: number;
  capacityUpgraded: boolean;
  carrierDrones: Phaser.GameObjects.Image[];
}

function nodePositions(): [number, number][] {
    const bc = Math.floor(MAP_COLS / 2);
    const br = Math.floor(MAP_ROWS / 2);
    const positions: [number, number][] = [];
    const rings = [
        { dist: 4, count: 4 },
        { dist: 7, count: 6 },
        { dist: 10, count: 8 },
    ];
    for (const r of rings) {
        for (let i = 0; i < r.count; i++) {
            const angle = (i / r.count) * Math.PI * 2;
            const c = Math.round(bc + r.dist * Math.cos(angle));
            const rr = Math.round(br + r.dist * Math.sin(angle));
            if (c >= 0 && c < MAP_COLS && rr >= 0 && rr < MAP_ROWS) {
                positions.push([c, rr]);
            }
        }
    }
    return positions;
}

export class GameScene extends Phaser.Scene {
    private state!: GameState;
    private hud!: HUD;
    private nodes: NodeData[] = [];
    private baseSprite!: Phaser.GameObjects.Sprite;
    private isDragging = false;
    private dragStart = new Phaser.Math.Vector2();
    private camStart = new Phaser.Math.Vector2();
    private startedOnInteractive = false;
    private dragThreshold = 8;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private scrollSpeed = 400;
    private selectedNode: NodeData | null = null;
    private selectionRing: Phaser.GameObjects.Image | null = null;
    private selectionTween: Phaser.Tweens.Tween | null = null;
    private drillNodes: NodeData[] = [];
    private selectedDrillIndex = -1;

    constructor() {
        super("GameScene");
    }

    create() {
        this.state = new GameState();
        this.state.load();
        this.nodes = [];

        this.createGround();
        this.createBase();
        for (const [c, r] of nodePositions()) {
            this.createNode(c, r);
        }

        this.scale.on("resize", () => this.centerCamera());
        this.time.delayedCall(0, () => this.centerCamera());

        this.cursors = this.input.keyboard!.createCursorKeys();

        this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
            switch (event.code) {
                case 'Tab':
                    event.preventDefault();
                    if (event.shiftKey) this.selectPrevDrill();
                    else this.selectNextDrill();
                    break;
                case 'KeyB':
                    this.onBuyDrill();
                    break;
                case 'KeyD':
                    this.onAddDrone();
                    break;
                case 'KeyC':
                    this.onUpgradeCapacity();
                    break;
                case 'KeyU':
                    this.onUpgradeBase();
                    break;
                case 'KeyN':
                    this.selectNextEmptyNode();
                    break;
                case 'KeyO':
                    this.hud.toggleOverdrive();
                    break;
            }
        });

        this.input.on(
            "pointerdown",
            (p: Phaser.Input.Pointer, objects: unknown[]) => {
                if (p.rightButtonDown() || p.middleButtonDown()) {
                    this.isDragging = true;
                    this.dragStart.set(p.x, p.y);
                    this.camStart.set(
                        this.cameras.main.scrollX,
                        this.cameras.main.scrollY,
                    );
                    return;
                }
                this.dragStart.set(p.x, p.y);
                this.camStart.set(
                    this.cameras.main.scrollX,
                    this.cameras.main.scrollY,
                );
                this.startedOnInteractive = objects.length > 0;
                this.isDragging = false;
                if (objects.length === 0) this.selectNode(null);
            },
        );
        this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
            if (this.isDragging) {
                this.cameras.main.scrollX =
                    this.camStart.x - (p.x - this.dragStart.x);
                this.cameras.main.scrollY =
                    this.camStart.y - (p.y - this.dragStart.y);
                return;
            }
            if (p.leftButtonDown() && !this.startedOnInteractive) {
                const dist = Phaser.Math.Distance.Between(
                    this.dragStart.x,
                    this.dragStart.y,
                    p.x,
                    p.y,
                );
                if (dist > this.dragThreshold) {
                    this.isDragging = true;
                }
            }
        });
        this.input.on("pointerup", () => {
            this.isDragging = false;
            this.startedOnInteractive = false;
        });

        this.game.canvas.addEventListener("contextmenu", (e: Event) =>
            e.preventDefault(),
        );

        this.hud = new HUD(this.state);
        this.hud.setCallbacks(
            () => this.onBuyDrill(),
            () => this.onUpgradeBase(),
            () => this.onAddDrone(),
            () => this.onUpgradeCapacity(),
            () => this.onSave(),
            () => this.onRestart(),
            () => this.state.clickOverdrive(),
        );

        new KeybindingsLegend();
    }

    private onSave() {
        this.syncNodeRefs();
        this.state.save();
    }

    private onRestart() {
        this.baseSprite.stop();
        this.baseSprite.disableInteractive();

        const duration = 600;
        const items: { x: number; y: number; depth: number; obj: Phaser.GameObjects.GameObject }[] = [];

        items.push({ x: this.baseSprite.x, y: this.baseSprite.y, depth: this.baseSprite.depth, obj: this.baseSprite });

        for (const node of this.nodes) {
            if (node.hasDrill && node.drillSprite) {
                node.drillSprite.disableInteractive();
                items.push({ x: node.drillSprite.x, y: node.drillSprite.y, depth: node.drillSprite.depth, obj: node.drillSprite });
            }
            for (const drone of node.carrierDrones) {
                if (drone?.active) {
                    items.push({ x: drone.x, y: drone.y, depth: drone.depth, obj: drone });
                }
            }
        }

        for (const item of items) {
            for (let i = 0; i < 4; i++) {
                const puff = this.add.image(item.x, item.y, "dust");
                puff.setDepth(item.depth + 1);
                puff.setScale(0.3);
                puff.setAlpha(0.9);
                puff.setTint(0xff6600);
                this.tweens.add({
                    targets: puff,
                    scaleX: 2.5,
                    scaleY: 2.5,
                    alpha: 0,
                    x: item.x + Phaser.Math.Between(-20, 20),
                    y: item.y + Phaser.Math.Between(-20, 5),
                    duration: duration + Math.random() * 200,
                    ease: "Quad.easeOut",
                    onComplete: () => puff.destroy(),
                });
            }

            this.tweens.add({
                targets: item.obj,
                alpha: 0,
                scaleX: 0.2,
                scaleY: 0.2,
                duration: duration * 0.7,
                ease: "Quad.easeIn",
                onComplete: () => item.obj.destroy(),
            });
        }

        this.cameras.main.shake(300, 0.015);

        setTimeout(() => {
            this.state.clearSave();
            location.reload();
        }, duration + 300);
    }

    update(_time: number, delta: number) {
        this.state.sync();
        const sec = delta / 1000;

        if (this.cursors.left.isDown)
            this.cameras.main.scrollX -= this.scrollSpeed * sec;
        if (this.cursors.right.isDown)
            this.cameras.main.scrollX += this.scrollSpeed * sec;
        if (this.cursors.up.isDown)
            this.cameras.main.scrollY -= this.scrollSpeed * sec;
        if (this.cursors.down.isDown)
            this.cameras.main.scrollY += this.scrollSpeed * sec;
    }

    private centerCamera() {
        const vw = this.scale.width;
        const vh = this.scale.height;

        const cx = ((MAP_COLS - 1 - (MAP_ROWS - 1)) * TILE_W) / 4;
        const cy = ((MAP_COLS - 1 + (MAP_ROWS - 1)) * TILE_H) / 4;

        this.cameras.main.setViewport(0, 0, vw, vh);
        this.cameras.main.setScroll(cx - vw / 2, cy - vh / 2);
        this.cameras.main.setBounds(-100000, -100000, 200000, 200000);

        this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gos: unknown[], _dx: number, dy: number) => {
            const cam = this.cameras.main;
            cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.3, 3));
        });
    }

    private tileToScreen(col: number, row: number): [number, number] {
        return [((col - row) * TILE_W) / 2, ((col + row) * TILE_H) / 2];
    }

    private createEntity(
        col: number,
        row: number,
        texture: string,
    ): Phaser.GameObjects.Image {
        const [x, y] = this.tileToScreen(col, row);
        const sprite = this.add.image(x, y, texture);
        sprite.setOrigin(0.5, 1);
        sprite.setDepth(col + row + 1);
        return sprite;
    }

    private createGround() {
        for (let c = 0; c < MAP_COLS; c++) {
            for (let r = 0; r < MAP_ROWS; r++) {
                const [x, y] = this.tileToScreen(c, r);
                const key = (c + r) % 2 === 0 ? "ground" : "ground-alt";
                const tile = this.add.image(x, y, key);
                tile.setDepth(c + r);
                tile.setOrigin(0.5, 1);
            }
        }
    }

    private createBase() {
        const col = Math.floor(MAP_COLS / 2);
        const row = Math.floor(MAP_ROWS / 2);
        const [targetX, targetY] = this.tileToScreen(col, row);

        this.baseSprite = this.add.sprite(targetX, targetY - 800, "assembler");
        this.baseSprite.setOrigin(0.5, 1);
        this.baseSprite.setDepth(col + row + 1);
        this.baseSprite.setScale(0.844);
        this.baseSprite.setFrame(0);

        const flame = this.add.image(targetX, targetY - 800 - 16, "flame");
        flame.setOrigin(0.5, 0);
        flame.setDepth(col + row);
        flame.setScale(1.4);
        this.tweens.add({
            targets: flame,
            scaleY: 0.75,
            scaleX: 0.9,
            duration: 120,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 5000,
            ease: "Cubic.easeOut",
            onUpdate: (tw) => {
                const t = tw.getValue() as number;
                const y = targetY - 800 + 800 * t;
                this.baseSprite.y = y;
                this.baseSprite.play("assembler-anim");
                flame.x = targetX;
                flame.y = y - 16;
                flame.setAlpha(t < 0.9 ? 1 : 1 - (t - 0.9) / 0.1);
            },
            onComplete: () => {
                flame.destroy();

                const dustPositions = [
                    { dx: 0, dy: -TILE_H / 2 },
                    { dx: TILE_W / 2, dy: 0 },
                    { dx: 0, dy: TILE_H / 2 },
                    { dx: -TILE_W / 2, dy: 0 },
                    { dx: TILE_W / 3, dy: -TILE_H / 4 },
                    { dx: -TILE_W / 3, dy: -TILE_H / 4 },
                ];
                dustPositions.forEach(({ dx, dy }) => {
                    const puff = this.add.image(
                        targetX + dx,
                        targetY + dy - 30,
                        "dust",
                    );
                    puff.setDepth(col + row + 2);
                    puff.setScale(0.3);
                    puff.setAlpha(0.7);
                    this.tweens.add({
                        targets: puff,
                        scaleX: 1.8,
                        scaleY: 2.2,
                        alpha: 0,
                        x: puff.x + dx * 0.3,
                        y: puff.y - 10,
                        duration: 2400 + Math.random() * 1200,
                        ease: "Quad.easeOut",
                        onComplete: () => puff.destroy(),
                    });
                });
                this.cameras.main.shake(200, 0.008);
                this.baseSprite.setInteractive({ useHandCursor: true });
                this.baseSprite.on("pointerdown", () => this.onBaseClick());
                for (let i = 0; i < this.state.unlockedNodeCount; i++) {
                    this.revealNode(this.nodes[i]);
                }
                this.loadGame();
            },
        });
    }

    private createNode(col: number, row: number) {
        const sprite = this.createEntity(col, row, "node");
        sprite.setAlpha(0);
        const node: NodeData = {
            col,
            row,
            sprite,
            hasDrill: false,
            drillSprite: null,
            drillLevel: 0,
            capacityUpgraded: false,
            carrierDrones: [],
        };
    this.nodes.push(node);
  }

    private syncNodeRefs() {
        this.state.nodesRef = this.nodes
            .filter((n) => n.hasDrill)
            .map((n) => ({
                col: n.col,
                row: n.row,
                drillLevel: n.drillLevel,
                capacityUpgraded: n.capacityUpgraded,
            }));
    }

    private loadGame() {
        const data = this.state.load();
        if (!data) return;
        if (data.baseLevel >= 2) {
            this.baseSprite.setTexture("assembler-2");
            this.baseSprite.play("assembler-2-anim");
        }
        for (const saved of data.nodes) {
            const node = this.nodes.find(
                (n) => n.col === saved.col && n.row === saved.row,
            );
            if (!node) continue;
            this.placeDrill(node, saved.drillLevel, saved.capacityUpgraded);
        }
        this.syncNodeRefs();
        this.state.save();
    }

    private placeDrill(
        node: NodeData,
        drillLevel: number,
        capacityUpgraded: boolean,
    ) {
        const [endX, endY] = this.tileToScreen(node.col, node.row);
        const drill = this.add.sprite(endX - 8, endY + 12, "drill");
        drill.setOrigin(0.5, 1);
        drill.setScale(0.66);
        drill.setDepth(node.col + node.row + 2);
        drill.setInteractive({ useHandCursor: true, pixelPerfect: true });
        drill.on("pointerdown", () => this.onNodeClick(node));
        drill.play("drill-anim");
        node.hasDrill = true;
        node.drillSprite = drill;
        node.drillLevel = drillLevel;
        node.capacityUpgraded = capacityUpgraded;
        this.drillNodes.push(node);
        this.drillNodes.sort((a, b) => a.col - b.col || a.row - b.row);
        for (let i = 0; i < drillLevel; i++) {
            this.startCarrierLoop(node, i);
        }
    }

    private revealNode(node: NodeData) {
        node.sprite.setInteractive({ useHandCursor: true });
        node.sprite.setAlpha(0.25);
        node.sprite.on("pointerdown", () => this.onNodeClick(node));
        node.sprite.on("pointerover", () => {
            this.tweens.add({ targets: node.sprite, alpha: 1, duration: 150, ease: "Quad.easeOut" });
        });
        node.sprite.on("pointerout", () => {
            this.tweens.add({ targets: node.sprite, alpha: 0.25, duration: 150, ease: "Quad.easeIn" });
        });
    }

    private checkUnlock() {
        const idx = this.state.unlockedNodeCount - 1;
        const node = this.nodes[idx];
        if (!node || !node.hasDrill || node.drillLevel < 6) return;
        if (this.state.baseLevel <= this.state.unlockedNodeCount) return;
        if (this.state.unlockedNodeCount >= this.nodes.length) return;
        this.state.unlockedNodeCount++;
        this.revealNode(this.nodes[this.state.unlockedNodeCount - 1]);
        this.syncNodeRefs();
        this.state.save();
        const [ex, ey] = this.tileToScreen(
            this.nodes[this.state.unlockedNodeCount - 1].col,
            this.nodes[this.state.unlockedNodeCount - 1].row,
        );
        this.showFloatingText(ex, ey - 20, "🔓 New node!");
    }

    private onNodeClick(node: NodeData) {
        this.selectNode(node);
    }

    private selectNode(node: NodeData | null) {
        if (this.selectionRing) {
            this.selectionRing.destroy();
            this.selectionRing = null;
        }
        if (this.selectionTween) {
            this.selectionTween.stop();
            this.selectionTween = null;
        }

        this.selectedNode = node;
        if (node && node.hasDrill) {
            this.selectedDrillIndex = this.drillNodes.indexOf(node);
        } else {
            this.selectedDrillIndex = -1;
        }
        this.state.setDrillTargetValid(node !== null && !node.hasDrill);
        this.state.setAddDroneTargetValid(
            node !== null && node.hasDrill && node.drillSprite !== null,
        );
        this.state.setCapacityUpgradeTargetValid(
            node !== null && node.hasDrill && node.drillSprite !== null && !node.capacityUpgraded,
        );
        if (node && node.hasDrill && node.drillSprite) {
            this.state.addDroneLevel = node.drillLevel;
        }

        if (node) {
            const [x, y] = this.tileToScreen(node.col, node.row);
            this.selectionRing = this.add.image(x, y, "selection-ring");
            this.selectionRing.setOrigin(0.5, 1);
            this.selectionRing.setDepth(node.col + node.row + 3);
            this.selectionTween = this.tweens.add({
                targets: this.selectionRing,
                scaleX: 1.25,
                scaleY: 1.25,
                duration: 600,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut",
            });
        }
    }

    private selectNextDrill() {
        if (this.drillNodes.length === 0) return;
        if (this.selectedDrillIndex < 0) this.selectedDrillIndex = 0;
        else this.selectedDrillIndex = (this.selectedDrillIndex + 1) % this.drillNodes.length;
        this.selectNode(this.drillNodes[this.selectedDrillIndex]);
    }

    private selectPrevDrill() {
        if (this.drillNodes.length === 0) return;
        if (this.selectedDrillIndex < 0) this.selectedDrillIndex = this.drillNodes.length - 1;
        else this.selectedDrillIndex = (this.selectedDrillIndex - 1 + this.drillNodes.length) % this.drillNodes.length;
        this.selectNode(this.drillNodes[this.selectedDrillIndex]);
    }

    private selectNextEmptyNode() {
        const unlocked = this.state.unlockedNodeCount;
        if (unlocked === 0) return;
        const current = this.selectedNode;
        const startIdx = current ? this.nodes.indexOf(current) + 1 : 0;
        for (let i = 0; i < unlocked; i++) {
            const idx = (startIdx + i) % unlocked;
            const node = this.nodes[idx];
            if (node && !node.hasDrill) {
                this.selectNode(node);
                return;
            }
        }
    }

    private onBaseClick() {
        this.hud.toggleOverdrive();
    }

    private onBuyDrill() {
        const target = this.selectedNode;
        if (!target || target.hasDrill || !this.state.buyDrill()) return;

        target.hasDrill = true;
        target.drillLevel = 1;
        this.selectNode(null);

        const [endX, endY] = this.tileToScreen(target.col, target.row);
        const depth = target.col + target.row + 2;

        const label = this.add.text(endX, endY - 40, "🔧 Building...", {
            fontSize: "12px",
            color: "#ffcc00",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(depth + 2);

        const barBg = this.add.graphics();
        barBg.fillStyle(0x333333, 0.8);
        barBg.fillRect(endX - 20, endY - 26, 40, 6);
        barBg.setDepth(depth + 2);

        const barFill = this.add.graphics();
        barFill.setDepth(depth + 3);

        this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 10000,
            onUpdate: (tw) => {
                const p = tw.getValue() as number;
                barFill.clear();
                barFill.fillStyle(0x44ff44, 1);
                barFill.fillRect(endX - 20, endY - 26, 40 * p, 6);
            },
            onComplete: () => {
                label.destroy();
                barBg.destroy();
                barFill.destroy();

                const drill = this.add.sprite(endX - 8, endY + 12, "drill");
                drill.setOrigin(0.5, 1);
                drill.setScale(0.66);
                drill.setDepth(depth);
                drill.setInteractive({ useHandCursor: true, pixelPerfect: true });
                drill.on("pointerdown", () => this.onNodeClick(target));
                drill.play("drill-anim");
                target.drillSprite = drill;
                this.drillNodes.push(target);
                this.drillNodes.sort((a, b) => a.col - b.col || a.row - b.row);
                this.syncNodeRefs();
                this.state.save();
                this.showFloatingText(endX, endY - 36, "🔧 Drill!");
                this.startCarrierLoop(target, 0);
            },
        });
    }

    private onAddDrone() {
        const target = this.selectedNode;
        if (!target || !target.hasDrill || !this.state.addDrone()) return;
        target.drillLevel++;
        this.checkUnlock();
        this.syncNodeRefs();
        this.state.save();
        this.startCarrierLoop(target, target.drillLevel - 1);
        const [endX, endY] = this.tileToScreen(target.col, target.row);
        this.showFloatingText(endX, endY - 20, "⬆ Drone +1");
        this.selectNode(target);
    }

    private onUpgradeCapacity() {
        const target = this.selectedNode;
        if (!target || !target.hasDrill || !this.state.upgradeCapacity()) return;
        target.capacityUpgraded = true;
        for (const drone of target.carrierDrones) {
            if (drone) {
                const tex = drone.texture.key === "drone-empty" || drone.texture.key === "drone-empty-2"
                    ? "drone-empty-2"
                    : "drone-2";
                drone.setTexture(tex);
            }
        }
        this.syncNodeRefs();
        this.state.save();
        const [endX, endY] = this.tileToScreen(target.col, target.row);
        this.showFloatingText(endX, endY - 36, "⬆ Double Capacity");
        this.selectNode(target);
    }

    private onUpgradeBase() {
        if (!this.state.upgradeBase()) return;
        if (this.state.baseLevel >= 2) {
            this.baseSprite.setTexture('assembler-2');
            this.baseSprite.play("assembler-2-anim");
        }
        this.tweens.add({
            targets: this.baseSprite,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 150,
            yoyo: true,
            ease: "Quad.easeOut",
        });
        this.checkUnlock();
    }

    private startCarrierLoop(node: NodeData, droneIndex: number) {
        const baseCol = Math.floor(MAP_COLS / 2);
        const baseRow = Math.floor(MAP_ROWS / 2);
        const [baseX, baseY] = this.tileToScreen(baseCol, baseRow);
        const midY = baseY - this.baseSprite.displayHeight / 2;
        const [nodeX, nodeY] = this.tileToScreen(node.col, node.row);

        const dist = Math.sqrt(
            (node.col - baseCol) ** 2 + (node.row - baseRow) ** 2,
        );
        const travelTime = dist * 300;
        const stagger = droneIndex * 500;
        function scrapAmount() { return node.capacityUpgraded ? 4 : 2; }
        function cargoTex() { return node.capacityUpgraded ? "drone-2" : "drone"; }
        function emptyTex() { return node.capacityUpgraded ? "drone-empty-2" : "drone-empty"; }

        const drone = this.add.image(baseX, midY, emptyTex());
        drone.setOrigin(0.5, 1);
        drone.setDepth(1000);
        node.carrierDrones[droneIndex] = drone;

        const shadow = this.add.image(baseX, midY, "shadow");
        shadow.setOrigin(0.5, 1);
        shadow.setDepth(999);
        shadow.setAlpha(0.5);

        const arc = 40;

        const flyToDrill = () => {
            this.tweens.addCounter({
                from: 0,
                to: 1,
                duration: travelTime,
                ease: "Sine.easeInOut",
                onUpdate: (tw) => {
                    if (!drone.active) return;
                    const t = tw.progress;
                    drone.x = baseX + (nodeX - baseX) * t;
                    drone.y =
                        midY +
                        (nodeY - midY) * t -
                        Math.sin(t * Math.PI) * arc;
                    shadow.x = baseX + (nodeX - baseX) * t;
                    shadow.y = midY + (nodeY - midY) * t;
                },
                onComplete: () => {
                    if (!drone.active) return;
                    drone.setTexture(cargoTex());
                    this.time.delayedCall(600, flyToBase);
                },
            });
        };

        const flyToBase = () => {
            this.tweens.addCounter({
                from: 0,
                to: 1,
                duration: travelTime,
                ease: "Sine.easeInOut",
                onUpdate: (tw) => {
                    if (!drone.active) return;
                    const t = tw.progress;
                    drone.x = nodeX + (baseX - nodeX) * t;
                    drone.y =
                        nodeY +
                        (midY - nodeY) * t -
                        Math.sin(t * Math.PI) * arc;
                    shadow.x = nodeX + (baseX - nodeX) * t;
                    shadow.y = nodeY + (midY - nodeY) * t;
                },
                onComplete: () => {
                    if (!drone.active) return;
                    const base = scrapAmount();
                    const isCritical = Math.random() < this.state.criticalChance;
                    const mult = isCritical ? this.getCritMultiplier() : 1;
                    const total = base * mult * this.state.overdriveMultiplier;
                    this.state.addScrap(total);
                    if (isCritical) {
                        this.showCriticalText(baseX, midY - 36, `+${Math.floor(total)}`, mult);
                    } else {
                        this.showFloatingText(baseX, midY - 36, `+${Math.floor(total)}`);
                    }
                    drone.setTexture(emptyTex());
                    this.time.delayedCall(600, flyToDrill);
                },
            });
        };

        this.time.delayedCall(stagger, flyToDrill);
    }

    private getCritMultiplier(): number {
        const roll = Math.random();
        if (roll < 0.4) return 2;
        if (roll < 0.7) return Phaser.Math.Between(3, 5);
        if (roll < 0.85) return Phaser.Math.Between(6, 10);
        if (roll < 0.95) return Phaser.Math.Between(11, 25);
        if (roll < 0.99) return Phaser.Math.Between(26, 49);
        return 50;
    }

    private showFloatingText(x: number, y: number, text: string) {
        const t = this.add
            .text(x, y, text, {
                fontSize: "16px",
                color: "#ffffff",
                fontStyle: "bold",
                stroke: "#000000",
                strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(1000);

        this.tweens.add({
            targets: t,
            y: y - 40,
            alpha: 0,
            duration: 800,
            ease: "Quad.easeOut",
            onComplete: () => t.destroy(),
        });
    }

    private showCriticalText(x: number, y: number, text: string, mult: number) {
        let fontSize = "20px";
        let color = "#ffdd44";
        let stroke = "#cc6600";
        let pulse = 1.4;
        if (mult >= 50) {
            fontSize = "50px"; color = "#ff0000"; stroke = "#440000"; pulse = 2.5;
        } else if (mult >= 26) {
            fontSize = "40px"; color = "#ff2200"; stroke = "#550000"; pulse = 2.2;
        } else if (mult >= 11) {
            fontSize = "34px"; color = "#ff4400"; stroke = "#662200"; pulse = 1.9;
        } else if (mult >= 6) {
            fontSize = "28px"; color = "#ff8800"; stroke = "#884400"; pulse = 1.6;
        } else if (mult >= 3) {
            fontSize = "24px"; color = "#ffaa22"; stroke = "#aa5500"; pulse = 1.5;
        }
        const t = this.add
            .text(x, y, `${text}  x${mult}`, {
                fontSize,
                color,
                fontStyle: "bold",
                stroke,
                strokeThickness: 5,
            })
            .setOrigin(0.5)
            .setDepth(1001);

        this.tweens.add({
            targets: t,
            scaleX: pulse,
            scaleY: pulse,
            duration: 150,
            yoyo: true,
        });
        this.tweens.add({
            targets: t,
            y: y - 60,
            alpha: 0,
            duration: 1000,
            ease: "Quad.easeOut",
            onComplete: () => t.destroy(),
        });
    }
}
