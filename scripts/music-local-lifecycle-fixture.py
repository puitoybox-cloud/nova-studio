"""Disposable browser fixture; no real ML/backend/physical acceptance."""
import hashlib
import json
import sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tools/music-audio-pipeline'))
from local_distribution_entry import LocalEnvelopeServer

def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
helper={'version':1,'pipelineRevision':2,'protocolVersion':1,'runtimeVersion':'1','sourceDigest':'a'*64,'requirementsDigest':'b'*64,'identityModuleDigest':'c'*64,'dependencyObserverDigest':'d'*64}
config=json.dumps({'version':1,'models':[],'dependencies':[],'native':[],'assets':[]},sort_keys=True,separators=(',',':'))
manifest={'version':1,'buildRevision':'browser-fixture','helper':helper,'models':[],'dependencies':[],'architectures':['x86_64'],'assets':[{'id':'runtime-config','revision':'1','digest':hashlib.sha256(config.encode()).hexdigest(),'byteLength':len(config.encode())}]}
envelope={'manifest':manifest,'trust':{'buildRevision':manifest['buildRevision'],'manifestDigest':digest(manifest)},'runtimeConfigText':config}
binding={'buildRevision':manifest['buildRevision'],'manifestDigest':digest(manifest),'runtimeConfigDigest':hashlib.sha256(config.encode()).hexdigest(),'helperIdentityDigest':digest(helper)}
assets={'/music-studio.html':b'<!doctype html><meta charset="utf-8"><title>Disposable local lifecycle</title><link rel="icon" href="data:,"><script src="/music-studio-distribution-identity.js"></script><script src="/music-studio-audio-pipeline.js"></script>',**{'/'+name:(root/name).read_bytes() for name in ['music-studio-distribution-identity.js','music-studio-audio-pipeline.js']}}
server=LocalEnvelopeServer(assets,envelope,expected_assets={key:hashlib.sha256(value).hexdigest() for key,value in assets.items()},expected_binding=binding)
events=[];server.on_lifecycle=lambda state:events.append(state)
try:
    server.start()
    h={'format':'NOVA_LOCAL_BROWSER_HANDOFF','version':1,'origin':server.origin,'nonce':server.nonce,'session':server.session,'expiresAt':server.expires_at,**binding}
    health={'ok':True,'version':1,'pipelineRevision':2,'sourceDigest':helper['sourceDigest'],'host':'127.0.0.1','port':8766,'localOnly':True,'lifecycleSession':server.session,'runtimeIdentity':{**helper,'architecture':'x86_64','modelInventory':{'status':'VERIFIED','entries':[]},'dependencyInventory':{'status':'VERIFIED','entries':[]},'actualInventory':{'inventoryVersion':2,'mode':'STRICT','status':'VERIFIED','artifactClosure':'VERIFIED','complete':True,'processingEligible':True,'architecture':'x86_64','models':[],'dependencies':[],'native':[],'assets':manifest['assets']}}}
    print(json.dumps({'handoff':h,'health':health}),flush=True)
    sys.stdin.readline()
finally:
    server.close()
