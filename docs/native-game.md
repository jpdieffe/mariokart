# Native implementation

Original headerless USA ROM: 524,288 bytes, SHA-256 `2ada8919688087be60a6a48cace8f877add60c45d2e5d09e2442faa55be62a49`. The original ZIP is unchanged. `scripts/build-game.py` constructs runtime copies and five verified quick-start snapshots. The emulator is pinned to EmulatorJS 4.2.3 / Snes9x; do not swap core versions without regenerating and verifying snapshots and the memory locator.

## Multiplayer and presentation

The host owns the single native simulation. PeerJS signaling establishes a WebRTC data connection for bounded controller inputs and a media connection carrying the native canvas and captured Web Audio. The guest does not run a second emulator. Disconnects release inputs; reconnecting preserves the host's game. Audio activation never gates establishment of the media connection.

Each original player has an independent native camera. Your view CSS-crops the host's top half or guest's bottom half, while the full frame continues through WebRTC. Menus automatically show the full frame. No copy of the transient WebGL drawing buffer is used for local presentation.

## Battle extension

`native-memory.js` locates live WRAM by comparing a native serialized state against the emulator heap; it refuses ambiguous matches. The controller uses mode `$2C`, phase `$36`, substate `$3A`, logic frame `$38`, and racer structures `$1000 + n*$100`. Original mode 6 is battle, active battle phase is `$0E`, and substate 6 is active play.

Four native bots occupy `$1400`, `$1500`, `$1600`, `$1700`. `$1200/$1300` remain reserved because native player-two balloons borrow those areas. The original GP item pool at `$1A00/$1A80/$1B00/$1B80` avoids the battle pool's overlapping racer memory. This limits simultaneously active item objects to four. Native render lists and sprite caches are initialized for both original cameras. Eliminated actors are unlinked from both render lists.

Three small 65816 hooks are assembled by `scripts/battle_patch.py` into verified unused ROM bytes `$92F2..$93F1`:

- The call at file `$AD62` uses the supplied bot heading and original item spawn routine in battle. Other modes jump to the original route routine.
- The call at `$1BE44` counts human damage before the original two-player round ending, only when the extended-battle marker `$10F2=B07B` is set. The controller pops native human balloons and resolves six-racer/team victory.

The host controller routes empty bots to available native item blocks, detects a grounded footprint pickup, consumes the whole 2x2 tile block, and grants one banana/green-shell/red-shell inventory item. Armed bots pursue opponents. A native spawn request at racer +F0 carries object ID + 1 and consumes that inventory; cooldown alone never grants ammunition. The original four-object pool recycles its oldest object when full, so persistent bananas do not block later throws. Damage comes from native collision flags. Each kart starts with three hits and a short damage cooldown. Teams affect targeting and victory, while native friendly fire stays on. Bot health is shown above the game; extra native bot balloon sprites are not allocated. Original movement, weapons, graphics, audio, and collisions remain in the ROM.

A clean native snapshot must be restored before resetting the controller. Loading pauses the emulator and suspends bot ticks to prevent linking duplicate actors. Match completion pauses native play until rematch or a new race. GP team scoring sums original points at racer offset `$F0`; it does not change the original podium.

## Item-block respawn

`items.js` tracks the original 2x2 item tile groups during active races and battles. Depleted blocks need 300 consecutive native gameplay frames with every active racer more than 32 world units away on at least one axis. A nearby human or CPU resets that timer, including an airborne kart; eliminated racers do not count. Pausing does not advance it. Empty bots leave spent pickups instead of camping them.

The third ROM hook replaces the NMI tile writer at `$1B7D7` with code at `$9360`. It reads all four actual WRAM map bytes for the existing `$1E20` update queue, rather than always drawing the hard-coded spent-item pattern. This keeps original collision and visible Mode-7 graphics in sync for consumption and restoration. The original single-tile coin update branch is preserved. The controller defers to any already pending native update. The patch runs in all runtime ROM variants; the supplied source ZIP remains unchanged.

Browser tests cover original human pickup, camping longer than the respawn delay, leaving the area, visible VRAM restoration, collecting the same block again, bots earning/spending items, and no refill when pickup opportunities are removed.

## Arenas and snapshots

Track pointer table `$1EB5B` contains 24 HiROM pointers. Battle Course 1 is ID 22, with double-LZ5 map data at `$6F338`. A map is 128 × 128 tile bytes; tiles span eight world units. Grand Courtyard compresses to 443 bytes and Jump Junction to 523, both within the original 647-byte slot. No ROM expansion is required.

The generator checks both compression stages, connected driving terrain, both spawns, all new item blocks, and closed boundaries. It preserves original collision types for walls, clay, item blocks, and jump bars. Source snapshot WRAM at `$7F0000` and Mode-7 VRAM low bytes must agree before both map copies are replaced. CPU, DSP, sound, and other state remain from the verified original two-player battle. The Grand Prix state was captured after original two-player initialization for Mario/Luigi, 50cc Mushroom Cup.

Validation includes native jump height rising and landing, collision against outer walls, item pickup changing the original tile and awarding an item, restored snapshots in fresh browsers, actual green-shell damage, natural bot-team victory, human-team victory, rematches, original GP with eight racers, simultaneous touch steering/gas, guest controller input, video/audio, reconnects, and mobile audio activation. Team victory injection in the automated test is identified as such; collected-item damage is checked before forcing the final hits for each team outcome.

## Raised Courtyard

This is the original ROM simulation with native floor/projection hooks and an additional terrain compositor, not the withdrawn standalone Sky Plaza simulation. The original game still runs kart acceleration, steering, drift, gravity, item spawning/movement, collisions, sprites, and sound. The compositor replaces only flat BG1 with raised surfaces textured from live native VRAM and the original palette. No replacement kart models, artwork, or JavaScript driving simulation are used.

The arena is a heightfield within the original 1024 x 1024 world: ground 0, terrace 32, upper platform 56. Four ramps rise to the terrace and a fifth connects to the upper platform. Solid sides and native wall tiles protect the floor boundaries. There are no overhanging roads or tunnels. `terrain-geometry.js`, `terrain-hooks.asm`, the map generator, and the compositor geometry must agree.

The elevation marker is `$10F4=52A9`, enabled only for active Battle Course 1 in the terraces ROM. Other modes return zero floor height. The movement hook at file `$8783` calls both original position/map routines through a trampoline at `$93C0`. Small grounded floor changes follow ramps. Large upward steps restore the previous position; drops convert the floor difference into native jump height. Original gravity and landing then execute. Native camera projection `$ACCC` and ground/air object projection `$C789/$C7E4/$C82B/$E557` add the floor height to DSP-1 vertical coordinates. Collision guards at `$1979D/$197E1/$1982A` reject partners whose floors differ by more than four units and otherwise replay the original distance checks. Original airborne collision rules continue to apply; this does not introduce midair collision physics between separate floors.

During a cliff drop, human racer field `+F6` (unused race timing storage in battle) records the pre-drop jump offset; `FFFF` means normal floor tracking. The camera carries the lost floor height through the native fall instead of snapping down inside the platform. Landing releases the offset. Hooks at `$C92C/$C957` apply the same lift to the original own-driver sprite's fixed screen anchor, preserving its visibility without changing physics or its projection in the other player's camera. Normal hops and other modes retain the original drawing behavior.

Native shells follow the original tile collision map and project onto the current floor, including slopes. Guardrails block side entry into raised areas. Ground shells follow the surface; this is not a new ballistic projectile simulation. Bots plan routes across adjacent floor heights and retain their firing direction long enough for the original multi-frame throw to initialize before seeking another item.

`native-terrain.js` obtains the original camera parameters and live palette/tile pixels. It renders both cameras at the native 256 x 224 resolution, then combines the original sprite output using a keyed backdrop and actor-depth masks. The heightfield mesh includes only exposed surfaces: no buried end caps where ramps meet platforms, and no interior backfaces blocking the camera. Sprite masks use the ROM's final screen coordinates, including DSP rounding and jump adjustment. Player two's render-list head is `$BC` (sentinel `$B4` plus link offset 8); `$B4` itself is the renderer's current actor and must not be used as the head. Masks remain actor bounds, not per-sprite-pixel depth; they do not replace the ROM's sprite renderer. Foreground capture happens inside the emulator's WebGL present call, respecting its actual viewport to remove host-size-dependent letterboxing. The host streams this combined canvas plus original Web Audio. Menus and other courses restore BG1 and the original palette. Changing races preserves the same display/capture canvas. The renderer requires WebGL with fragment-depth support and fails visibly if unavailable.

Native code occupies verified unused ROM ranges `$21E13..$21FFF` and `$7602B..$76300`, plus the small trampoline. `terrain_patch.py` verifies every overwritten byte and the normalized assembly source hash, then applies the checked assembled blocks and regenerates the checksum. The normal build needs only Python. To edit the assembly, install Asar 1.71 separately and run:

```sh
python scripts/assemble-terrain.py --assembler /path/to/asar
python scripts/build-game.py
```

The assembly helper rejects writes outside explicit hook/free-space ranges. Regression tests verify that all three conditional collision branches resolve to the original RTS paths (Asar treats bare numeric branch operands as displacements). Original/courtyard/junction ROMs and states remain byte-identical to the preceding release.

`test:terraces` drives all five ramps using native gas input, checks upper-floor contact, solid-side blocking, native drop/landing, independent player control, bot navigation from ground level to an upper item, original weapon damage, human pickup, anti-camping respawn, and return to eight-racer Grand Prix. The visual regression checks both players firing on ground, upper floor and ramp, plus off-center shells seen by the other player. It compares consecutive native shell pixels with the composite and verifies prompt spawn/motion. Both cliff cameras must maintain height at the edge, keep the native driver visible, and release the camera offset on landing. Weapon tests explicitly position participants and choose a green shell to exercise native spawning/movement/collision deterministically. Network testing covers phone-sized hosting, two-player native input, combined video/audio, per-driver views, capacity and reconnect. Chrome and phone-sized WebKit were tested; this does not certify every physical phone/GPU.

## Research references

- [Yoshifanatic1's public Super Mario Kart disassembly](https://github.com/Yoshifanatic1/Super-Mario-Kart-Disassembly), commit `f5c5c21f263172f20936893fa339ae0819094954`, GPL-3.0. Used to understand native routines; no leaked Nintendo source was used.
- [Epic Racers / Stifu ROM documentation](https://epicedit.stifu.fr/smk_doc/).
- [smkdan's Super Mario Kart notes](https://smkdan.eludevisibility.org/smk.html), LZ5 and course structures.
- [Epic Edit](https://github.com/thomasgoldstein/epicedit), commit `334f0583aaebad8589d7a66c821bb7edb4181885`, GPL-3.0, consulted for format and collision definitions. Its source is not copied into the runtime.
- [Snes9x snapshot implementation](https://github.com/snes9xgit/snes9x/blob/master/snapshot.cpp).
