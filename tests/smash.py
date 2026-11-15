"""Smash Ultimate lifecycle and competition coverage on an isolated database."""
from integration import *

fighters_a=['01','02']
fighters_b=['03','04']
singles={
 'p1':ids[0],'p2':ids[1],'format':'singles','best_of':3,
 'games':[
  {'a':3,'b':1,'fighters_a':['01'],'fighters_b':['03'],'stage':'BF'},
  {'a':0,'b':3,'fighters_a':['01'],'fighters_b':['03'],'stage':'FD'},
  {'a':2,'b':3,'fighters_a':['02'],'fighters_b':['04'],'stage':'PS2'},
 ]
}
for bad in [
 {'best_of':2},
 {'format':123},
 {'games':[{'a':3,'b':3,'fighters_a':['01'],'fighters_b':['03'],'stage':'BF'}]},
 {'games':[{'a':2,'b':1,'fighters_a':['01'],'fighters_b':['03'],'stage':'BF'}]},
 {'games':[{'a':3,'b':1,'fighters_a':['999'],'fighters_b':['03'],'stage':'BF'}]},
 {'games':[{'a':3,'b':1,'fighters_a':['01'],'fighters_b':['03'],'stage':'unknown'}]},
]:
 call('games/smash-ultimate/matches',{**singles,**bad},status=400)
m=call('games/smash-ultimate/matches',singles)
assert (m['s1'],m['s2'])==(1,2)
assert m['details']['games'][0]['fighters_a']==[{'id':'01','name':'Mario'}]
assert call('games/smash-ultimate/matches?format=singles')[0]['id']==m['id']
call(f'matches/{m["id"]}/approve',{})

doubles={
 'p1':ids[0],'p2':ids[1],'partner1':ids[2],'partner2':ids[3],
 'format':'doubles','best_of':1,
 'games':[{'a':6,'b':5,'fighters_a':fighters_a,'fighters_b':fighters_b,'stage':'SBF'}]
}
for bad in [
 {'partner1':ids[1]},
 {'partner2':ids[2]},
 {'games':[{'a':5,'b':4,'fighters_a':fighters_a,'fighters_b':fighters_b,'stage':'SBF'}]},
 {'games':[{'a':6,'b':5,'fighters_a':['01'],'fighters_b':fighters_b,'stage':'SBF'}]},
]:
 call('games/smash-ultimate/matches',{**doubles,**bad},status=400)
dm=call('games/smash-ultimate/matches',doubles)
assert (dm['s1'],dm['s2'])==(1,0) and len(dm['partners'])==2
call(f'matches/{dm["id"]}/approve',{})
call('games/smash-ultimate/ratings/update',{})

singles_rank=call('games/smash-ultimate/rankings?format=singles')['rows']
doubles_rank=call('games/smash-ultimate/rankings?format=doubles')['rows']
assert {r['id'] for r in singles_rank}==set(ids[:2])
assert {r['id'] for r in doubles_rank}==set(ids[:4])
by_id={r['id']:r for r in doubles_rank}
assert by_id[ids[0]]['elo']==by_id[ids[2]]['elo']>1000
assert by_id[ids[1]]['elo']==by_id[ids[3]]['elo']<1000
for uid in ids[:4]:
 profile=next(g for g in call(f'players/{uid}')['games'] if g['slug']=='smash-ultimate')
 assert profile['doubles_elo']==by_id[uid]['elo']
 assert profile['records']['doubles']['w']+profile['records']['doubles']['l']==1
 assert any(h['id']==dm['id'] for h in profile['history'])
print('PASS Smash stock/roster/stage validation, independent singles/doubles Elo and partner profiles')

lid=call('games/smash-ultimate/leagues',{'name':'Smash doubles bracket','kind':'tournament'})['id']
draw={
 'format':'knockout','players':ids[:2],'match_format':'doubles',
 'pairs':[[ids[0],ids[2]],[ids[1],ids[3]]],
 'seeding':'manual','elimination':'double'
}
preview=call(f'leagues/{lid}/draw',{**draw,'preview':True})
assert preview['config']['match_format']=='doubles'
call(f'leagues/{lid}/draw',draw)
fixture=call(f'leagues/{lid}')['fixtures'][0]
result={**doubles,'fixture_id':fixture['id'],'best_of':1,
 'games':[{'a':6,'b':4,'fighters_a':fighters_a,'fighters_b':fighters_b,'stage':'BF'}]}
bad_format={**result,'format':'singles','games':[{'a':3,'b':1,'fighters_a':['01'],'fighters_b':['03'],'stage':'BF'}]}
call('games/smash-ultimate/matches',bad_format,status=400)
match=call('games/smash-ultimate/matches',result)
call(f'matches/{match["id"]}/approve',{})
league=call(f'leagues/{lid}')
assert league['bracket']['rounds'][0][0]['done']
assert league['bracket']['rounds'][0][0]['winner']==fixture['p1']
assert len(league['fixtures'][0]['match']['partners'])==2
print('PASS Smash fixed-pair double-elimination fixture recording and bracket advancement')

# Returned results remain editable and unpublished until approved.
returned=call('games/smash-ultimate/matches',{**singles,'best_of':1,'games':[{'a':3,'b':2,'fighters_a':['33-35'],'fighters_b':['79-80'],'stage':'T&C'}]})
call(f'matches/{returned["id"]}/reject',{'reason':'Check stock count'})
assert call(f'matches/{returned["id"]}')['status']=='rejected'
call(f'matches/{returned["id"]}',{**singles,'best_of':1,'games':[{'a':3,'b':1,'fighters_a':['04e'],'fighters_b':['79-80'],'stage':'T&C'}]},'PUT')
assert call(f'matches/{returned["id"]}')['status']=='pending'
call(f'matches/{returned["id"]}/approve',{})
assert call(f'matches/{returned["id"]}')['details']['games'][0]['fighters_a'][0]['name']=='Dark Samus'
print('PASS Smash returned-result correction, grouped fighters, Echo selection and Town and City persistence')

# Exercise approved-result progression with Smash scores rather than Tennis scores.
pool=ids+[call('users',{'name':f'Smash entrant {i}'})['id'] for i in range(4)]
def create(name,**config):
 lid=call('games/smash-ultimate/leagues',{'name':name,'kind':'tournament' if config.get('format')!='league' else 'league'})['id']
 call(f'leagues/{lid}/draw',{'players':pool[:4],'seeding':'manual',**config})
 return lid

def play(lid,f,winner=1,approve=True):
 config=call(f'leagues/{lid}')['config'];fmt=config.get('match_format','singles');limit=6 if fmt=='doubles' else 3
 body={'p1':f['p1'],'p2':f['p2'],'format':fmt,'best_of':1,'fixture_id':f['id'],
 'games':[{'a':limit if winner==1 else limit-1,'b':limit-1 if winner==1 else limit,'fighters_a':['33-35','04e'] if fmt=='doubles' else ['33-35'],'fighters_b':['79-80','01'] if fmt=='doubles' else ['79-80'],'stage':'T&C'}]}
 if fmt=='doubles':
  pairs=dict(config['pairs']);body.update(partner1=pairs[f['p1']],partner2=pairs[f['p2']])
 m=call('games/smash-ultimate/matches',body)
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


for n in [2,3,4,5,8]:
 for reset in [False,True]:
  lid=create(f'Smash DE {n} {reset}',players=pool[:n],format='knockout',elimination='double')
  l,losses,count=finish(lid,reset);champion=l['bracket']['rounds'][-1][0]['winner']
  assert count==2*n-2+int(reset)
  assert all(losses.get(pid,0)==2 for pid in pool[:n] if pid!=champion)
for fmt in ['league','groups']:
 for paired in [False,True]:
  pairs=[[pool[i],pool[i+4]] for i in range(4)] if paired else []
  lid=create(f'Smash {fmt} {paired}',format=fmt,groups=2,advance=1,playoff_count=2 if fmt=='league' else 0,elimination='double',match_format='doubles' if paired else 'singles',pairs=pairs)
  for f in call(f'leagues/{lid}')['fixtures']:
   m,body=play(lid,f,approve=False);assert call(f'leagues/{lid}')['bracket'] is None
   call(f'matches/{m["id"]}/approve',{})
  assert len(call(f'leagues/{lid}')['bracket']['entrants'])==2
  call(f'matches/{m["id"]}',body,'PUT',400)
  finish(lid,True)
print('PASS Smash double elimination 2–8 entrants, byes/reset, singles/doubles groups and league playoffs')
call('games/smash-ultimate/ratings/update',{})
ranks=call('games/smash-ultimate/rankings?format=doubles')['rows']
record=call(f'matches/{dm["id"]}')['details']
proc.terminate();proc.wait(timeout=5)
restarted=subprocess.Popen([binary,str(port)],cwd=work.name,env={**os.environ,'MIMELO_ADMIN_PASSWORD':'TestingOnly123'},stdout=log,stderr=log)
try:
 for _ in range(100):
  try:call('games');break
  except (OSError,urllib.error.URLError):time.sleep(.05)
 assert call('games/smash-ultimate/rankings?format=doubles')['rows']==ranks
 assert call(f'matches/{dm["id"]}')['details']==record
 print('PASS Smash persisted stocks, fighters/stage, partners and published ratings after restart')
finally:restarted.terminate();restarted.wait(timeout=5)
