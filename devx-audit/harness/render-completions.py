"""Render honest typeahead previews from capture-completions.cjs output (Pillow)."""
import json
import os
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'evidence/editor-completions'
DATA = json.loads((OUT / 'completions.json').read_text())
SCALE = 2
UI = os.environ.get('PREVIEW_UI_FONT', '/System/Library/Fonts/Supplemental/Arial.ttf')
BOLD = os.environ.get('PREVIEW_BOLD_FONT', '/System/Library/Fonts/Supplemental/Arial Bold.ttf')
MONO = os.environ.get('PREVIEW_MONO_FONT', '/System/Library/Fonts/Menlo.ttc')
INK, MUTED, GREEN = '#e5edf5', '#a5b5c8', '#74dfba'

def font(size, mono=False, bold=False):
    return ImageFont.truetype(MONO if mono else BOLD if bold else UI, size * SCALE)

def render(c):
    im = Image.new('RGB', (1320*SCALE, 800*SCALE), '#101822')
    d = ImageDraw.Draw(im)
    def text(x, y, s, size=20, color=INK, mono=False, bold=False):
        d.text((x*SCALE,y*SCALE), s, font=font(size,mono,bold), fill=color)
    def box(bounds, fill, outline=None, radius=8):
        d.rounded_rectangle(tuple(int(v*SCALE) for v in bounds), radius=radius*SCALE, fill=fill, outline=outline, width=SCALE)
    def width(s,size=20,mono=False,bold=False):
        return d.textlength(s,font=font(size,mono,bold))/SCALE
    def wrap(s, max_width, size=20, mono=False):
        lines=[]
        for para in s.split('\n'):
            line=''
            for word in para.split():
                if line and width(line+' '+word,size,mono)>max_width:
                    lines.append(line); line=word
                else: line=(line+' '+word).strip()
            lines.append(line)
        return lines
    def code(x,y,line):
        pattern=r"'(?:\\.|[^'\\])*'|\b(?:const|new|await)\b|\b\d+\b"
        pos=0
        for m in re.finditer(pattern,line):
            prefix=line[pos:m.start()]
            text(x,y,prefix,20,mono=True);x+=width(prefix,20,True)
            token=m.group()
            text(x,y,token,20,color='#cba9ee' if token in ['const','new','await'] else '#a4d99c',mono=True)
            x+=width(token,20,True);pos=m.end()
        text(x,y,line[pos:],20,mono=True)
    text(40,28,'XRPL.JS  /  TYPEAHEAD',15,GREEN,bold=True)
    box((1002,22,1280,56),'#223947')
    text(1018,31,'RENDERED COMPLETION PREVIEW',12,'#bbd7e9',bold=True)
    text(40,66,c['title'],32,bold=True)
    text(40,111,c['subtitle'],19,MUTED)
    box((36,158,1284,740),'#192330','#3b4b5e',12)
    box((53,171,79,196),'#397bbb',radius=4)
    text(57,175,'TS',12,'#ffffff',bold=True)
    text(92,174,'client.ts',16,MUTED)
    text(1090,175,'aha SDK prototype',15,GREEN)
    d.line((36*SCALE,208*SCALE,1284*SCALE,208*SCALE),fill='#344357',width=SCALE)
    focus_start=c['source'].index('const client =')
    display=c['source'][focus_start:]
    cursor=c['cursorOffset']-focus_start
    lines=display.splitlines()
    current_line=display[:cursor].count('\n')
    current_col=len(display[:cursor].split('\n')[-1])
    for i,line in enumerate(lines):
        y=228+i*31
        text(57,y,str(i+1),16,'#75889f',mono=True)
        code(98,y,line)
    caret_x=98+width(lines[current_line][:current_col],20,True)
    caret_y=228+current_line*31
    d.line((int(caret_x*SCALE),int(caret_y*SCALE),int(caret_x*SCALE),int((caret_y+24)*SCALE)),fill=GREEN,width=2*SCALE)
    entries=c['entries']; selected=next(i for i,e in enumerate(entries) if e['name']==c['selected'])
    start=max(0,min(selected-3,len(entries)-10)); shown=entries[start:start+10]
    top=caret_y+33; left=98; menu_width=486
    bottom=top+len(shown)*31+46
    box((left+5,top+6,left+menu_width+5,bottom+6),'#111822',radius=6)
    box((left,top,left+menu_width,bottom),'#263446','#50617a',6)
    for i,entry in enumerate(shown):
        row=top+6+i*31
        if entry['name']==c['selected']:
            box((left+4,row-1,left+menu_width-5,row+30),'#315e81',radius=3)
        text(left+14,row+4,'m' if entry['kind']=='method' else 'p',15,'#c8a5ec',mono=True)
        text(left+42,row+2,entry['name'],19,mono=True)
        if c['id']=='payment-fields':
            optional='optional' in entry['modifiers']
            label='optional' if optional else 'required'
            text(left+menu_width-86,row+6,label,12,MUTED if optional else GREEN)
    count=f'{len(entries)} completions' if len(entries)==len(shown) else f'{start+1}–{start+len(shown)} of {len(entries)} completions'
    text(left+14,bottom-28,count,14,MUTED)
    dl=604; dr=1260; dy=top
    doc=' '.join(c['selectedDetails']['documentation'].split())
    # Show an explicitly labeled excerpt if raw JSDoc link markup follows the prose.
    doc=doc.split(' Returns an {@link')[0]
    doc_lines=wrap(doc,dr-dl-40,20)
    sig=c['selectedDetails']['signature'] if c['id'] in ['payment-fields','builder-actions'] else ''
    sig_lines=wrap(sig,dr-dl-40,16,True) if sig else []
    height=89+len(doc_lines)*28+(len(sig_lines)*24+42 if sig else 0)
    box((dl,dy,dr,dy+height),'#223042','#50617a',6)
    text(dl+20,dy+16,c['selected'],24,GREEN,mono=True)
    text(dl+20,dy+52,'INLINE DOCUMENTATION · EXCERPT',12,MUTED,bold=True)
    yy=dy+80
    for line in doc_lines:
        text(dl+20,yy,line,20);yy+=28
    if sig:
        yy+=13
        text(dl+20,yy,'TYPE FROM DECLARATION',12,MUTED,bold=True);yy+=25
        for line in sig_lines:
            text(dl+20,yy,line,16,'#bad1ef',mono=True);yy+=24
    assert max(bottom,dy+height)<731,(c['id'],bottom,dy+height)
    text(40,763,f"TypeScript {DATA['typescript']} · Actual completion entries and documentation · Rendered UI, not an editor screenshot",15,MUTED)
    im.save(OUT/f"{c['id']}.png",optimize=True)

for case in DATA['results']:
    render(case)
    print(OUT/f"{case['id']}.png")
