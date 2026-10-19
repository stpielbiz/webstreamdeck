# Add rugby to "Game on" search

## What you'll see
- Searching a rugby team such as **Springboks**, **All Blacks**, **Wallabies**, **Bulls** or **Stormers** shows the same "Game on" card: matchup, start time, the networks and suggested channels from your playlist.
- Covered: Rugby World Cup, The Rugby Championship, International Tests (incl. autumn/summer tours), Six Nations, United Rugby Championship, Gallagher Premiership, Super Rugby Pacific.
- Rugby nicknames work: Springboks/Boks → South Africa, All Blacks → New Zealand, Wallabies → Australia, Pumas → Argentina, plus the national team names.
- When the schedule doesn't list rugby networks, the usual ones are added as suggestions: SuperSport, Sky Sport, Stan Sport, TNT Sports, Premier Sports, FloRugby, Peacock, ITV, BBC.

## Technical details
- `game-broadcasts.functions.ts`: add ESPN rugby leagues (ids 164205, 244293, 289234, 180659, 270557, 267979, 242041) with league label "Rugby"; extend NICKNAMES with rugby aliases; add default rugby broadcaster list when broadcasts are empty.
- `channel-suggest.ts`: add aliases for SuperSport (incl. "ss rugby", "supersport rugby"), Sky Sport NZ, Stan Sport, TNT Sports, Premier Sports; league fallback also matches "rugby".
- Extend the matcher test with a Springboks case (SuperSport Rugby / Sky Sport channels matched).
