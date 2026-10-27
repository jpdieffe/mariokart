# Native implementation

Original headerless USA ROM: 524,288 bytes, SHA-256 `2ada8919688087be60a6a48cace8f877add60c45d2e5d09e2442faa55be62a49`. The original ZIP is unchanged. `scripts/build-game.py` constructs runtime copies and four verified quick-start snapshots. The emulator is pinned to EmulatorJS 4.2.3 / Snes9x; do not swap core versions without regenerating and verifying snapshots and the memory locator.

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

## Raised terrain: outstanding native work

The original-ROM engine, mechanics, graphics, and audio are required. The separate JavaScript/Three.js Sky Plaza simulation did not meet that requirement and has been removed from the deployed game. `arena.html` only redirects to the native game; the rejected implementation remains in Git history.

Inspection of the pinned public disassembly confirms that changing a racer's jump height is not a terrain renderer. `CODE_80ACB6` supplies the original DSP-1 projection parameters, including a zero vertical coordinate at the projection origin. Native vertical movement and landing paths such as `CODE_80B21E` and `CODE_80B5EC` update/reset racer height and vertical velocity independently of the track tile map. The live racer-height word is at racer + `$20`; map bytes at `$7F0000` select ordinary 8x8 Mode-7 tiles with behavior from `$0B00`. The shipped arena generator only changes these map bytes.

These findings identify separate rendering and contact/collision changes that an actual elevation extension would need. A height-only RAM adjustment would leave the road visually flat and would not establish correct raised-floor contact or weapon interaction. It is not a completed ramp implementation. Before shipping a native elevation feature, verify one ramp and platform with the original player driving code, original artwork, both native cameras, shells, items, and CPU karts. Preserve existing flat-course behavior and only then expand to a complete arena.

## Research references

- [Yoshifanatic1's public Super Mario Kart disassembly](https://github.com/Yoshifanatic1/Super-Mario-Kart-Disassembly), commit `f5c5c21f263172f20936893fa339ae0819094954`, GPL-3.0. Used to understand native routines; no leaked Nintendo source was used.
- [Epic Racers / Stifu ROM documentation](https://epicedit.stifu.fr/smk_doc/).
- [smkdan's Super Mario Kart notes](https://smkdan.eludevisibility.org/smk.html), LZ5 and course structures.
- [Epic Edit](https://github.com/thomasgoldstein/epicedit), commit `334f0583aaebad8589d7a66c821bb7edb4181885`, GPL-3.0, consulted for format and collision definitions. Its source is not copied into the runtime.
- [Snes9x snapshot implementation](https://github.com/snes9xgit/snes9x/blob/master/snapshot.cpp).
