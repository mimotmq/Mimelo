import urllib.request,urllib.error,http.cookiejar,time,json
import tempfile,subprocess,os,sys,atexit,shutil,socket
from pathlib import Path
binary=str(Path(sys.argv[1] if len(sys.argv)>1 else './mimelo').resolve())
work=tempfile.TemporaryDirectory(prefix='mimelo-integration-')
static=Path(__file__).resolve().parents[1]/'static'
if static.exists():shutil.copytree(static,Path(work.name)/'static')
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
log=open(Path(work.name)/'server.log','w')
proc=subprocess.Popen([binary,str(port)],cwd=work.name,env={**os.environ,'MIMELO_ADMIN_PASSWORD':'TestingOnly123'},stdout=log,stderr=log)
def cleanup():
 proc.terminate()
 try:proc.wait(timeout=5)
 except subprocess.TimeoutExpired:proc.kill()
 log.close();work.cleanup()
atexit.register(cleanup)
base=f'http://127.0.0.1:{port}/api/'
for attempt in range(100):
 try:urllib.request.urlopen(base+'games');break
 except (OSError,urllib.error.URLError):time.sleep(0.05)
else:raise RuntimeError('Server did not start')
s=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(path,body=None,method=None,status=None):
 data=json.dumps(body).encode() if body is not None else None
 req=urllib.request.Request(base+path,data=data,headers={'Content-Type':'application/json'},method=method or ('POST' if body is not None else 'GET'))
 try:r=s.open(req)
 except urllib.error.HTTPError as e:r=e
 code=r.code;text=r.read().decode()
 if status:assert code==status,(path,code,text)
 else:assert code<400,(path,code,text)
 return json.loads(text)
call('login',{'username':'mimo','password':'TestingOnly123'})
ids=[call('users',{'name':n})['id'] for n in ['Mustafa','Arav','Ali','Cole','Mimo']]
csv='gender,league,name,stars,code,icon\nmen,Premier League,Arsenal,4.5,ARS,\nmen,La Liga,Barcelona,5,BAR,\nwomen,WSL,Arsenal Women,4,ARS,\n'
call('games/ea-fc-26/teams',{'csv':csv})
assert call('games/ea-fc-26/teams')[0]['stars'] in [4,4.5,5]
call('games/ea-fc-26/teams',{'csv':csv+'men,La Liga,Bad,4.2,BAD,\n'},status=400)
assert len(call('games/ea-fc-26/teams'))==3
lid=call('games/ea-fc-26/leagues',{'name':'Knockout test','kind':'tournament'})['id']
body={'format':'knockout','players':ids,'seeding':'manual','rated':True}
preview=call(f'leagues/{lid}/draw',{**body,'preview':True});assert len(preview['bracket']['rounds'])==3
call(f'leagues/{lid}/draw',body)
l=call(f'leagues/{lid}');assert len(l['fixtures'])==2,(l['fixtures'])
match={'team1':'Arsenal','team2':'Barcelona','s1':2,'s2':2,'pens':True,'pen1':5,'pen2':4,'aet':True}
f=l['fixtures'][0];m=call('games/ea-fc-26/matches',{**match,'p1':f['p1'],'p2':f['p2'],'fixture_id':f['id']})
call(f'matches/{m["id"]}/approve',{})
assert not call('games/ea-fc-26/rankings')['rows']
assert call('players/'+str(f['p1']))['games'][0]['record']['w']==1
assert call(f"games/ea-fc-26/h2h?a={f['p1']}&b={f['p2']}")['a_wins']==1
l=call(f'leagues/{lid}');assert any(n['winner']==f['p1'] for n in l['bracket']['rounds'][0])
call('games/ea-fc-26/ratings/update',{})
r=call('games/ea-fc-26/rankings');assert all(p['d']==1 for p in r['rows']);assert len(r['rows'])==2
old=r['rows']
mm=call('matches/'+str(m['id']));assert mm['details']['club1']['code']=='ARS'
call('games/ea-fc-26/teams',{'csv':csv.replace('Arsenal,4.5','Arsenal,0.5')})
assert call('games/ea-fc-26/rankings')['rows']==old
# Edit approved result; ratings stay frozen until explicit rebuild
call('matches/'+str(m['id']),{**match,'p1':f['p1'],'p2':f['p2'],'s1':3,'s2':1,'pens':False},'PUT')
assert call('games/ea-fc-26/rankings')['rows']==old
assert call('matches/'+str(m['id']))['details']['stars1']==4.5
call('games/ea-fc-26/ratings/update',{})
assert call('games/ea-fc-26/rankings')['rows']!=old
# Player 2 gets opposite delta
p=call('players/'+str(f['p2']));h=p['games'][0]['history'][0]
a=call('matches/'+str(m['id']))['delta'];assert abs(h['delta']+a)<0.01
print('PASS catalog validation, half-stars, penalty advancement, byes, rating publish boundary, preserved snapshots, profile delta')
# Group stage separate points and unrated tournament
lid=call('games/ea-fc-26/leagues',{'name':'Group test','kind':'tournament'})['id']
call(f'leagues/{lid}/draw',{'format':'groups','players':ids[:4],'seeding':'elo','groups':2,'advance':1,'rated':False})
l=call(f'leagues/{lid}');assert len(l['groups'])==2
call(f'leagues/{lid}/advance',{},status=400)
for f in l['fixtures']:
 m=call('games/ea-fc-26/matches',{**match,'p1':f['p1'],'p2':f['p2'],'fixture_id':f['id']});assert m['elo_enabled']==0
 call(f'matches/{m["id"]}/approve',{})
l=call(f'leagues/{lid}');assert all(all(p['pts']==1 for p in g['table']) for g in l['groups'])
call(f'leagues/{lid}/advance',{});l=call(f'leagues/{lid}');assert len(l['bracket']['rounds'])==1
call('matches/'+str(m['id']),{**match,'p1':f['p1'],'p2':f['p2']},'PUT',400)
print('PASS group tables, qualification readiness, knockout generation, group freeze, unrated inheritance')
# Test knockout tie rejection and downstream edits rollback
lid=call('games/ea-fc-26/leagues',{'name':'Downstream test','kind':'tournament'})['id']
call(f'leagues/{lid}/draw',{'format':'knockout','players':ids[:4],'seeding':'manual'})
l=call(f'leagues/{lid}');first=[]
for f in l['fixtures']:
 m=call('games/ea-fc-26/matches',{**match,'pens':False,'p1':f['p1'],'p2':f['p2'],'fixture_id':f['id']})
 call(f'matches/{m["id"]}/approve',{},status=400)
 call('matches/'+str(m['id']),{**match,'p1':f['p1'],'p2':f['p2']},'PUT')
 call(f'matches/{m["id"]}/approve',{});first.append((f,m))
l=call(f'leagues/{lid}');f=next(f for f in l['fixtures'] if f['id']==l['bracket']['rounds'][-1][0]['fixture'])
final=call('games/ea-fc-26/matches',{**match,'p1':f['p1'],'p2':f['p2'],'fixture_id':f['id']})
f,m=first[0]
call('matches/'+str(m['id']),{**match,'p1':f['p1'],'p2':f['p2'],'pen1':4,'pen2':5},'PUT',400)
assert call('matches/'+str(m['id']))['details']['pen1']==5
call('matches/'+str(m['id']),method='DELETE',status=400)
assert call('matches/'+str(m['id']))['status']=='approved'
print('PASS tied knockout rejection and downstream correction/deletion rollback')
demo={'league':lid,'players':ids}

# The same visible club name in two genders must resolve to different identities.
shared='gender,league,name,stars,code,icon\nmen,League,Shared Club,4.5,SC,\nwomen,League,Shared Club,3,SC,\n'
call('games/ea-fc-27/teams',{'csv':shared})
clubs=call('games/ea-fc-27/teams');assert len(clubs)==2
men=next(t for t in clubs if t['gender']=='men');women=next(t for t in clubs if t['gender']=='women')
m=call('games/ea-fc-27/matches',{**match,'team1':men['key'],'team2':women['key'],'p1':ids[0],'p2':ids[1]})
assert m['details']['club1']['gender']=='men' and m['details']['club2']['gender']=='women'
assert m['details']['stars1']==4.5 and m['details']['stars2']==3
# Round-robin points are independently configurable, including shoot-out wins.
lid=call('games/ea-fc-27/leagues',{'name':'Points rules','kind':'league'})['id']
call(f'leagues/{lid}/draw',{'format':'league','players':ids[:2],'seeding':'random','nonce':'fixed-test','rounds':2,'shootout_points':True,'win_points':2,'draw_points':1,'loss_points':0})
l=call(f'leagues/{lid}');assert len(l['fixtures'])==2;assert all(p['p']==0 for p in l['table'])
f=l['fixtures'][0]
m=call('games/ea-fc-27/matches',{**match,'team1':men['key'],'team2':women['key'],'p1':f['p1'],'p2':f['p2'],'fixture_id':f['id']})
call(f'matches/{m["id"]}/approve',{})
l=call(f'leagues/{lid}');assert l['table'][0]['pts']==2 and l['table'][0]['w']==1
call('games/ea-fc-27/ratings/update',{})
assert all(p['d']==1 for p in call('games/ea-fc-27/rankings')['rows'])
# CSV quoting/BOM and atomic rejection.
quoted='\ufeffgender,league,name,stars,code,icon\r\nmen,"League, East","Club ""A""",0.5,CA,\r\n'
call('games/ea-fc-27/teams',{'csv':quoted})
assert call('games/ea-fc-27/teams')[0]['name']=='Club "A"'
call('games/ea-fc-27/teams',{'csv':quoted+'men,League,Invalid,5.5,XX,\n'},status=400)
assert len(call('games/ea-fc-27/teams'))==1
print('PASS gender-specific identity, independent league points, double round robin, quoted CSV/BOM, atomic invalid imports')
if os.environ.get('MIMELO_DOM_TEST'):
 subprocess.run(['node',str(Path(__file__).with_name('dom.mjs')),str(port),json.dumps(demo)],check=True)
