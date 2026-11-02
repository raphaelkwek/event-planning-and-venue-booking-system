import io
def rd(p): return io.open(p,encoding='utf-8').read()
def wr(p,s): io.open(p,'w',encoding='utf-8',newline='\n').write(s)
def sub(p,old,new,count=1):
    s=rd(p)
    if old not in s: raise SystemExit("NOT FOUND in %s: %s"%(p,old[:60]))
    wr(p,s.replace(old,new,count))
