import json, numpy as np
from PIL import Image
from scipy import ndimage
a=np.asarray(Image.open('map_blank.png').convert('RGB')).astype(int)
b=np.asarray(Image.open('map_pois.png').convert('RGB')).astype(int)
diff=(np.abs(a-b).sum(axis=2)>60)
diff=ndimage.binary_dilation(diff,iterations=14)
lab,n=ndimage.label(diff)
blobs=[]
for i,sl in enumerate(ndimage.find_objects(lab)):
    ys,xs=sl; blobs.append(((xs.start+xs.stop)/2,(ys.start+ys.stop)/2,xs.stop-xs.start,ys.stop-ys.start))
print(n,'label blobs')
pois=json.load(open('map.json',encoding='utf-8'))['data']['pois']
named=[p for p in pois if 'POI.Generic' in p['id']]
# seed transform from eyeballed labels, then match nearest blob and refit
s=0.004510*2048/1400; ox=668.4*2048/1400; oy=695.2*2048/1400
for it in range(3):
    pairs=[]
    for p in named:
        px=s*p['location']['x']+ox; py=s*p['location']['y']+oy
        j=min(range(len(blobs)),key=lambda k:(blobs[k][0]-px)**2+(blobs[k][1]-py)**2)
        d=((blobs[j][0]-px)**2+(blobs[j][1]-py)**2)**.5
        if d<60: pairs.append((p,blobs[j],d))
    X=np.array([[p['location']['x'],1,0] for p,_,_ in pairs]+[[p['location']['y'],0,1] for p,_,_ in pairs])
    Y=np.array([bl[0] for _,bl,_ in pairs]+[bl[1] for _,bl,_ in pairs])
    (s,ox,oy),res,_,_=np.linalg.lstsq(X,Y,rcond=None)
for p,bl,d in pairs:
    px=s*p['location']['x']+ox; py=s*p['location']['y']+oy
    print(f"{p['name']:20s} resid {bl[0]-px:6.1f} {bl[1]-py:6.1f}")
print('scale px/uu',s,'ox',ox,'oy',oy,'pairs',len(pairs))
json.dump({'imageSize':2048,'pxPerUu':s,'offsetX':ox,'offsetY':oy,'formula':'px = worldX*pxPerUu+offsetX; py = worldY*pxPerUu+offsetY','pois':[{'name':p['name'],'id':p['id'],'x':p['location']['x'],'y':p['location']['y']} for p in pois]},open('calibration.json','w'),indent=1)
