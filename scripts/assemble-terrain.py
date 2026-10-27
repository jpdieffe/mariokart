"""Regenerate checked ROM hooks using a separately installed Asar 1.71."""
from pathlib import Path
import argparse,hashlib,json,subprocess,tempfile
from smk_maps import ROM
from battle_patch import patch
p=argparse.ArgumentParser();p.add_argument('--assembler',required=True);args=p.parse_args()
here=Path(__file__).resolve().parent
base=patch(ROM)
with tempfile.TemporaryDirectory() as temp:
    target=Path(temp)/'terrain.sfc';target.write_bytes(base)
    subprocess.run([str(Path(args.assembler).resolve()),str(here/'terrain-hooks.asm'),str(target)],check=True)
    result=target.read_bytes()
ranges=[(0x8783,6),(0x93c0,7),(0xaccc,7),(0xc789,6),(0xc7e4,6),(0xc82b,5),(0xe557,6),(0x1979d,6),(0x197e1,6),(0x1982a,6),(0x21e13,493),(0x7602b,726)]
covered={i for offset,size in ranges+[(0xffdc,4)] for i in range(offset,offset+size)}
assert len(base)==len(result)
assert all(a==b or i in covered for i,(a,b) in enumerate(zip(base,result)))
data={'assembler':'Asar 1.71','sourceSha256':hashlib.sha256((here/'terrain-hooks.asm').read_bytes().replace(b'\r\n',b'\n')).hexdigest(),'blocks':[{'offset':o,'original':base[o:o+n].hex(),'code':result[o:o+n].hex()} for o,n in ranges]}
(here/'terrain-hooks.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
print('Reassembled and verified native terrain hook ranges.')
