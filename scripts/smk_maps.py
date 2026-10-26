"""Native SMK track research. LZ5 format from public smkdan/Epic Edit docs."""
from pathlib import Path
import zipfile, struct, json, collections
ROOT=Path(__file__).resolve().parents[1]
HERE=ROOT/'assets'/'course-build'
HERE.mkdir(parents=True,exist_ok=True)
ROM=zipfile.ZipFile(ROOT/'site'/'roms'/'super-mario-kart.zip').read('Super Mario Kart (USA).sfc')
def dec(src, pos=0):
    out=bytearray()
    while True:
        b=src[pos];pos+=1
        if b==255:return bytes(out),pos
        op=b>>5
        if op==7:op=(b>>2)&7;n=((b&3)<<8)|src[pos];pos+=1
        else:n=b&31
        n+=1
        if op==0:out.extend(src[pos:pos+n]);pos+=n
        elif op==1:out.extend([src[pos]]*n);pos+=1
        elif op==2:out.extend(src[pos+i%2] for i in range(n));pos+=2
        elif op==3:out.extend((src[pos]+i)&255 for i in range(n));pos+=1
        elif op in (4,5,6):
            if op==6:at=len(out)-src[pos];pos+=1
            else:at=src[pos]|src[pos+1]<<8;pos+=2
            for i in range(n):out.append(out[at+i]^(255 if op==5 else 0))
        else:raise ValueError(op)
        assert len(out)<131072
def u16(p):return int.from_bytes(ROM[p:p+2],'little')
def ptr(p):return int.from_bytes(ROM[p:p+3],'little')&0x3fffff
TABLE=ptr(0x1e749)
types=dec(ROM,0x7fdba)[0]
themes=ROM[TABLE+24*3+8*3*5+20:TABLE+24*3+8*3*5+20+24]
def genres(theme):
    p=u16(TABLE-16+theme*2)
    return types[p:p+192].ljust(192,b'\x00')+types[:64]
def mapdata(track):return dec(dec(ROM,ptr(TABLE+track*3))[0])[0]
if __name__=='__main__':
    print('TABLE',hex(TABLE),'themes',list(themes))
    for track in range(20,24):
        data=mapdata(track);assert len(data)==16384
        (HERE/f'original-{track}.map').write_bytes(data)
        genre=genres(themes[track]//2)
        print(track,hex(ptr(TABLE+track*3)),'theme',themes[track]//2,'common',collections.Counter(data).most_common(12))
        print('tiles by type', {hex(t):[hex(i) for i,g in enumerate(genre) if g==t] for t in (0x10,0x14,0x16,0x40,0x46,0x50,0x5a,0x80)})
        traversable=[(i%128,i//128) for i,b in enumerate(data) if 0x40<=genre[b]<=0x52]
        print('drive bounds',min(p[0] for p in traversable),min(p[1] for p in traversable),max(p[0] for p in traversable),max(p[1] for p in traversable))
