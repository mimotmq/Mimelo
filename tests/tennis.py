"""Tennis lifecycle and competition regression suite, on an isolated database.
Running this also executes the shared integration suite in integration.py.
"""
from integration import *

pool=ids+[call('users',{'name':f'Tennis player {i}'})['id'] for i in range(12)]
def create(name,**config):
 lid=call('games/tennis/leagues',{'name':name,'kind':'tournament' if config.get('format')!='league' else 'league'})['id']
 call(f'leagues/{lid}/draw',{'players':pool[:4],'seeding':'manual',**config})
 return lid

def play(lid,f,winner=1,approve=True):
 config=call(f'leagues/{lid}')['config']
 body={'p1':f['p1'],'p2':f['p2'],'format':config.get('match_format','singles'),'best_of':1,'sets':[{'a':6 if winner==1 else 0,'b':0 if winner==1 else 6}],'fixture_id':f['id']}
 if body['format']=='doubles':
  pairs=dict(config['pairs']);body.update(partner1=pairs[f['p1']],partner2=pairs[f['p2']])
 m=call('games/tennis/matches',body)
 if approve:call(f'matches/{m["id"]}/approve',{})
 return m,body

def finish(lid,reset=False):
 losses={};played=0
 for _ in range(150):
  league=call(f'leagues/{lid}');br=league['bracket'];final=br['rounds'][-1][0]
  if final['done']:
   assert final['winner'] in br['entrants']
   return league,losses,played
  todo=[f for f in league['fixtures'] if f['stage']=='knockout' and not f['match']]
  assert todo,league
  for f in todo:
   node=next(n for rd in br['rounds'] for n in rd if n['fixture']==f['id'])
   winner=2 if reset and node.get('key')=='GF' else 1
   assert f['p1']!=f['p2']
   play(lid,f,winner)
   loser=f['p2' if winner==1 else 'p1'];losses[loser]=losses.get(loser,0)+1;played+=1
   assert losses[loser]<=2
 raise AssertionError('Bracket failed to finish')

# Every supported length: exact completion and no extraneous sets or points.
for best in [1,3,5]:
 sets=[{'a':6,'b':4}]*(best//2+1)
 for format in ['singles','doubles']:
  base={**doubles,'best_of':best,'sets':sets,'format':format}
  m=call('games/tennis/matches',base);assert m['s1']==best//2+1
  call('games/tennis/matches',{**base,'sets':sets+[{'a':0,'b':6}]},status=400)
  if best>1:call('games/tennis/matches',{**base,'sets':sets[:-1]},status=400)
for bad in [{'a':7,'b':6,'tb_a':8,'tb_b':5},{'a':7,'b':6,'tb_a':7,'tb_b':6},{'a':6,'b':0,'tb_a':7,'tb_b':0},{'a':6.5,'b':0}]:
 call('games/tennis/matches',{**tennis,'best_of':1,'sets':[bad]},status=400)
valid=call('games/tennis/matches',{**tennis,'best_of':1,'sets':[{'a':6,'b':7,'tb_a':10,'tb_b':12}]});assert valid['s2']==1
# Rejection -> correction -> reapproval, with an audit trail and no premature rating.
m=call('games/tennis/matches',doubles)
call(f'matches/{m["id"]}/reject',{'reason':'Wrong set scores'})
assert call(f'matches/{m["id"]}')['status']=='rejected'
assert call('games/tennis/matches?status=rejected')[0]['id']==m['id']
call(f'matches/{m["id"]}/approve',{},status=400)
call(f'matches/{m["id"]}',doubles,'PUT');assert call(f'matches/{m["id"]}')['status']=='pending'
call(f'matches/{m["id"]}/approve',{})
assert any(e['action']=='resubmitted' for e in call(f'matches/{m["id"]}')['log'])
# Elo preview never publishes or writes matches.
before=call('games/tennis/matches');ratings=call('games/tennis/rankings')['rows']
assert call('games/tennis/rating-preview',doubles)['delta']>0
assert call('games/tennis/matches')==before and call('games/tennis/rankings')['rows']==ratings
print('PASS Tennis scoring lengths, tiebreak edges, correction/resubmission and read-only Elo preview')

# Fixed pairs, independent individual Elo, round robin and single elimination.
pairs=[[pool[i],pool[i+4]] for i in range(4)]
lid=create('Doubles cup',match_format='doubles',pairs=pairs,format='knockout',seeding='elo')
l=call(f'leagues/{lid}');f=l['fixtures'][0]
assert len(f['partners'])==2
call('games/tennis/matches',{**doubles,'p1':f['p1'],'p2':f['p2'],'fixture_id':f['id']},status=400)
m,body=play(lid,f);assert len(call(f'leagues/{lid}')['fixtures'][0]['match']['partners'])==2
call(f'matches/{m["id"]}',{**body,'format':'singles'},'PUT',400)
finish(lid)
# Byes / double elimination for small, uneven and power-of-two draws.
for n in [2,3,4,5,6,7,8,9,16]:
 for reset in [False,True]:
  lid=create(f'DE {n} {reset}',players=pool[:n],format='knockout',elimination='double')
  l,losses,count=finish(lid,reset)
  champion=l['bracket']['rounds'][-1][0]['winner']
  assert count==2*n-2+int(reset),(n,reset,count)
  assert all(losses.get(pid,0)==2 for pid in pool[:n] if pid!=champion)
  assert l['bracket']['rounds'][-1][0]['skipped']==(not reset)
# Reserved partners cannot be deleted before they have match history.
fresh=[call('users',{'name':f'Reserved pair {i}'})['id'] for i in range(4)]
reserved=create('Reserved pairs',players=fresh[:2],match_format='doubles',pairs=[[fresh[0],fresh[2]],[fresh[1],fresh[3]]],format='knockout')
call('users/'+str(fresh[2]),method='DELETE',status=400)
print('PASS fixed doubles pairs, single elimination, double elimination 2–16 entrants, byes and conditional resets')

# League playoffs and groups auto-qualify only after the final approved result.
for fmt in ['league','groups']:
 for pair_mode in [False,True]:
  lid=create(f'{fmt} {pair_mode}',format=fmt,groups=2,advance=1,playoff_count=2 if fmt=='league' else 0,elimination='double',match_format='doubles' if pair_mode else 'singles',pairs=pairs if pair_mode else [])
  league=call(f'leagues/{lid}')
  for i,f in enumerate(league['fixtures']):
   m,body=play(lid,f,1,approve=False)
   assert call(f'leagues/{lid}')['bracket'] is None
   call(f'matches/{m["id"]}/approve',{})
  final=call(f'leagues/{lid}');assert final['bracket'] is not None
  if fmt=='league':assert len(final['bracket']['entrants'])==2
  call(f'matches/{m["id"]}',body,'PUT',400)
  call(f'matches/{m["id"]}',method='DELETE',status=400)
  before=final['table'];finish(lid,True);assert call(f'leagues/{lid}')['table']==before
print('PASS singles/doubles league playoffs and group qualification, automatic advancement and qualifier freeze')

# An exact three-way tie cannot silently award the last playoff place.
lid=create('Tied league',players=pool[:3],format='league',playoff_count=2)
l=call(f'leagues/{lid}');a,b,c=pool[:3];wins={(a,b):a,(a,c):c,(b,c):b}
for f in l['fixtures']:play(lid,f,1 if wins[(f['p1'],f['p2'])]==f['p1'] else 2)
l=call(f'leagues/{lid}');assert l['bracket'] is None and l['qualification'][0]['tied']
call(f'leagues/{lid}/advance',{'selections':{'1':[a]}},status=400)
call(f'leagues/{lid}/advance',{'selections':{'1':[a,pool[4]]}},status=400)
call(f'leagues/{lid}/advance',{'selections':{'1':[a,c]}})
assert call(f'leagues/{lid}')['bracket']['entrants']==[a,c]
# Corrections propagate until a downstream result exists, then roll back atomically.
lid=create('DE correction',players=pool[:4],format='knockout',elimination='double')
l=call(f'leagues/{lid}');first=[]
for f in l['fixtures']:first.append(play(lid,f))
l=call(f'leagues/{lid}');nextf=next(f for f in l['fixtures'] if not f['match']);play(lid,nextf,approve=False)
m,body=first[0];call(f'matches/{m["id"]}',{**body,'sets':[{'a':0,'b':6}]},'PUT',400)
assert call(f'matches/{m["id"]}')['s1']==1
print('PASS tied qualifier resolution and double-elimination downstream correction rollback')
# Published ratings and participant data survive a complete server restart.
call('games/tennis/ratings/update',{})
published=call('games/tennis/rankings?format=doubles')['rows']
profile=call('players/'+str(partner))
proc.terminate();proc.wait(timeout=5)
restarted=subprocess.Popen([binary,str(port)],cwd=work.name,env={**os.environ,'MIMELO_ADMIN_PASSWORD':'TestingOnly123'},stdout=log,stderr=log)
try:
 for _ in range(100):
  try:call('games');break
  except (OSError,urllib.error.URLError):time.sleep(.05)
 assert call('games/tennis/rankings?format=doubles')['rows']==published
 assert call('players/'+str(partner))==profile
 assert call(f'leagues/{lid}')['config']['elimination']=='double'
 print('PASS Tennis persistence across restart: partners, profile, published ratings and competition settings')
finally:restarted.terminate();restarted.wait(timeout=5)
