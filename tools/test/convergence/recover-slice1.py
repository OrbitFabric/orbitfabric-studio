"""Recover the exact supplied Slice 1 commit, using only its archive and thin bundle.
Usage: python recover-slice1.py SOURCE.tar.gz SLICE1.bundle NEW_DIRECTORY
The missing pre-Slice-1 history is represented honestly by a shallow boundary.
"""
import hashlib, pathlib, struct, subprocess, sys, tarfile, zlib
archive,bundle,destination=map(pathlib.Path,sys.argv[1:])
HEAD='c6003da30c81be3ca9ba338af9ffbfcf0a76d46f'
TREE='c3f26a91560b98fb2fcaffc5f754884ceb1e6381'
if destination.exists():raise RuntimeError('Destination must be new')
destination.mkdir(parents=True)
with tarfile.open(archive) as tar:
 for m in tar.getmembers():
  if m.name.startswith('/') or '..' in pathlib.PurePosixPath(m.name).parts or not (m.isfile() or m.isdir()):raise RuntimeError('Unsafe archive member')
 tar.extractall(destination,filter='data')
def git(*args,data=None):return subprocess.check_output(['git','-C',str(destination),*args],input=data).decode().strip()
git('init');git('add','-f','.')
assert git('write-tree')==TREE,'Archive is not the authorized tree'
raw=bundle.read_bytes();header,pack=raw.split(b'\n\n',1)
assert HEAD.encode()+b' HEAD' in header
assert pack[:4]==b'PACK'
position=12; found=False
for _ in range(struct.unpack('>I',pack[8:12])[0]):
 c=pack[position];position+=1;kind=(c>>4)&7
 while c&128:c=pack[position];position+=1
 if kind==6:
  c=pack[position];position+=1
  while c&128:c=pack[position];position+=1
 elif kind==7:position+=20
 inflater=zlib.decompressobj();content=inflater.decompress(pack[position:]);position=len(pack)-len(inflater.unused_data)
 if kind==1 and hashlib.sha1(b'commit '+str(len(content)).encode()+b'\0'+content).hexdigest()==HEAD:
  assert content.startswith(('tree '+TREE+'\n').encode())
  assert git('hash-object','-w','-t','commit','--stdin',data=content)==HEAD
  found=True
assert found,'Exact commit not found'
(destination/'.git/shallow').write_text(HEAD+'\n')
git('update-ref','refs/heads/visual-slice-1',HEAD)
git('symbolic-ref','HEAD','refs/heads/visual-slice-1')
git('diff','--exit-code',HEAD)
git('fsck','--connectivity-only',HEAD)
print('Recovered exact HEAD',HEAD,'TREE',TREE,'with declared shallow history boundary')
