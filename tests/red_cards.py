"""EA FC red-card metadata: create, validate, correct, publish, reload."""
from integration import *

for slug in ['ea-fc-26','ea-fc-27']:
 call(f'games/{slug}/teams',{'csv':csv})
 payload={'p1':ids[0],'p2':ids[1],'team1':'Arsenal','team2':'Barcelona','s1':2,'s2':1,'red_cards1':1,'red_cards2':2}
 for value in [-1,12,1.5,'2',None,True]:
  for key in ['red_cards1','red_cards2']:
   call(f'games/{slug}/matches',{**payload,key:value},status=400)
 m=call(f'games/{slug}/matches',payload)
 mid=m['id']
 assert (m['details']['red_cards1'],m['details']['red_cards2'])==(1,2)
 call(f'matches/{mid}/approve',{})
 call(f'games/{slug}/ratings/update',{})
 before=call(f'games/{slug}/rankings')['rows']
 corrected=call(f'matches/{mid}',{**payload,'red_cards1':0,'red_cards2':3},'PUT')
 assert corrected['details']['red_cards2']==3
 call(f'games/{slug}/ratings/update',{})
 assert call(f'games/{slug}/rankings')['rows']==before, 'Red cards changed Elo'
 legacy={k:v for k,v in payload.items() if not k.startswith('red_cards')}
 corrected=call(f'matches/{mid}',legacy,'PUT')
 assert (corrected['details']['red_cards1'],corrected['details']['red_cards2'])==(0,3)
 listing=next(x for x in call(f'games/{slug}/matches') if x['id']==mid)
 assert listing['details']['red_cards2']==3
 profile=next(g for g in call(f'players/{ids[0]}')['games'] if g['slug']==slug)
 assert next(x for x in profile['history'] if x['id']==mid)['details']['red_cards2']==3
 old=call(f'games/{slug}/matches',legacy)
 assert 'red_cards1' not in old['details'], 'Unknown historic counts must not become zero'
 stored=json.loads(sqlite3.connect(Path(work.name)/'mimelo.db').execute('SELECT details FROM matches WHERE id=?',(mid,)).fetchone()[0])
 assert stored['red_cards2']==3
print('PASS both EA FC games: red-card validation, persisted details/history, corrections, legacy omission, Elo isolation')
