"""Live overview counts, searchable pagination, permissions, and published charts."""
from integration import *
from urllib.parse import urlencode

game='tennis'
summary=call(f'games/{game}/summary')
all_matches=call(f'games/{game}/matches?limit=300')
assert summary['matches']==len(all_matches)
assert summary['approved']==sum(m['status']=='approved' for m in all_matches)
participants=set()
for m in all_matches:
 participants.update([m['p1'],m['p2']]);participants.update(p['id'] for p in m['partners'])
assert summary['players']==len(participants)
call('games/missing/summary',status=404)

body={'p1':ids[0],'p2':ids[1],'format':'singles','best_of':1,'surface':'clay','sets':[{'a':6,'b':2}]}
match=call(f'games/{game}/matches',body)
assert call(f'matches/{match["id"]}')['can_delete']
page=call(f'games/{game}/matches?'+urlencode({'paged':1,'q':'Mustafa','limit':1}))
assert page['total']>0 and len(page['rows'])==1
next_page=call(f'games/{game}/matches?'+urlencode({'paged':1,'q':'Mustafa','limit':1,'offset':1}))
assert next_page['total']==page['total']
if next_page['rows']:assert next_page['rows'][0]['id']!=page['rows'][0]['id']
assert call(f'games/{game}/matches?'+urlencode({'paged':1,'q':"%' OR 1=1 --"}))['total']==0
assert call(f'games/{game}/matches?paged=1&competition=friendly')['total']>0
assert isinstance(call(f'games/{game}/matches'),list),'Keep the legacy array response'

call(f'matches/{match["id"]}/approve',{})
call(f'games/{game}/ratings/update',{})
def profile_game(player):return next(g for g in call(f'players/{player}')['games'] if g['slug']==game)
for player in body['p1'],body['p2']:
 profile=profile_game(player)
 assert profile['rating_history']['singles'][-1]['elo']==profile['elo']
 assert profile['rating_stats']['singles']['rank']>=1
 assert profile['rating_stats']['singles']['peak']>=profile['elo']
before=profile_game(body['p1'])['elo']
call(f'matches/{match["id"]}',{**body,'sets':[{'a':1,'b':6}]},'PUT')
profile=profile_game(body['p1'])
assert profile['ratings_dirty'] and not profile['rating_history']['singles']
assert profile['elo']==before
call(f'games/{game}/ratings/update',{})
profile=profile_game(body['p1'])
assert not profile['ratings_dirty']
assert profile['rating_history']['singles'][-1]['elo']==profile['elo']
participant=call('users',{'name':'UI participant','username':'uiparticipant','password':'Participant123'})['id']
pending=call(f'games/{game}/matches',{**body,'p1':participant})
call('login',{'username':'uiparticipant','password':'Participant123'})
permissions=call(f'matches/{pending["id"]}')
assert permissions['can_edit'] and not permissions['can_delete']
call(f'matches/{pending["id"]}',method='DELETE',status=403)
print('PASS exact game counts, partner membership, search, pagination, legacy responses, published profile charts and correction boundary')
