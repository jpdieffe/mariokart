# Third-party notices

- Super Mario Kart ROM, graphics, music, and native launch snapshots: Nintendo. The supplied original archive is preserved; optional variants are modified copies. No ownership of original game content is claimed.
- [EmulatorJS](https://github.com/EmulatorJS/EmulatorJS), pinned 4.2.3: GPL-3.0. License at `site/vendor/emulator/LICENSE`. The vendored minified frontend has two compatibility guards: missing `MediaRecorder` does not abort optional recording format detection, and a missing OpenAL current context does not throw during startup audio checking. The game's own audio activation handler remains active.
- [EmulatorJS cores](https://github.com/EmulatorJS/cores) / [Snes9x](https://github.com/snes9xgit/snes9x): the supplied standard and legacy Snes9x WebAssembly packages accompany the pinned frontend. Snes9x license at `site/vendor/emulator/SNES9X-LICENSE`. Core source/build instructions are in the linked projects.
- [PeerJS](https://github.com/peers/peerjs), 1.5.5: MIT, `site/vendor/PEERJS-LICENSE`.
- [Playwright](https://github.com/microsoft/playwright), 1.56.1: Apache-2.0; development/test dependency only.

Native modification research and pinned references are documented in `docs/native-game.md`. Game content is not relicensed by the application code.
