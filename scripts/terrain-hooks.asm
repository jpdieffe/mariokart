hirom
; Opt-in projection extension. Native movement, drift, sprites and audio remain.
; Marker is a battle-unused human racer field, restored with native snapshots.
org $C21E13
height:
  lda.l $7E10F4
  cmp.w #$52A9
  beq .enabled
  lda.w #$0000
  rtl
.enabled
  lda.l $7E0018,x
  cmp.w #384
  bcc .west
  cmp.w #640
  bcs .east
  lda.l $7E001C,x
  cmp.w #384
  bcc .north
  cmp.w #640
  bcc .inside
  jmp .south
.inside
  lda.l $7E0018,x
  cmp.w #448
  bcc .terrace
  cmp.w #576
  bcs .terrace
  lda.l $7E001C,x
  cmp.w #480
  bcc .sky
  cmp.w #576
  bcs .terrace
  lda.l $7E0018,x
  cmp.w #464
  bcc .terrace
  cmp.w #560
  bcs .terrace
  lda.w #704
  sec
  sbc.l $7E001C,x
  lsr
  lsr
  rtl
.sky
  lda.w #56
  rtl
.terrace
  lda.w #32
  rtl
.west
  cmp.w #128
  bcc .zero
  lda.l $7E001C,x
  cmp.w #480
  bcc .zero
  cmp.w #576
  bcs .zero
  lda.l $7E0018,x
  sec
  sbc.w #128
  bra .divide
.east
  cmp.w #896
  bcs .zero
  lda.l $7E001C,x
  cmp.w #480
  bcc .zero
  cmp.w #576
  bcs .zero
  lda.w #896
  sec
  sbc.l $7E0018,x
  bra .divide
.north
  cmp.w #128
  bcc .zero
  lda.l $7E0018,x
  cmp.w #544
  bcc .zero
  lda.l $7E001C,x
  sec
  sbc.w #128
  bra .divide
.south
  cmp.w #896
  bcs .zero
  lda.l $7E0018,x
  cmp.w #544
  bcc .zero
  lda.w #896
  sec
  sbc.l $7E001C,x
.divide
  lsr
  lsr
  lsr
  rtl
.zero
  lda.w #0
  rtl
warnpc $C22000

org $C7602B
ground:
  jsl height
  asl
  asl
  sta.l $006000
  rtl
air:
  pha
  jsl height
  asl
  asl
  sta $00
  pla
  clc
  adc $00
  sta.l $006000
  stz $1A
  rtl
camera:
  phx
  txa
  xba
  lsr
  clc
  adc.w #$1000
  tax
  jsl height
  asl
  asl
  pha
  lda.l $7E10F4
  cmp.w #$52A9
  bne .base
  lda.b $F6,x
  cmp.w #$FFFF
  beq .base
  lda.b $1F,x
  sec
  sbc.b $F6,x
  bcc .base
  lsr #6
  clc
  adc $01,s
  sta $01,s
.base
  pla
  sta.l $006000
  plx
  rtl
move:
  lda.w $10F4
  cmp.w #$52A9
  beq .active
  jsl nativeMove
  rtl
.active
  ; Human +F6 is race timing storage, unused in Battle Mode. FFFF means
  ; ordinary floor-following; a drop records the pre-drop jump offset.
  cpx.w #$1200
  bcs .save
  lda.b $A0,x
  bne .save
  lda.w #$FFFF
  sta.b $F6,x
.save
  lda.b $18,x
  pha
  lda.b $1C,x
  pha
  jsl height
  pha
  jsl nativeMove
  jsl height
  sta $12
  lda $01,s
  sec
  sbc $12
  bne .changed
  jmp .done
.changed
  bmi .up
  cmp.w #5
  bcs .drop
  ldy.b $A0,x
  beq .done
  bra .fall
.drop
  pha
  cpx.w #$1200
  bcs .resumeDrop
  lda.b $F6,x
  cmp.w #$FFFF
  bne .resumeDrop
  lda.b $1F,x
  sta.b $F6,x
.resumeDrop
  pla
.fall
  xba
  clc
  adc.b $1F,x
  sta.b $1F,x
  lda.w #2
  sta.b $A0,x
  lda.b $E2,x
  ora.w #$8000
  sta.b $E2,x
  bra .done
.up
  eor.w #$FFFF
  inc
  cmp.w #5
  bcs .wallCheck
  ldy.b $A0,x
  beq .done
.wallCheck
  xba
  sta $12
  lda.b $1F,x
  cmp $12
  bcs .airUp
  lda.b $A0,x
  beq .wall
  lda $12
  cmp.w #$0500
  bcs .wall
  stz.b $1F,x
  stz.b $26,x
  stz.b $A0,x
  lda.b $E2,x
  and.w #$7FFF
  sta.b $E2,x
  bra .done
.airUp
  sec
  sbc $12
  sta.b $1F,x
  bra .done
.wall
  lda $05,s
  sta.b $18,x
  sta $0A
  lda $03,s
  sta.b $1C,x
  sta $0C
  stz.b $16,x
  stz.b $1A,x
  stz.b $22,x
  stz.b $24,x
  stz.b $EA,x
.done
  pla
  pla
  pla
  rtl
guard:
  phx
  jsl height
  pha
  tyx
  jsl height
  sta $12
  pla
  plx
  sec
  sbc $12
  bpl .abs
  eor.w #$FFFF
  inc
.abs
  cmp.w #5
  bcs .blocked
  lda.w $0018,y
  sec
  sbc.b $18,x
  clc
  rtl
.blocked
  sec
  rtl
; Own-driver sprites use a fixed screen anchor, unlike projected world objects.
; Subtract the camera's fall lift from their visual jump only. Physics and the
; other camera still use the full native jump height.
jumpTop:
  cpx.b $C8
  bra jumpScreen
jumpBottom:
  cpx.b $CA
jumpScreen:
  bne .original
  lda.l $7E10F4
  cmp.w #$52A9
  bne .original
  lda.b $F6,x
  cmp.w #$FFFF
  beq .original
  lda.b $1F,x
  cmp.b $F6,x
  bcc .original
  lda.b $F6,x
  bra .store
.original
  lda.b $1F,x
.store
  sta.l $006000
  rtl
warnpc $C76301

org $8093C0
nativeMove:
  jsr $879A
  jsr $890D
  rtl
warnpc $8093F2

org $808783
  jsl move
  nop #2
org $81979D
  jsl guard
  bcs collision1Return
org $8197E0
collision1Return:
org $8197E1
  jsl guard
  bcs collision2Return
org $819829
collision2Return:
org $81982A
  jsl guard
  bcs collision3Return
org $819866
collision3Return:

org $80ACCC
  jsl camera
  nop #3
org $80C789
  jsl ground
  nop #2
org $80C7E4
  jsl ground
  nop #2
org $80C82B
  jsl air
  nop
org $80C92C
  jsl jumpTop
  nop
org $80C957
  jsl jumpBottom
  nop
org $80E557
  jsl ground
  nop #2
