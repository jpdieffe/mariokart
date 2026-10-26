"""Reproduce optional native-ROM extensions and battle launch states."""
from pathlib import Path
import hashlib,json
from smk_maps import ROM,ROOT,HERE
from build_arena import build
from battle_patch import patch

expected='2ada8919688087be60a6a48cace8f877add60c45d2e5d09e2442faa55be62a49'
assert hashlib.sha256(ROM).hexdigest()==expected
source=(ROOT/'site/levels/battle-original.state').read_bytes()
ram=source.index(b'RAM:131072:')+11
vram=source.index(b'VRA:065536:')+11
assert int.from_bytes(source[ram+0x124:ram+0x126],'little')==22
assert source[ram+65536:ram+81920]==source[vram:vram+32768:2]
report={'originalRomSha256':expected,'variants':[]}
for variant in ['original','courtyard','junction']:
    if variant=='original':rom=ROM
    else:
        path=HERE/(variant+'.sfc')
        native_map=build(path,variant)
        rom=path.read_bytes()
        state=bytearray(source)
        state[ram+65536:ram+81920]=native_map
        state[vram:vram+32768:2]=native_map
        (ROOT/f'site/levels/battle-{variant}.state').write_bytes(state)
    modified=patch(rom)
    path=ROOT/f'site/roms/enhanced-{variant}.sfc'
    path.write_bytes(modified)
    report['variants'].append({'id':variant,'path':str(path.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(modified).hexdigest()})
report['states']=[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((ROOT/'site/levels').glob('*.state')) if p.name!='title.state']
(ROOT/'site/game-manifest.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('Built 3 optional ROM variants and verified battle snapshots.')
