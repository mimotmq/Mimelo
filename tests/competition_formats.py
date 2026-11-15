"""EA FC and Table Tennis expanded draws, keeping legacy qualification intact."""
from integration import *

pool=ids+[call('users',{'name':f'Competition entrant {i}'})['id'] for i in range(4)]
for game in ['ea-fc-26','ea-fc-27']:
 call(f'games/{game}/teams',{'csv':csv})

def create(game,name,**config):
 lid=call(f'games/{game}/leagues',{'name':name,'kind':'league' if config.get('format')=='league' else 'tournament'})['id']
 call(f'leagues/{lid}/draw',{'players':pool[:4],'seeding':'manual',**config})
 assert call(f'leagues/{lid}')['config']['qualification_mode']=='automatic'
 return lid

def play(game,lid,f,winner=1,approve=True,shootout=False):
 body={'p1':f['p1'],'p2':f['p2'],'fixture_id':f['id']}
 if game=='table-tennis':body.update(best_of=1,games=[{'a':11 if winner==1 else 8,'b':8 if winner==1 else 11}])
 else:body.update(team1='Arsenal',team2='Barcelona',s1=2 if winner==1 else 0,s2=0 if winner==1 else 2,red_cards1=1,red_cards2=0)
 if shootout:body.update(s1=1,s2=1,pens=True,pen1=5 if winner==1 else 4,pen2=4 if winner==1 else 5)
 m=call(f'games/{game}/matches',body)
 if approve:call(f'matches/{m["id"]}/approve',{})
 return m,body

def finish(game,lid,reset=False):
 losses={};played=0
 for _ in range(100):
  league=call(f'leagues/{lid}');br=league['bracket'];final=br['rounds'][-1][0]
  if final['done']:return league,losses,played
  todo=[f for f in league['fixtures'] if f['stage']=='knockout' and not f['match']]
  assert todo
  for f in todo:
   n=next(n for r in br['rounds'] for n in r if n['fixture']==f['id'])
   winner=2 if reset and n.get('key')=='GF' else 1
   play(game,lid,f,winner,shootout=game!='table-tennis')
   loser=f['p2' if winner==1 else 'p1'];losses[loser]=losses.get(loser,0)+1;played+=1
   assert losses[loser]<=2
 raise AssertionError('Bracket did not finish')

for game in ['ea-fc-26','ea-fc-27','table-tennis']:
 for n in [2,3,5,8]:
  for reset in [False,True]:
   lid=create(game,f'{game} DE {n} {reset}',players=pool[:n],format='knockout',elimination='double')
   l,losses,count=finish(game,lid,reset)
   champion=l['bracket']['rounds'][-1][0]['winner']
   assert count==2*n-2+int(reset)
   assert all(losses.get(p,0)==2 for p in pool[:n] if p!=champion)
 for fmt in ['league','groups']:
  for elimination in ['single','double']:
   lid=create(game,f'{game} {fmt} {elimination}',format=fmt,groups=2,advance=1,playoff_count=2 if fmt=='league' else 0,elimination=elimination)
   for f in call(f'leagues/{lid}')['fixtures']:
    m,body=play(game,lid,f,approve=False)
    assert call(f'leagues/{lid}')['bracket'] is None
    call(f'matches/{m["id"]}/approve',{})
   league=call(f'leagues/{lid}');assert len(league['bracket']['entrants'])==2
   call(f'matches/{m["id"]}',body,'PUT',400)
   call(f'matches/{m["id"]}',method='DELETE',status=400)
   table=league['table'];finish(game,lid,True)
   assert call(f'leagues/{lid}')['table']==table
 # A three-way tie cannot silently award a playoff place.
 lid=create(game,f'{game} qualification tie',format='league',players=pool[:3],playoff_count=2)
 a,b,c=pool[:3];wins={(a,b):a,(a,c):c,(b,c):b}
 for f in call(f'leagues/{lid}')['fixtures']:play(game,lid,f,1 if wins[f['p1'],f['p2']]==f['p1'] else 2)
 l=call(f'leagues/{lid}');assert l['bracket'] is None and l['qualification'][0]['tied']
 call(f'leagues/{lid}/advance',{'selections':{'1':[a]}},status=400)
 call(f'leagues/{lid}/advance',{'selections':{'1':[a,c]}})
 assert call(f'leagues/{lid}')['bracket']['entrants']==[a,c]
 # Reject direct results that could bypass a generated league's fixtures.
 lid=create(game,f'{game} direct fixture guard',format='league',playoff_count=2)
 f=call(f'leagues/{lid}')['fixtures'][0];m,body=play(game,lid,f,approve=False)
 body.pop('fixture_id');body['league_id']=lid
 call(f'games/{game}/matches',body,status=400)
 print(f'PASS {game}: DE byes/resets 2–8 entrants, shootouts where relevant, groups, league playoffs, ties, freeze and fixture guard')
# No fixed 64-player cap: preview a 65-player knockout without creating a huge league.
large=[call('users',{'name':f'Large draw {i}'})['id'] for i in range(65)]
lid=call('games/table-tennis/leagues',{'name':'Large preview','kind':'tournament'})['id']
p=call(f'leagues/{lid}/draw',{'format':'knockout','players':large,'elimination':'double','preview':True})
assert len(p['bracket']['entrants'])==65
assert not call(f'leagues/{lid}')['fixtures']
print('PASS 65-player preview, no fixed 64-player cap and preview performs no fixture writes')

# Draw configuration, qualifiers and completed brackets survive a server restart.
snapshots={}
for game in ['ea-fc-26','ea-fc-27','table-tennis']:
 for row in call(f'games/{game}/leagues'):
  snapshots[row['id']]=call(f"leagues/{row['id']}")
proc.terminate();proc.wait(timeout=5)
restarted=subprocess.Popen([binary,str(port)],cwd=work.name,env={**os.environ,'MIMELO_ADMIN_PASSWORD':'TestingOnly123'},stdout=log,stderr=log)
try:
 for _ in range(100):
  try:call('games');break
  except (OSError,urllib.error.URLError):time.sleep(.05)
 for lid,snapshot in snapshots.items():assert call(f'leagues/{lid}')==snapshot, f'Competition {lid} changed after restart'
 print('PASS EA FC/Table Tennis draw settings, qualification and bracket persistence after restart')
finally:restarted.terminate();restarted.wait(timeout=5)
