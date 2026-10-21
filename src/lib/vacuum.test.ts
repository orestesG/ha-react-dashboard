import { describe, expect, it } from 'vitest'
import {
  allSegments,
  buildAutomationConfig,
  buildCleanSegmentData,
  buildScriptConfig,
  findRoomModeEntities,
  findSlotConflicts,
  normalizeSlot,
  orderBySequence,
  parseTimes,
  sameConfig,
  slotsToScheduleDays,
  statusLabel,
  toScriptVariables,
  toSuctionKey,
  type ScheduleSlot,
} from './vacuum'

const slot = (patch: Partial<ScheduleSlot>): ScheduleSlot => ({
  id: 's1', days: [0], time: '15:00', enabled: true, sweepOnly: false, ...patch,
})

describe('normalizeSlot', () => {
  it('migrates a v3 sweep slot with overrides', () => {
    expect(normalizeSlot({
      id: 'a', days: [1, 4], time: '15:00', preset: 'sweep', enabled: true,
      suctionOverride: 'Turbo', vacuumPasses: 2, mopPasses: 3,
    })).toEqual({ id: 'a', days: [1, 4], time: '15:00', enabled: true, sweepOnly: true, suction: 'turbo', passes: 2 })
  })

  it('migrates a v3 full slot without overrides', () => {
    expect(normalizeSlot({ id: 'b', days: [0, 3], time: '15:00', preset: 'full', enabled: true }))
      .toEqual({ id: 'b', days: [0, 3], time: '15:00', enabled: true, sweepOnly: false })
  })

  it('keeps v4 slots as they are', () => {
    const v4 = { id: 'c', days: [5], time: '09:30', enabled: false, sweepOnly: true, suction: 'quiet', passes: 1 }
    expect(normalizeSlot(v4)).toEqual(v4)
  })

  it('rejects malformed data', () => {
    expect(normalizeSlot(null)).toBeNull()
    expect(normalizeSlot({ id: 1, days: [], time: '10:00' })).toBeNull()
  })
})

describe('slotsToScheduleDays', () => {
  it('builds 1-minute blocks carrying the slot overrides as data', () => {
    const days = slotsToScheduleDays([slot({ id: 'x', days: [0, 2], sweepOnly: true, suction: 'strong', passes: 2 })])
    const expected = { from: '15:00:00', to: '15:01:00', data: { slot_id: 'x', sweep_only: true, suction: 2, passes: 2 } }
    expect(days.monday).toEqual([expected])
    expect(days.wednesday).toEqual([expected])
    expect(days.tuesday).toEqual([])
  })

  it('uses -1 / 0 when the slot follows each room config', () => {
    expect(slotsToScheduleDays([slot({})]).monday[0].data).toMatchObject({ sweep_only: false, suction: -1, passes: 0 })
  })

  it('ends a 23:59 slot at 24:00:00 instead of dropping it', () => {
    expect(slotsToScheduleDays([slot({ time: '23:59' })]).monday[0].to).toBe('24:00:00')
  })

  it('skips disabled slots and sorts blocks by time', () => {
    const days = slotsToScheduleDays([
      slot({ id: 'late', time: '18:00' }),
      slot({ id: 'off', time: '07:00', enabled: false }),
      slot({ id: 'early', time: '09:00' }),
    ])
    expect(days.monday.map((b) => b.data.slot_id)).toEqual(['early', 'late'])
  })
})

describe('findSlotConflicts', () => {
  it('flags enabled slots sharing day and time', () => {
    expect(findSlotConflicts([
      slot({ id: 'a', days: [0, 1] }),
      slot({ id: 'b', days: [1] }),
      slot({ id: 'c', days: [1], enabled: false }),
      slot({ id: 'd', days: [1], time: '16:00' }),
    ]).sort()).toEqual(['a', 'b'])
  })
})

describe('run options', () => {
  it('maps overrides to script variables', () => {
    expect(toScriptVariables({ sweepOnly: false })).toEqual({ segments: [], sweep_only: false, suction: -1, passes: 0 })
    expect(toScriptVariables({ sweepOnly: true, suction: 'turbo', passes: 3 }, [4, 2]))
      .toEqual({ segments: [4, 2], sweep_only: true, suction: 3, passes: 3 })
  })

  it('sends empty lists so each room keeps its customized settings', () => {
    expect(buildCleanSegmentData([4, 2], {})).toEqual({ segments: [4, 2], repeats: [], suction_level: [], water_volume: [] })
    expect(buildCleanSegmentData([1], { suction: 'quiet', passes: 2 })).toEqual({ segments: [1], repeats: 2, suction_level: 0, water_volume: [] })
  })
})

describe('rooms', () => {
  const attrs = {
    selected_map: 'Map 2',
    cleaning_sequence: [4, 2, 1, 6, 3, 5],
    rooms: { 'Map 1': [{ id: 9, name: 'x' }], 'Map 2': [1, 2, 3, 4, 5, 6].map((id) => ({ id, name: `r${id}` })) },
  }

  it('orders by cleaning sequence, unknown ids last', () => {
    expect(orderBySequence([1, 7, 2, 4], [4, 2, 1])).toEqual([4, 2, 1, 7])
    expect(orderBySequence([3, 1], undefined)).toEqual([3, 1])
  })

  it('lists every room of the selected map in cleaning order', () => {
    expect(allSegments(attrs)).toEqual([4, 2, 1, 6, 3, 5])
  })

  it('finds per-room cleaning mode selects sorted by room id', () => {
    expect(findRoomModeEntities('robot', [
      'select.robot_room_10_cleaning_mode', 'select.robot_room_2_cleaning_mode',
      'select.robot_room_2_suction_level', 'select.robot_cleaning_mode',
    ])).toEqual(['select.robot_room_2_cleaning_mode', 'select.robot_room_10_cleaning_mode'])
  })
})

describe('parsers and labels', () => {
  it('parses cleaning times and suction names', () => {
    expect(parseTimes('2x')).toBe(2)
    expect(parseTimes('unavailable')).toBeUndefined()
    expect(toSuctionKey('silent')).toBe('quiet')
    expect(toSuctionKey('Standard')).toBe('standard')
    expect(toSuctionKey('unavailable')).toBeUndefined()
  })

  it('translates robot statuses', () => {
    expect(statusLabel('sleeping')).toBe('En reposo')
    expect(statusLabel('Room cleaning')).toBe('Limpiando habitaciones')
    expect(statusLabel('some_new_state')).toBe('Some new state')
  })
})

describe('generated HA config', () => {
  const v = 'vacuum.robot'

  it('script only includes the sweep-only branches when room selects exist', () => {
    const withRooms = buildScriptConfig({ vacuumEntity: v, roomModeEntities: ['select.robot_room_1_cleaning_mode'], backupSceneId: 'bk' })
    const noRooms   = buildScriptConfig({ vacuumEntity: v, roomModeEntities: [], backupSceneId: 'bk' })
    expect(withRooms.sequence).toHaveLength(4)
    expect(noRooms.sequence).toHaveLength(2)
    expect(JSON.stringify(withRooms)).toContain('scene.bk')
  })

  it('automation forwards block data to the script', () => {
    const a = buildAutomationConfig({ id: '1', scheduleEntity: 'schedule.s', vacuumEntity: v, scriptEntity: 'script.x' })
    expect(a.triggers[0]).toEqual({ trigger: 'state', entity_id: 'schedule.s', to: 'on' })
    expect(a.actions[0].data.variables.suction).toContain('trigger.to_state.attributes.suction')
  })

  it('compares configs ignoring key order', () => {
    expect(sameConfig({ a: 1, b: [{ c: 2, d: 3 }] }, { b: [{ d: 3, c: 2 }], a: 1 })).toBe(true)
    expect(sameConfig({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(sameConfig([1, 2], [2, 1])).toBe(false)
  })
})
