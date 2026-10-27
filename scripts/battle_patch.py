"""Small, battle-only 65816 hooks for original USA SMK; public disassembly research.
+F0 requests a collected native item (object ID + 1) on CPUs. Human +F0 counts hits
while NativeBattle sets human +F2 to B07B. GP behavior remains original.
"""
import pathlib,zipfile,sys
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parent
class Code:
 def __init__(self): self.b=bytearray();self.labels={};self.fix=[]
 def emit(self,h):self.b.extend(bytes.fromhex(h))
 def label(self,s):self.labels[s]=len(self.b)
 def branch(self,h,label):self.emit(h);self.fix.append((len(self.b),label));self.b.append(0)
 def done(self):
  for p,label in self.fix:self.b[p]=(self.labels[label]-p-1)&255
  return self.b

def patch(source):
 rom=bytearray(source)
 assert rom[0xad62:0xad65]==bytes.fromhex('20b1b0')
 assert rom[0x1be44:0x1be48]==bytes.fromhex('a6b8b4c8')
 assert set(rom[0x92f2:0x93f2])=={255}
 # Replace original route-heading call with a battle-only route input + shell trigger.
 c=Code();c.emit('a52cc90600');c.branch('f0','battle');c.emit('4cb1b0');c.label('battle');c.emit('b5f0');c.branch('f0','heading');c.emit('da5aa5b448a5b84886b464b8b5f03aa874f0207af174666885b86885b47afa');c.label('heading');c.emit('b5fa60');code=c.done()
 assert len(code)<=0x9330-0x92f2
 rom[0x92f2:0x92f2+len(code)]=code;rom[0xad62:0xad65]=bytes.fromhex('20f292')
 # Preserve native balloons/round until the extended six-racer match is decided.
 # Replay overwritten LDX/LDY, count and clear a native damaging event before
 # original two-player balloon handling sees it. Other modes return unchanged.
 c=Code();c.emit('a6b8b4c8adf210c97bb0');c.branch('d0','done')
 c.emit('b98c00890100');c.branch('f0','done');c.emit('29feff998c00b9f0001a99f000');c.label('done');c.emit('6b')
 code=c.done();rom[0x9330:0x9330+len(code)]=code;rom[0x1be44:0x1be48]=bytes.fromhex('22309380')
 # Original NMI writer always draws spent tiles. Read the actual WRAM tiles
 # instead, so the same queue can also restore item blocks without touching
 # emulator internals. Preserve the original single-tile coin update branch.
 assert rom[0x1b7d7:0x1b7db]==bytes.fromhex('8b4babe2')
 c=Code();c.emit('8b4babe2109c1521ad201e');c.branch('f0','done');c.emit('9c201e');c.branch('30','single')
 c.emit('c2108d1621aae220bf00007f8d1821bf01007f8d1821c2208a186980008d1621e220bf80007f8d1821bf81007f8d1821c220')
 c.label('done');c.emit('c210ab6b');c.label('single');c.emit('5c11b881')
 code=c.done();assert len(code)<=0x93f2-0x9360
 rom[0x9360:0x9360+len(code)]=code;rom[0x1b7d7:0x1b7db]=bytes.fromhex('5c609380')
 rom[0xffdc:0xffe0]=bytes.fromhex('ffff0000');checksum=sum(rom)&65535
 rom[0xffdc:0xffe0]=(checksum^65535).to_bytes(2,'little')+checksum.to_bytes(2,'little')
 assert sum(rom)&65535==checksum
 return bytes(rom)
if __name__=='__main__':
 if len(sys.argv)>1: source=pathlib.Path(sys.argv[1]).read_bytes()
 else:
  with zipfile.ZipFile(ROOT/'site/roms/super-mario-kart.zip') as z:source=z.read(next(n for n in z.namelist() if n.endswith('.sfc')))
 dest=pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else HERE/'battle-bots.sfc'
 rom=patch(source);dest.write_bytes(rom)
 with zipfile.ZipFile(dest.with_suffix('.zip'),'w',zipfile.ZIP_DEFLATED) as z:z.writestr('Super Mario Kart (USA).sfc',rom)
 print('Built',dest,len(rom))
