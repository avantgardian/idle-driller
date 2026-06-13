import Phaser from 'phaser';
import { TILE_W, TILE_H } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.spritesheet('assembler', 'assets/assembler.png', {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet('assembler-2', 'assets/assembler-2.png', {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet('drill', 'assets/drill.png', {
      frameWidth: 167,
      frameHeight: 120,
    });
  }

  create() {
    this.anims.create({
      key: 'assembler-anim',
      frames: this.anims.generateFrameNumbers('assembler', { start: 0, end: 9 }),
      frameRate: 5,
      repeat: -1,
    });
    this.anims.create({
      key: 'assembler-2-anim',
      frames: this.anims.generateFrameNumbers('assembler-2', { start: 0, end: 9 }),
      frameRate: 5,
      repeat: -1,
    });
    this.anims.create({
      key: 'drill-anim',
      frames: this.anims.generateFrameNumbers('drill', { start: 0, end: 19 }),
      frameRate: 12,
      repeat: -1,
    });

    this.generateTextures();
    this.scene.start('GameScene');
  }

  private generateTextures() {
    this.makeGroundTile('ground', 0x4a7c59, 0x3d6b4a);
    this.makeGroundTile('ground-alt', 0x5a8f67, 0x4a7c59);

    this.makeBaseTexture();
    this.makeNodeTexture('node', 0xb54a8c);
    this.makeShadowTexture();
    this.makeSelectionRing();
    this.makeFlameTexture();
    this.makeDustTexture();
    this.makeDroneTexture();
  }

  private makeGroundTile(key: string, fill: number, stroke: number) {
    const g = this.add.graphics();
    g.fillStyle(fill);
    g.lineStyle(1, stroke, 0.4);
    g.beginPath();
    g.moveTo(TILE_W / 2, 0);
    g.lineTo(TILE_W, TILE_H / 2);
    g.lineTo(TILE_W / 2, TILE_H);
    g.lineTo(0, TILE_H / 2);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.generateTexture(key, TILE_W, TILE_H);
    g.destroy();
  }

  private makeBaseTexture() {
    const g = this.add.graphics();
    const cx = 16;

    g.fillStyle(0xdd3333);
    g.beginPath();
    g.moveTo(cx, 0);
    g.lineTo(cx + 8, 12);
    g.lineTo(cx - 8, 12);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xe0e0e0);
    g.fillRect(cx - 8, 12, 16, 30);

    g.fillStyle(0xdd3333);
    g.fillRect(cx - 8, 14, 16, 4);

    g.fillStyle(0x88ccff);
    g.fillCircle(cx, 24, 4);
    g.fillStyle(0x4488cc);
    g.fillCircle(cx, 24, 3);
    g.fillStyle(0xaaeeff);
    g.fillCircle(cx - 1, 22, 1.5);

    g.fillStyle(0xcc2222);
    g.beginPath();
    g.moveTo(cx - 8, 32);
    g.lineTo(cx - 14, 46);
    g.lineTo(cx - 8, 44);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(cx + 8, 32);
    g.lineTo(cx + 14, 46);
    g.lineTo(cx + 8, 44);
    g.closePath();
    g.fillPath();

    g.fillStyle(0x777777);
    g.fillRect(cx - 4, 42, 8, 8);
    g.fillStyle(0x555555);
    g.fillRect(cx - 4, 42, 8, 3);

    g.generateTexture('base', 30, 52);
    g.destroy();
  }

  private makeNodeTexture(key: string, color: number) {
    const s = 32;
    const g = this.add.graphics();
    const lighter = Phaser.Display.Color.ValueToColor(color).lighten(30).color;
    const darker = Phaser.Display.Color.ValueToColor(color).darken(30).color;

    g.fillStyle(darker);
    g.beginPath();
    g.moveTo(s / 2, 0);
    g.lineTo(s, s / 2);
    g.lineTo(s / 2, s);
    g.lineTo(0, s / 2);
    g.closePath();
    g.fillPath();

    g.fillStyle(lighter);
    g.beginPath();
    g.moveTo(s / 2, 4);
    g.lineTo(s - 4, s / 2);
    g.lineTo(s / 2, s - 4);
    g.lineTo(4, s / 2);
    g.closePath();
    g.fillPath();

    g.fillStyle(color);
    g.beginPath();
    g.moveTo(s / 2, 8);
    g.lineTo(s - 8, s / 2);
    g.lineTo(s / 2, s - 8);
    g.lineTo(8, s / 2);
    g.closePath();
    g.fillPath();

    g.generateTexture(key, s, s);
    g.destroy();
  }

  private makeDroneTexture() {
    this.makeDroneBase('drone', true, 0x4488cc, 0x88ccff);
    this.makeDroneBase('drone-empty', false, 0x4488cc, 0x88ccff);
    this.makeDroneBase('drone-2', true, 0x44cc88, 0x88ffcc);
    this.makeDroneBase('drone-empty-2', false, 0x44cc88, 0x88ffcc);
  }

  private makeDroneBase(key: string, hasCargo: boolean, bodyColor: number, centerColor: number) {
    const g = this.add.graphics();
    if (hasCargo) {
      g.fillStyle(0xddaa44);
      g.fillRect(4, 12, 8, 6);
      g.lineStyle(1, 0x888888);
      g.lineBetween(8, 10, 8, 12);
    }
    g.fillStyle(bodyColor);
    g.beginPath();
    g.moveTo(8, 2);
    g.lineTo(14, 6);
    g.lineTo(8, 10);
    g.lineTo(2, 6);
    g.closePath();
    g.fillPath();
    g.fillStyle(centerColor);
    g.fillCircle(8, 6, 2);
    g.fillStyle(0xaaaaaa);
    g.fillRect(3, 0, 10, 2);
    g.generateTexture(key, 16, 20);
    g.destroy();
  }

  private makeShadowTexture() {
    const g = this.add.graphics();
    g.fillStyle(0x000000);
    g.fillEllipse(11, 4, 22, 8);
    g.generateTexture('shadow', 22, 8);
    g.destroy();
  }

  private makeSelectionRing() {
    const g = this.add.graphics();
    g.lineStyle(2, 0xffff44, 0.9);
    g.strokeCircle(16, 16, 14);
    g.lineStyle(1, 0xffffff, 0.4);
    g.strokeCircle(16, 16, 12);
    g.generateTexture('selection-ring', 32, 32);
    g.destroy();
  }

  private makeFlameTexture() {
    const g = this.add.graphics();
    g.fillStyle(0xff3300, 0.6);
    g.beginPath();
    g.moveTo(14, 0);
    g.lineTo(28, 28);
    g.lineTo(24, 40);
    g.lineTo(14, 44);
    g.lineTo(4, 40);
    g.lineTo(0, 28);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xff6600, 0.8);
    g.beginPath();
    g.moveTo(14, 2);
    g.lineTo(24, 24);
    g.lineTo(20, 36);
    g.lineTo(14, 38);
    g.lineTo(8, 36);
    g.lineTo(4, 24);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xffcc00, 0.9);
    g.beginPath();
    g.moveTo(14, 4);
    g.lineTo(20, 20);
    g.lineTo(16, 30);
    g.lineTo(14, 32);
    g.lineTo(12, 30);
    g.lineTo(8, 20);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xffee88, 1);
    g.beginPath();
    g.moveTo(14, 6);
    g.lineTo(18, 16);
    g.lineTo(16, 22);
    g.lineTo(14, 24);
    g.lineTo(12, 22);
    g.lineTo(10, 16);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xffffff, 0.9);
    g.beginPath();
    g.moveTo(14, 8);
    g.lineTo(16, 14);
    g.lineTo(14, 18);
    g.lineTo(12, 14);
    g.closePath();
    g.fillPath();

    g.generateTexture('flame', 28, 44);
    g.destroy();
  }

  private makeDustTexture() {
    const g = this.add.graphics();
    g.fillStyle(0xbbaa88, 0.6);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0xccbb99, 0.4);
    g.fillCircle(8, 8, 6);
    g.generateTexture('dust', 16, 16);
    g.destroy();
  }
}
