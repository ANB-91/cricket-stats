import { useState, useEffect, useMemo, Fragment } from 'react'
import './App.css'

const COUNTY_ABBR = {
  'Derbyshire':'DER','Durham':'DUR','Essex':'ESS','Glamorgan':'GLA',
  'Gloucestershire':'GLO','Hampshire':'HAM','Kent':'KEN','Lancashire':'LAN',
  'Leicestershire':'LEI','Middlesex':'MID','Northamptonshire':'NOR',
  'Nottinghamshire':'NOT','Somerset':'SOM','Surrey':'SUR','Sussex':'SUS',
  'Warwickshire':'WAR','Worcestershire':'WOR','Yorkshire':'YKS',
}

const BAT_COLS = [
  { key:'player',      label:'Player', align:'left',  sortType:'str'  },
  { key:'team',        label:'County', align:'left',  sortType:'str'  },
  { key:'innings',     label:'Inn',    align:'right', sortType:'num'  },
  { key:'runs',        label:'Runs',   align:'right', sortType:'num'  },
  { key:'not_outs',    label:'NO',     align:'right', sortType:'num'  },
  { key:'average',     label:'Avg',    align:'right', sortType:'num'  },
  { key:'strike_rate', label:'SR',     align:'right', sortType:'num'  },
  { key:'balls',       label:'Balls',  align:'right', sortType:'num'  },
  { key:'highest',     label:'HS',     align:'right', sortType:'hs'   },
  { key:'hundreds',    label:'100s',   align:'right', sortType:'num'  },
  { key:'fifties',     label:'50s',    align:'right', sortType:'num'  },
  { key:'fours',       label:'4s',     align:'right', sortType:'num'  },
  { key:'sixes',       label:'6s',     align:'right', sortType:'num'  },
]

const BOWL_COLS = [
  { key:'player',      label:'Player', align:'left',  sortType:'str'  },
  { key:'team',        label:'County', align:'left',  sortType:'str'  },
  { key:'wickets',     label:'Wkts',   align:'right', sortType:'num'  },
  { key:'overs',       label:'Overs',  align:'right', sortType:'num'  },
  { key:'runs',        label:'Runs',   align:'right', sortType:'num'  },
  { key:'maidens',     label:'Mdns',   align:'right', sortType:'num'  },
  { key:'average',     label:'Avg',    align:'right', sortType:'num'  },
  { key:'economy',     label:'Econ',   align:'right', sortType:'num'  },
  { key:'strike_rate', label:'SR',     align:'right', sortType:'num'  },
  { key:'best',        label:'Best',   align:'right', sortType:'best' },
  { key:'five_wkt',    label:'5WI',    align:'right', sortType:'num'  },
  { key:'four_wkt',    label:'4WI',    align:'right', sortType:'num'  },
]

const DISM_ABBREV = {
  'bowled':'B','caught':'C','caught and bowled':'C&B',
  'lbw':'LBW','stumped':'St','run out':'RO','hit wicket':'HW',
}

function abbrevDism(k) { return DISM_ABBREV[k] || k }

function splitTeams(teamStr) {
  return (teamStr || '').split(',').map(t => t.trim()).filter(Boolean)
}

function abbrevTeam(teamStr) {
  return [...new Set(splitTeams(teamStr))].map(t => COUNTY_ABBR[t] || t).join(' · ')
}

function getSortVal(row, col) {
  const v = row[col.key]
  if (col.sortType === 'str')  return (v || '').toLowerCase()
  if (col.sortType === 'num')  return v == null ? -Infinity : parseFloat(v) || 0
  if (col.sortType === 'hs')   return parseInt(v) || 0
  if (col.sortType === 'best') {
    if (!v || v === '-') return -Infinity
    const [w, r] = v.split('/').map(Number)
    return w * 1000 - (r || 0)
  }
  return v
}

// Remap a row's stats to its home or away sub-object
function applyVenue(row, venueType, tab) {
  if (venueType === 'all') return row
  const ha = row[venueType] || {}
  if (tab === 'batting') {
    return { ...row,
      innings: ha.innings ?? 0, runs: ha.runs ?? 0, balls: ha.balls ?? 0,
      dismissals: ha.dismissals ?? 0, not_outs: ha.not_outs ?? 0,
      average: ha.average ?? null, strike_rate: ha.strike_rate ?? null,
      highest: ha.highest || '0', fifties: ha.fifties ?? 0, hundreds: ha.hundreds ?? 0,
      fours: ha.fours ?? 0, sixes: ha.sixes ?? 0,
    }
  } else {
    return { ...row,
      balls: ha.balls ?? 0, overs: ha.overs || '0.0', runs: ha.runs ?? 0,
      wickets: ha.wickets ?? 0, maidens: ha.maidens ?? 0,
      average: ha.average ?? null, economy: ha.economy ?? null,
      strike_rate: ha.strike_rate ?? null,
    }
  }
}

function aggregateBatting(rows) {
  const map = new Map()
  for (const r of rows) {
    if (!map.has(r.player)) {
      map.set(r.player, {
        player: r.player, _teams: new Set(),
        innings:0,runs:0,balls:0,dismissals:0,not_outs:0,
        fours:0,sixes:0,fifties:0,hundreds:0,_hsNum:0,highest:'0',
        dismissal_types:{},
        home:{innings:0,runs:0,balls:0,dismissals:0,not_outs:0,fours:0,sixes:0,fifties:0,hundreds:0,_hsNum:0,highest:'0'},
        away:{innings:0,runs:0,balls:0,dismissals:0,not_outs:0,fours:0,sixes:0,fifties:0,hundreds:0,_hsNum:0,highest:'0'},
      })
    }
    const e = map.get(r.player)
    for (const t of splitTeams(r.team)) e._teams.add(t)
    e.innings+=r.innings; e.runs+=r.runs; e.balls+=r.balls
    e.dismissals+=r.dismissals; e.not_outs+=r.not_outs
    e.fours+=r.fours; e.sixes+=r.sixes; e.fifties+=r.fifties; e.hundreds+=r.hundreds
    const n = parseInt(r.highest)||0
    if (n>e._hsNum) { e._hsNum=n; e.highest=r.highest }
    for (const [k,v] of Object.entries(r.dismissal_types||{}))
      e.dismissal_types[k]=(e.dismissal_types[k]||0)+v
    // Aggregate home/away
    for (const side of ['home','away']) {
      const rha=r[side]||{}; const eha=e[side]
      eha.innings+=rha.innings||0; eha.runs+=rha.runs||0; eha.balls+=rha.balls||0
      eha.dismissals+=rha.dismissals||0; eha.not_outs+=rha.not_outs||0
      eha.fours+=rha.fours||0; eha.sixes+=rha.sixes||0
      eha.fifties+=rha.fifties||0; eha.hundreds+=rha.hundreds||0
      const hn=parseInt(rha.highest)||0
      if (hn>eha._hsNum) { eha._hsNum=hn; eha.highest=rha.highest||'0' }
    }
  }
  return [...map.values()].map(e => {
    for (const side of ['home','away']) {
      const ha=e[side]
      ha.average     = ha.dismissals ? +(ha.runs/ha.dismissals).toFixed(2)  : null
      ha.strike_rate = ha.balls      ? +(ha.runs/ha.balls*100).toFixed(2)   : null
    }
    return { ...e, team:[...e._teams].join(', '),
      average:     e.dismissals ? +(e.runs/e.dismissals).toFixed(2)  : null,
      strike_rate: e.balls      ? +(e.runs/e.balls*100).toFixed(2)   : null }
  })
}

function aggregateBowling(rows) {
  const map = new Map()
  for (const r of rows) {
    if (!map.has(r.player)) {
      map.set(r.player, {
        player:r.player, _teams:new Set(),
        balls:0,runs:0,wickets:0,maidens:0,five_wkt:0,four_wkt:0,
        _bestW:0,_bestR:9999,best:'-',dismissal_types:{},
        home:{balls:0,runs:0,wickets:0,maidens:0},
        away:{balls:0,runs:0,wickets:0,maidens:0},
      })
    }
    const e = map.get(r.player)
    for (const t of splitTeams(r.team)) e._teams.add(t)
    e.balls+=r.balls; e.runs+=r.runs; e.wickets+=r.wickets
    e.maidens+=r.maidens; e.five_wkt+=r.five_wkt; e.four_wkt+=r.four_wkt
    if (r.best!=='-') {
      const [w,rv]=r.best.split('/').map(Number)
      if (w>e._bestW||(w===e._bestW&&rv<e._bestR)) { e._bestW=w;e._bestR=rv;e.best=r.best }
    }
    for (const [k,v] of Object.entries(r.dismissal_types||{}))
      e.dismissal_types[k]=(e.dismissal_types[k]||0)+v
    for (const side of ['home','away']) {
      const rha=r[side]||{}; const eha=e[side]
      eha.balls+=rha.balls||0; eha.runs+=rha.runs||0
      eha.wickets+=rha.wickets||0; eha.maidens+=rha.maidens||0
    }
  }
  return [...map.values()].map(e => {
    for (const side of ['home','away']) {
      const ha=e[side]
      ha.overs=`${Math.floor(ha.balls/6)}.${ha.balls%6}`
      ha.average     = ha.wickets ? +(ha.runs/ha.wickets).toFixed(2)   : null
      ha.economy     = ha.balls   ? +(ha.runs/ha.balls*6).toFixed(2)   : null
      ha.strike_rate = ha.wickets ? +(ha.balls/ha.wickets).toFixed(2)  : null
    }
    return { ...e, team:[...e._teams].join(', '),
      overs:`${Math.floor(e.balls/6)}.${e.balls%6}`,
      average:     e.wickets ? +(e.runs/e.wickets).toFixed(2)   : null,
      economy:     e.balls   ? +(e.runs/e.balls*6).toFixed(2)   : null,
      strike_rate: e.wickets ? +(e.balls/e.wickets).toFixed(2)  : null }
  })
}

export default function App() {
  const [tab,       setTab]    = useState('batting')
  const [batting,   setBat]    = useState([])
  const [bowling,   setBowl]   = useState([])
  const [meta,      setMeta]   = useState(null)
  const [loading,   setLoad]   = useState(true)
  const [fromYear,  setFrom]   = useState('')
  const [toYear,    setTo]     = useState('')
  const [team,      setTeam]   = useState('All')
  const [venueType, setVenue]  = useState('all')
  const [search,    setSearch] = useState('')
  const [sortCol,   setSort]   = useState('runs')
  const [sortDir,   setDir]    = useState('desc')
  const [expanded,  setExp]    = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/data/batting.json').then(r => r.json()),
      fetch('/data/bowling.json').then(r => r.json()),
      fetch('/data/metadata.json').then(r => r.json()),
    ]).then(([bat,bowl,m]) => { setBat(bat);setBowl(bowl);setMeta(m);setLoad(false) })
  }, [])

  useEffect(() => {
    setSort(tab==='batting' ? 'runs' : 'wickets')
    setDir('desc'); setExp(null)
  }, [tab])

  const cols    = tab==='batting' ? BAT_COLS : BOWL_COLS
  const rawData = tab==='batting' ? batting  : bowling
  const seasons = meta?.seasons || []

  const displayed = useMemo(() => {
    let data = rawData
    if (fromYear||toYear) {
      data = rawData.filter(r => {
        if (fromYear && r.season < fromYear) return false
        if (toYear   && r.season > toYear)   return false
        return true
      })
    }
    if (team !== 'All')
      data = data.filter(r => splitTeams(r.team).includes(team))
    const isSingle = fromYear && toYear && fromYear === toYear
    if (!isSingle)
      data = tab==='batting' ? aggregateBatting(data) : aggregateBowling(data)
    // Apply home/away view
    if (venueType !== 'all')
      data = data.map(row => applyVenue(row, venueType, tab))
    if (search.trim())
      data = data.filter(r => r.player.toLowerCase().includes(search.trim().toLowerCase()))
    const col = cols.find(c => c.key===sortCol)
    if (col) data = [...data].sort((a,b) => {
      const av=getSortVal(a,col), bv=getSortVal(b,col)
      return av<bv ? (sortDir==='asc'?-1:1) : av>bv ? (sortDir==='asc'?1:-1) : 0
    })
    return data
  }, [rawData,fromYear,toYear,team,venueType,search,sortCol,sortDir,cols,tab])

  function toggleSort(key) {
    if (sortCol===key) setDir(d => d==='asc'?'desc':'asc')
    else { setSort(key); setDir('desc') }
  }

  const fmt = v => (v===null||v===undefined) ? '—' : v
  const toOptions = fromYear ? seasons.filter(s => s>=fromYear) : seasons

  if (loading) return <div className="loading">Loading cricket data…</div>

  return (
    <div className="app">
      <header>
        <div>
          <h1>County Cricket Stats</h1>
          <p className="subtitle">County Championship · 2014–2026</p>
        </div>
        {meta?.last_updated && <p className="updated">Data updated: {meta.last_updated}</p>}
      </header>

      <main>
        <div className="tabs">
          <button className={tab==='batting'?'active':''} onClick={() => setTab('batting')}>Batting</button>
          <button className={tab==='bowling'?'active':''} onClick={() => setTab('bowling')}>Bowling</button>
        </div>

        <div className="filters">
          <div className="filter-range">
            <span className="filter-range-label">Seasons</span>
            <div className="filter-range-inputs">
              <select value={fromYear} onChange={e => { setFrom(e.target.value); if (toYear&&e.target.value>toYear) setTo('') }}>
                <option value="">All time</option>
                {seasons.map(s => <option key={s}>{s}</option>)}
              </select>
              <span className="range-arrow">→</span>
              <select value={toYear} onChange={e => setTo(e.target.value)}>
                <option value="">All time</option>
                {toOptions.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <label>County
            <select value={team} onChange={e => setTeam(e.target.value)}>
              <option value="All">All counties</option>
              {(meta?.teams||[]).map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
          <div className="filter-group">
            <span className="filter-group-label">Venue</span>
            <div className="seg">
              {[['all','All'],['home','Home'],['away','Away']].map(([v,label]) => (
                <button key={v} className={venueType===v?'active':''} onClick={() => setVenue(v)}>{label}</button>
              ))}
            </div>
          </div>
          <label>Player
            <input type="search" placeholder="Search…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </label>
          <span className="count">{displayed.length} players</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {cols.map(c => (
                  <th key={c.key}
                    className={[c.align==='right'?'r':'l',sortCol===c.key?'act':'',c.key==='player'?'pin':''].join(' ')}
                    onClick={() => toggleSort(c.key)}>
                    {c.label}{sortCol===c.key && <span>{sortDir==='asc'?' ↑':' ↓'}</span>}
                  </th>
                ))}
                <th className="l dh">{tab==='batting'?'How dismissed':'Wicket types'}</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((row,i) => (
                <Fragment key={`${row.player}-${i}`}>
                  <tr className={expanded===i?'sel':''} onClick={() => setExp(expanded===i?null:i)}>
                    {cols.map(c => (
                      <td key={c.key} className={[c.align==='right'?'r':'l',c.key==='player'?'pin':''].join(' ')}>
                        {c.key==='team'
                          ? <span title={row.team}>{abbrevTeam(row.team)}</span>
                          : fmt(row[c.key])}
                      </td>
                    ))}
                    <td>
                      {Object.entries(row.dismissal_types||{})
                        .sort(([,a],[,b])=>b-a).slice(0,3)
                        .map(([k,v]) => <span key={k} className="tag">{abbrevDism(k)} {v}</span>)}
                    </td>
                  </tr>
                  {expanded===i && (
                    <tr className="det-row">
                      <td colSpan={cols.length+1}>
                        <div className="det">
                          <strong>{tab==='batting'?'Dismissed by:':'Wickets taken:'}</strong>
                          {Object.entries(row.dismissal_types||{})
                            .sort(([,a],[,b])=>b-a)
                            .map(([k,v]) => <span key={k}>{k}: <strong>{v}</strong></span>)}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}