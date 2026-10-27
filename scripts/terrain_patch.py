"""Apply checked 65816 hooks, assembled from terrain-hooks.asm with Asar 1.71.

The source and every original byte are verified before applying the patch. To
regenerate the byte blocks, assemble the source against enhanced-original.sfc
and compare the explicit ranges in terrain-hooks.json. No commercial source or
replacement gameplay implementation is used.
"""
from pathlib import Path
import hashlib,json

def patch_terrain(source):
    here=Path(__file__).resolve().parent
    hooks=json.loads((here/'terrain-hooks.json').read_text())
    asm=(here/'terrain-hooks.asm').read_bytes().replace(b'\r\n',b'\n')
    assert hashlib.sha256(asm).hexdigest()==hooks['sourceSha256'], 'Reassemble changed terrain hooks'
    rom=bytearray(source)
    for block in hooks['blocks']:
        offset=block['offset'];old=bytes.fromhex(block['original']);code=bytes.fromhex(block['code'])
        assert len(old)==len(code)
        assert rom[offset:offset+len(old)]==old, f'Unexpected original bytes at {offset:X}'
        rom[offset:offset+len(code)]=code
    rom[0xffdc:0xffe0]=bytes.fromhex('ffff0000');checksum=sum(rom)&65535
    rom[0xffdc:0xffe0]=(checksum^65535).to_bytes(2,'little')+checksum.to_bytes(2,'little')
    assert sum(rom)&65535==checksum
    return bytes(rom)
