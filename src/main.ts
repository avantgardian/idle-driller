import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: [BootScene, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
});
