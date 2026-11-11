"""Verify upgrading the original archive's SQLite tables without data loss."""
import atexit,json,os,socket,sqlite3,subprocess,sys,tempfile,time,urllib.request,urllib.error,http.cookiejar
from pathlib import Path
binary=str(Path(sys.argv[1] if len(sys.argv)>1 else './mimelo').resolve())
work=tempfile.TemporaryDirectory(prefix='mimelo-migration-')
db=sqlite3.connect(Path(work.name)/'mimelo.db')
db.executescript('''
CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE,name TEXT NOT NULL,email TEXT,salt TEXT,hash TEXT,is_main INTEGER NOT NULL DEFAULT 0,claim_code TEXT,created INTEGER NOT NULL);
CREATE TABLE teams(game TEXT NOT NULL,name_lc TEXT NOT NULL,name TEXT NOT NULL,stars INTEGER NOT NULL,PRIMARY KEY(game,name_lc));
CREATE TABLE matches(id INTEGER PRIMARY KEY,game TEXT NOT NULL,league_id INTEGER,p1 INTEGER NOT NULL,p2 INTEGER NOT NULL,s1 INTEGER NOT NULL,s2 INTEGER NOT NULL,details TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',played_at INTEGER NOT NULL,submitted_by INTEGER,submitted_at INTEGER NOT NULL,locked_at INTEGER,locked_by INTEGER,rated_at INTEGER,edited_at INTEGER);
INSERT INTO users(id,name,created) VALUES(1,'Legacy A',1700000000000),(2,'Legacy B',1700000000000);
INSERT INTO teams VALUES('ea-fc-26','old club','Old Club',5),('ea-fc-26','other club','Other Club',3);
''')
details=json.dumps({'team1':'Old Club','team2':'Other Club','pens':False})
db.execute("INSERT INTO matches(id,game,p1,p2,s1,s2,details,status,played_at,submitted_at,rated_at) VALUES(1,'ea-fc-26',1,2,1,0,?,'approved',1700000000000,1700000000000,1700000000000)",(details,))
db.commit();db.close()
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
log=open(Path(work.name)/'server.log','w')
proc=subprocess.Popen([binary,str(port)],cwd=work.name,env={**os.environ,'MIMELO_ADMIN_PASSWORD':'TestingOnly123'},stdout=log,stderr=log)
def cleanup():
 proc.terminate()
 try:proc.wait(timeout=5)
 except subprocess.TimeoutExpired:proc.kill()
 log.close();work.cleanup()
atexit.register(cleanup)
s=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
base=f'http://127.0.0.1:{port}/api/'
def call(path,body=None):
 req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'})
 with s.open(req) as r:return json.load(r)
for _ in range(100):
 try:call('games');break
 except (OSError,urllib.error.URLError):time.sleep(.05)
else:raise RuntimeError('Upgrade server failed')
call('login',{'username':'mimo','password':'TestingOnly123'})
old=call('games/ea-fc-26/rankings')['rows'];assert len(old)==2
m=call('matches/1');assert m['details']['stars1']==5 and m['details']['club1']['name']=='Old Club'
call('games/ea-fc-26/teams',{'csv':'gender,league,name,stars,code,icon\nmen,League,Old Club,0.5,OC,\nmen,League,Other Club,5,OT,\n'})
assert call('games/ea-fc-26/rankings')['rows']==old
call('games/ea-fc-26/ratings/update',{})
assert call('games/ea-fc-26/rankings')['rows']==old
assert call('matches/1')['details']['stars1']==5
assert len(call('players'))==3
print('PASS original-schema upgrade, retained players/match/ratings, historical strength snapshot and catalog replacement')
