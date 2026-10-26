"""Generate an optional native-ROM battle arena; retain original ROM unchanged.

SMK LZ5 format and ROM offsets are documented by smkdan and Epic Racers:
https://smkdan.eludevisibility.org/smk.html
https://epicedit.stifu.fr/smk_doc/
This implements that format directly, without copying the editor's code.
"""
from smk_maps import ROM,HERE,TABLE,dec,mapdata,genres,ptr
from pathlib import Path
import hashlib,json,collections,sys

def encode(data):
    data=bytes(data);out=bytearray();seen=collections.defaultdict(list);i=0;literal=bytearray()
    def header(op,n):
        assert 1<=n<=1024
        n-=1
        return bytes([(op<<5)|n]) if n<32 else bytes([0xe0|(op<<2)|(n>>8),n&255])
    def flush():
        if literal:out.extend(header(0,len(literal)));out.extend(literal);literal.clear()
    def record(start,end):
        for at in range(start,end):
            k=data[at:at+3]
            if len(k)==3:
                seen[k].append(at)
                if len(seen[k])>64:del seen[k][0]
    while i<len(data):
        maximum=min(1024,len(data)-i)
        run=1
        while run<maximum and data[i+run]==data[i]:run+=1
        best=0;source=0
        if run<maximum:
            for at in reversed(seen[data[i:i+3]]):
                n=3
                while n<maximum and data[at+n]==data[i+n]:n+=1
                if n>best:best=n;source=at
                if best==maximum:break
        if run>=3 and run>=best-1:
            flush();out.extend(header(1,run));out.append(data[i]);n=run
        elif best>=4:
            flush();out.extend(header(4,best));out.extend(source.to_bytes(2,'little'));n=best
        else:
            literal.append(data[i]);n=1
            if len(literal)==1024:flush()
        record(i,i+n);i+=n
    flush();out.append(255)
    assert dec(out)[0]==data
    return bytes(out)

def arena(variant='courtyard'):
    # Battle Course 1 uses Donut Plains: 00 grass, 01 clay, F0..F3 walls.
    m=bytearray([0]*16384)
    def tile(x,y,v):m[y*128+x]=v
    def fill(x,y,w,h,v):
        for yy in range(y,y+h):
            for xx in range(x,x+w):tile(xx,yy,v)
    def walls(x,y,w,h):
        for yy in range(y,y+h):
            for xx in range(x,x+w):tile(xx,yy,0xf0+((yy&1)*2)+(xx&1))
    def item(x,y):
        for yy in range(2):
            for xx in range(2):tile(x+xx,y+yy,0xc0+yy*2+xx)
    def horizontal_jump(x,y,width=9):
        for dx in range(width):tile(x+dx,y,0xf4 if dx==0 else 0xf6 if dx==width-1 else 0xf5)
    def vertical_jump(x,y,height=9):
        for dy in range(height):tile(x,y+dy,0xf7 if dy==0 else 0xf9 if dy==height-1 else 0xf8)
    fill(4,4,120,120,1)
    walls(4,4,120,2);walls(4,122,120,2);walls(4,6,2,116);walls(122,6,2,116)
    if variant=='courtyard':
        # Four cover islands, each with several routes around it. Center stays
        # open around unchanged native spawns (512,392) and (512,632).
        for x,y in [(24,24),(86,24),(24,86),(86,86)]:
            walls(x,y,18,18)
            fill(x+2,y+2,14,14,0)
        for x,y,w,h in [(54,22,20,4),(54,102,20,4),(22,54,4,20),(102,54,4,20)]:walls(x,y,w,h)
    elif variant=='junction':
        # Four rotated L-shaped walls shape different pursuit/escape routes.
        for x,y,w,h in [(24,24,34,4),(24,28,4,24),(76,24,4,34),(80,24,24,4),(70,100,34,4),(100,76,4,24),(24,70,4,34),(28,100,24,4),(50,58,4,12),(74,58,4,12)]:walls(x,y,w,h)
        # Road markings are native grass patches with no invented surface type.
        for x,y in [(38,38),(86,38),(38,86),(86,86)]:fill(x,y,4,4,0)
    else:raise ValueError('Unknown arena: '+variant)
    # Native jump bars remain traversable; jumping is the original physics.
    for x,y in [(59,35),(59,92),(14,63),(105,63)]:horizontal_jump(x,y)
    for x,y in [(35,59),(92,59)]:vertical_jump(x,y)
    for x,y in [(14,14),(62,14),(112,14),(14,112),(62,112),(112,112),(14,44),(112,44),(14,82),(112,82),(44,62),(82,62),(62,62)]:item(x,y)
    return bytes(m)

def verify(m):
    g=genres(2)
    assert len(m)==16384
    # Verify walkability on tile grid and reachability of all item clusters.
    start=(64,49);q=collections.deque([start]);seen={start}
    while q:
        x,y=q.popleft()
        for xx,yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if not(0<=xx<128 and 0<=yy<128) or (xx,yy) in seen or g[m[yy*128+xx]]>=128:continue
            seen.add((xx,yy));q.append((xx,yy))
    assert (64,79) in seen
    assert all((i%128,i//128) in seen for i,b in enumerate(m) if 0xc0<=b<=0xc3)
    assert not any(x in(0,127) or y in(0,127) for x,y in seen)
    return {'reachableTiles':len(seen),'itemTiles':sum(0xc0<=b<=0xc3 for b in m),'jumpTiles':sum(0xf4<=b<=0xf9 for b in m),'originalClayTiles':mapdata(22).count(1),'newClayTiles':m.count(1)}

def build(destination=None,variant='courtyard'):
    expected='2ada8919688087be60a6a48cace8f877add60c45d2e5d09e2442faa55be62a49'
    assert hashlib.sha256(ROM).hexdigest()==expected
    slug='grand-courtyard' if variant=='courtyard' else 'jump-junction'
    name='Grand Courtyard' if variant=='courtyard' else 'Jump Junction'
    m=arena(variant);checks=verify(m)
    first=encode(m);packed=encode(first)
    assert len(first)<0x4000 # Native first-stage decode scratch is $7FC000.
    assert dec(dec(packed)[0])[0]==m
    # The deliberately simple arena compresses below the original slot size,
    # so no expansion, address/code patches, or DSP mapping changes are needed.
    patched=bytearray(ROM)
    offset=ptr(TABLE+22*3);available=dec(ROM,offset)[1]-offset
    assert len(packed)<=available,(len(packed),available)
    patched[offset:offset+len(packed)]=packed
    patched[0xffdc:0xffe0]=b'\0\0\0\0'
    checksum=(sum(patched)+510)&65535
    patched[0xffdc:0xffe0]=(checksum^65535).to_bytes(2,'little')+checksum.to_bytes(2,'little')
    assert sum(patched)&65535==checksum
    destination=Path(destination) if destination else HERE/(slug+'.sfc');destination.write_bytes(patched)
    (HERE/(slug+'.map')).write_bytes(m)
    report={'name':name,'replaces':'Battle Course 1','trackId':22,'dimensions':{'tiles':128,'world':1024},'originalSha256':expected,'patchedSha256':hashlib.sha256(patched).hexdigest(),'firstCompressedBytes':len(first),'doubleCompressedBytes':len(packed),'originalSlotBytes':available,'romOffset':offset,**checks}
    (HERE/(slug+'.json')).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2));return m

if __name__=='__main__':
    m=build(sys.argv[1] if len(sys.argv)>1 else None,sys.argv[2] if len(sys.argv)>2 else 'courtyard')
