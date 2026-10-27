# Game preservation requirement

The user requires the original Super Mario Kart ROM to remain the game engine,
preserving its driving mechanics, graphics, weapons, and audio. Extend the native
game; do not substitute a standalone kart game, new physics, or replacement kart
models. The separate Sky Plaza JavaScript/Three.js game was rejected and withdrawn.
Its old URL redirects to the ROM-backed game. Do not reintroduce it as a solution.

Raised Courtyard extends the native ROM with floor contact, DSP-1 projection,
and collision hooks. Its compositor draws elevated terrain using original live
VRAM tiles/palette and preserves the native sprite output. It is not a separate
kart simulation. Keep terrain-geometry.js, terrain-hooks.asm, map layout, and
compositor geometry consistent. Reassemble changed ASM using assemble-terrain.py,
then build-game.py. Run test:terraces plus relevant network/browser regressions.
Grand Courtyard and Junction remain flat layouts with native jump bars.
