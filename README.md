# Super Mario Kart — Online Pit Stop

[Play on GitHub Pages](https://jpdieffe.github.io/mariokart/)

**New: [Sky Plaza — custom 3D arena](https://jpdieffe.github.io/mariokart/arena.html).** This separate game has three driving floors (ground, a 7-metre terrace, and a 14-metre sky deck), five connecting ramps, launch pads, and real falling/jumping physics. The original-ROM game remains at the main URL.

Sky Plaza supports two-player rooms with independent cameras, four bots, co-op teams or free-for-all, and three-balloon elimination. The host runs the shared simulation; both devices render their own 3D view from bounded state updates over the peer connection. Its room namespace is separate from original-game rooms; share its **Invite** link. A joining player drops in as Luigi. Reconnecting preserves the battle and remaining balloons. Keep the host tab visible.

All drivers, including bots, start empty and collect a single green shell, red shell, banana, or boost from an item box. Boxes respawn only after five uninterrupted seconds with all karts clear. Ramps and solid deck walls affect both karts and projectiles; hits cannot cross floors. Co-op has no friendly fire. Eliminated drivers spectate; the host can restart. **Arena view** shows the complete layout. Touch controls, keyboard, and standard gamepads work; phones are best sideways. This mode uses new low-poly graphics and its own handling, not the SNES renderer or original track physics.

The original SNES Super Mario Kart runs in the host's browser. A friend joins with a two-character code and controls the original second controller over WebRTC. Both drivers exist in the same original game. Android/iPhone touch controls, keyboard, gamepads, and a separate view for each device are supported.

## Play

1. Select a mode and optional battle arena, then **Host a race**.
2. Share the code or Invite link. Your friend taps **Join**.
3. In Original game, choose **2P GAME** using B/Gas. **Race menu** offers quick starts with Mario and Luigi.
4. Rotate phones sideways. Hold Gas while steering; Item uses weapons and Hop jumps/drifts. **Your view** crops to your own half of the native split screen.

Keep the host tab visible. Tap the sound button when prompted. If an Android same-Wi-Fi connection fails, check the browser's Nearby devices / Local network permission. Help includes optional PeerServer and TURN settings for networks that block direct WebRTC. Room codes identify a room; they are not passwords. No microphone or screen-sharing permission is requested.

## Modes

- **Original game:** original Grand Prix, Match Race, time trials, and two-player Balloon Battle. The supplied ROM ZIP is kept unchanged; runtime copies include the item-block respawn patch.
- **Battle with bots:** two human slots and four additional native CPU karts. Six-way elimination, three hits per kart, and a health/inventory HUD. Bots start empty and must drive over an available item block. They carry one banana, green shell, or red shell, then need another pickup after using it.
- **Co-op battle:** you and your friend versus four bots. Last surviving team wins. Friendly fire remains enabled. Bots use original movement, collisions, sprites, and shells; their targets and team rules are supplied by the host controller.
- **Co-op Grand Prix:** the original two-player Grand Prix with six CPUs. Your combined points compete against three CPU pairs. The original podium still displays individual results; team totals appear above the game.

Solo opens the same modes without a network guest; the second human slot remains available for a friend in hosted rooms. Bots occupy four CPU slots, not the second human controller. Eliminated drivers keep their last camera position; Both screens lets you watch the remaining action. The host can rematch after a battle.

Used item blocks respawn after five seconds with every active kart clear of the surrounding area. Parking on or beside a block resets that timer, including bots. Respawning applies to original courses and custom arenas.

## Larger arenas

**Grand Courtyard** and **Jump Junction** replace Battle Course 1 for that session. They provide approximately 36% and 42% more clay driving tiles, respectively, plus six native jump bars, item blocks, cover, and outer walls. They use the original 1024 × 1024 world and native jump physics. These are larger open layouts with jumps, not a new 3D engine or stacked roads. Other original courses remain available through the native menus.

## Run and verify

```sh
npm ci
npm start
# Open http://localhost:4180
npm run check
npm test
npm run build:game
npm run test:browser
npm run test:modes
npm run test:items
npm run test:network
npm run test:mobile-host
npm run test:arena
```

The native build uses Python 3's standard library. Chrome is used by the browser tests. `test:webkit` uses Playwright WebKit; `WEBKIT_EXECUTABLE` can select an installed binary. `PHONE_HOST=1` tests the network host with a phone viewport. Set `MARIOKART_URL=https://jpdieffe.github.io/mariokart/` to run network/mode checks against deployment. Phone browser emulation is not a substitute for testing every physical device.

Pushing `main` runs syntax checks, unit/build-integrity tests, and GitHub Pages deployment. Browser tests run separately because they launch actual emulation and public signaling connections.

## Original game and modifications

This preserves the supplied USA ROM, rather than recreating the game in JavaScript. Features use separate patched ROM copies and native launch snapshots. Rebuilding verifies the original SHA-256, native patch sites, compressed-map round trips, reachable spawn/item locations, and ROM checksums. `site/game-manifest.json` records the shipped variants and snapshots.

[Native implementation notes](docs/native-game.md) describe the patches, addresses, limitations, and research sources. [Third-party notices](THIRD_PARTY.md) list emulator dependencies and licenses. Nintendo retains ownership of the original game and graphics; this is an unofficial project.
