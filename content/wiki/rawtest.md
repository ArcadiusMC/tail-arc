---
title: "infinite-run.ts"
type: rawfile
---
```ts

interface Struct {
  min: VectorI
  size: VectorI
}

class VectorI {
  x: number
  y: number
  z: number

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x
    this.y = y
    this.z = z
  }

  add(o: VectorI): VectorI {
    return new VectorI(this.x + o.x, this.y + o.y, this.z + o.z)
  }

  sub(o: VectorI): VectorI {
    return new VectorI(this.x - o.x, this.y - o.y, this.z - o.z)
  }

  mul(num: number): VectorI {
    return new VectorI(this.x * num, this.y * num, this.z * num)
  }

  copy(): VectorI {
    return new VectorI(this.x, this.y, this.z)
  }

  distanceSq(o: VectorI): number {
    return ((this.x - o.x) ** 2) + ((this.y - o.y) ** 2) + ((this.z - o.z) ** 2)
  }

  distance(o: VectorI): number {
    return Math.sqrt(this.distanceSq(o))
  }
}

// =============================================================================
// Constants
// =============================================================================

// Const declarations of values that exist in the script
declare const server: any
declare const logger: any
declare const Packages: any
declare const events: any
declare const scheduler: any
declare const arcServer: any
declare function sendMessage(target: any, message: any): void

// Positional constants
const ARENAS_START = new VectorI(-244, -51, 1045)
const ARENAS_DIF = new VectorI(0, 0, 20)
const SPAWN_OFFSET = new VectorI(4.5, 13, 4.5)
const START_OFFSET = new VectorI(-2, 12, 4)

// Jump platform sideways variance
const MIN_SIDEWAYS_OFF = -2
const MAX_SIDEWAYS_OFF = 2

// Minimum distance between 2 jump platforms
const MIN_POINT_DIF = 3
const MIN_POINT_DIF_SQ = MIN_POINT_DIF ** 2

// World
const WORLD_NAME = "void"
const WORLD = server.getWorld(WORLD_NAME)

const OBJECTIVE_NAME = "run_times"
const LEAVE_CMD_ID = "random_run_event"

// =============================================================================
// Entry management
// =============================================================================
// Manages the players in the event, keeps track of their scores and other such
// data.
// =============================================================================

class EventManager {
  private readonly entries: {[key: string]: EventEntry}
  private readonly arenas: Arena[]

  constructor() {
    this.entries = {}
    this.arenas = []
  }

  getEntry(playerId: string): EventEntry | undefined {
    return this.entries[playerId]
  }

  /**
   * Finds a free arena.
   * 
   * Does this by going through all the arenas and seeing if any are free,
   * if one is, that one is returned, otherwise a new arena is created
   * and then returned.
   * 
   * @returns A free arena
   */
  private findFreeArena(): Arena {
    // Go through arenas
    for (let i = 0; i < this.arenas.length; i++) {
      let arena = this.arenas[i]

      // No idea how this would happen but yknow, 
      // TS be mad at me cuz it COULD be null
      if (arena == null) {
        arena = new Arena(i, ARENAS_START.add(ARENAS_DIF.mul(i)))
        arena.free = true
        this.arenas[i] = arena
        return arena
      }

      if (!arena.free) {
        continue
      }

      return arena
    }

    // Create a new arena
    let idx = this.arenas.length
    let pos = ARENAS_START.add(ARENAS_DIF.mul(idx))
    let arena = new Arena(idx, pos)

    arena.free = true

    this.arenas.push(arena)

    return arena
  }

  enterEvent(player: any): boolean {
    let id: string = player.uniqueId
    let entry = this.getEntry(id)

    // If player is already in event
    if (entry != null) {
      logger.warn("Player {} is already in the event", player)
      return false
    }

    let arena: Arena = this.findFreeArena()

    entry = new EventEntry(player, arena)

    this.entries[id] = entry
    arena.free = false

    generateRoom(arena.position, WORLD)

    // Teleport player inside, but do it in a way that avoids 
    // us calling the location constructor, cuz I can't be 
    // fucked to import it
    let loc = player.location
    loc.setWorld(WORLD)
    loc.setX(arena.spawnPosition.x)
    loc.setY(arena.spawnPosition.y)
    loc.setZ(arena.spawnPosition.z)
    loc.setYaw(-90)
    loc.setPitch(0)

    player.teleport(loc)

    return true
  }

  exitEvent(entry: EventEntry): boolean {
    if (entry == null) {
      return false
    }

    let player = entry.player
    let playerId = player.uniqueId
    let arena = entry.arena

    // Delete entry and free arena
    delete this.entries[playerId]
    arena.free = true

    // Teleport player out
    let loc = player.location
    loc.setWorld(WORLD)
    loc.setX(-217.5)
    loc.setY(-44)
    loc.setZ(991.5)

    player.teleport(loc)

    // Score calculation
    let playerName = player.getName()
    let score = entry.score
    let record = getScore(playerName)

    // The amount of times I've written the exact letters "score > record"
    // over the past few years is insane, and I am not mentally well
    if (score > record) {
      setScore(playerName, score)
      sendMessage(player, `&e&lNew record! &7Score: ${score}`)
    } else {
      sendMessage(player, `&7Score: ${score}`)
    }

    return true
  }
}

class Arena {
  readonly position: VectorI
  readonly spawnPosition: VectorI

  readonly index: number

  free: boolean = true

  constructor(ix: number, pos: VectorI) {
    this.index = ix
    this.position = pos
    this.spawnPosition = pos.add(SPAWN_OFFSET)
  }
}

class EventEntry {
  readonly player: any
  readonly arena: Arena

  checkpoint: VectorI | null
  score: number = 0

  constructor(player: any, arena: Arena) {
    this.player = player
    this.arena = arena
    this.checkpoint = null
  }
}

const eventManger = new EventManager()

// =============================================================================
// Generation
// =============================================================================

const COPY_POSITIONS = {
  // Start room
  head: {
    min: new VectorI(-250, -51, 1001),
    size: new VectorI(8, 22, 9)
  },

  // Connector piece
  pillar_piece: {
    min: new VectorI(-250, -51, 981),
    size: new VectorI(1, 22, 9)
  },

  // Room pieces
  three_piece: { // This is basically not used
    min: new VectorI(-250, -51, 971),
    size: new VectorI(3, 22, 9)
  },
  five_piece: {
    min: new VectorI(-250, -51, 961),
    size: new VectorI(5, 22, 9)
  },

  // End
  tail: {
    min: new VectorI(-250, -51, 991),
    size: new VectorI(8, 22, 9)
  }
}

function copyArea(copyPos: Struct, destPos: VectorI, world: any): void {
  let size:   VectorI = copyPos.size
  let min:    VectorI = copyPos.min
  let end:    VectorI = min.add(size)
  let offset: VectorI = destPos.sub(min)

  for (let x = min.x; x < end.x; x++) {
    for (let y = min.y; y < end.y; y++) {
      for (let z = min.z; z < end.z; z++) {
        let copyBlock: any = world.getBlockAt(x, y, z)
        let destPos = new VectorI(x, y, z).add(offset)

        let destBlock = world.getBlockAt(destPos.x, destPos.y, destPos.z)
        let copyState = copyBlock.blockData

        destBlock.setBlockData(copyState, false)
      }
    }
  }

}

function generateRoom(pos: VectorI, world: any): boolean {
  let head: Struct = COPY_POSITIONS.head
  let tail: Struct = COPY_POSITIONS.tail

  let destPos: VectorI = pos.copy()

  // Generate starting part
  copyArea(head, destPos, world)
  destPos.x += head.size.x

  // Generate jump path
  let jumpPath = genJumpPath(20)

  // Very unlikely, but idk, could happen
  if (jumpPath == null) {
    return false
  }

  let jumpStart = START_OFFSET.add(destPos)
  let jumpBlock = server.createBlockData("minecraft:sea_lantern")
  let fillBlock = server.createBlockData("minecraft:gray_concrete")

  // Get how many 5 piece rooms are needed to accommodate the jump path
  // and then place that many rooms
  let roomCount = getRoomCount(jumpPath)
  let room = COPY_POSITIONS.five_piece
  let pillar = COPY_POSITIONS.pillar_piece

  for (let i = 0; i < roomCount; i++) {
    if (i != 0) {
      copyArea(pillar, destPos, world)
      destPos.x += pillar.size.x
    }

    copyArea(room, destPos, world)
    destPos.x += room.size.x
  }

  // Generate the jump path itself
  for (let ix in jumpPath) {
    let point = jumpPath[ix]

    if (point == undefined) {
      continue
    }

    point.x += jumpStart.x
    point.y += jumpStart.y
    point.z += jumpStart.z

    let b = world.getBlockAt(point.x, point.y, point.z)
    b.setBlockData(jumpBlock, false)

    fillUnder(point, world, fillBlock)
  }

  copyArea(tail, destPos, world)
  return true
}

function fillUnder(pos: VectorI, world: any, fillBlock: any): void {
  let p = pos.copy()
  p.y--

  while (p.y > -64) {
    let block = world.getBlockAt(p.x, p.y, p.z)

    if (!block.type.isAir()) {
      break
    }

    block.setBlockData(fillBlock, false)
    p.y--
  }
}

function getRoomCount(jumps: VectorI[]): number {
  // If I was intelligent, this would also take the 3 piece 
  // rooms into consideration, but literally who gives a f-
  let mostDistant: number = jumps[jumps.length - 1]?.x ?? 0;
  return Math.floor(mostDistant / 6)
}

function randomInt(min: number = 0, max: number = 10) {
  let dif = max - min
  let r = Math.random() * dif
  return r + min
}

function genJumpPath(maxlen: number = 10): VectorI[] | null {
  let arr: VectorI[] = []

  let genAttempts = 0
  const maxGenAttempts = 1024

  let lastPos = new VectorI()
  let currentPos = new VectorI()

  outer: while (arr.length < maxlen && genAttempts < maxGenAttempts) {
    genAttempts++

    let forwardsOffset = randomInt(2, 4)

    currentPos.x = lastPos.x + forwardsOffset
    currentPos.y = lastPos.y
    currentPos.z = randomInt(MIN_SIDEWAYS_OFF, MAX_SIDEWAYS_OFF) + lastPos.z

    // While the Z coordinate is out of bounds or while the Z coordinate 
    // matches the last point's Z position. This ensures the sideways sway
    // of the platforms never ends up outside the room, or in the walls
    while (currentPos.z < MIN_SIDEWAYS_OFF || currentPos.z > MAX_SIDEWAYS_OFF || currentPos.z == lastPos.z) {
      genAttempts++
      currentPos.z = lastPos.z + randomInt(MIN_SIDEWAYS_OFF, MAX_SIDEWAYS_OFF)

      if (genAttempts > maxGenAttempts) {
        break outer
      }
    }

    // 1 or 2 block distances between blocks are annoying to jump across
    // and end up getting in the way of the groove
    if (currentPos.distanceSq(lastPos) < MIN_POINT_DIF_SQ) {
      continue
    }

    arr.push(currentPos.copy())

    lastPos.x = currentPos.x
    lastPos.y = 0
    lastPos.z = currentPos.z
  }

  if (genAttempts > maxGenAttempts) {
    return null
  }

  return arr
}

// =============================================================================
// Scoreboard
// =============================================================================
// Stuff just handles the scoreboard objectives, yo.
//
// There is a 'scoreboards' module I could've used for this, but with Typescript
// it's easier to just use the bukkit functions.
// =============================================================================

function getObjective(): any {
  let scoreboard = server.scoreboardManager.mainScoreboard
  let obj = scoreboard.getObjective(OBJECTIVE_NAME)

  if (obj == null) {
    obj = scoreboard.registerNewObjective(OBJECTIVE_NAME, "dummy", "Run Times")
  }

  return obj
}

function getScore(playerName: string): number {
  let obj = getObjective()
  return obj.getScore(playerName).score
}

function setScore(playerName: string, score: number): void {
  let obj = getObjective();
  obj.getScore(playerName).score = score
}

// =============================================================================
// Event Listeners
// =============================================================================
// Standard event stuff, listens to player deaths (exits the event), to players
// leaving the server (exits the events) and players moving.
// 
// Player movement triggers some additional logic.
// =============================================================================

function onPlayerDeath(event: any): void {
  let entry = eventManger.getEntry(event.entity.toString())

  if (entry == undefined) {
    return
  }

  eventManger.exitEvent(entry)
}

function onPlayerLeave(event: any): void {
  let entry = eventManger.getEntry(event.player.uniqueId.toString())

  if (entry == undefined) {
    return
  }

  eventManger.exitEvent(entry)
}

function onPlayerMove(event: any): void {
  let player = event.player
  let entry: EventEntry | undefined = eventManger.getEntry(player.uniqueId.toString())

  if (entry == null) {
    return
  }

  let to = event.to

  // If we fell off
  if (to.getY() < -46) {
    let spawnPos: VectorI;

    if (entry.checkpoint == null) {
      spawnPos = entry.arena.spawnPosition
    } else {
      spawnPos = entry.checkpoint
    }
    
    to.setX(spawnPos.x)
    to.setY(spawnPos.y)
    to.setZ(spawnPos.z)

    event.to = to
    return
  }

  let below = to.block.getRelative(0, -1, 0)
  let belowId = below.type.key().value()

  // We're stepping on a sea lantern -> set checkpoint for when we fall off
  if (belowId == "sea_lantern") {
    let pos = new VectorI(below.x + 0.5, below.y + 1, below.z + 0.5)
    entry.checkpoint = pos
    return
  } 
  
  // We stepped on the diamond block at the end of a level,
  // generate new level and TP us back to start.
  if (belowId == "diamond_block") {
    let arena = entry.arena
    let spawn = arena.spawnPosition

    generateRoom(arena.position, WORLD)

    to.setX(spawn.x)
    to.setY(spawn.y)
    to.setZ(spawn.z)

    event.to = to
    entry.checkpoint = null
    entry.score++
    
    return
  }
}

// =============================================================================
// Initialization
// =============================================================================

main()

function main() {
  // Event listeners
  let MoveEvent = Packages.org.bukkit.event.player.PlayerMoveEvent
  let DeathEvent = Packages.org.bukkit.event.entity.PlayerDeathEvent
  let LeaveEvent = Packages.org.bukkit.event.player.PlayerQuitEvent
  events.register(MoveEvent, onPlayerMove)
  events.register(DeathEvent, onPlayerDeath)
  events.register(LeaveEvent, onPlayerLeave)

  // /leave command
  arcServer.registerLeaveListener(LEAVE_CMD_ID, (player: any) => {
    let entry = eventManger.getEntry(player.uniqueId.toString())

    if (entry == null) {
      return false
    }

    eventManger.exitEvent(entry)
    return true
  })
}

function __onClose() {
  arcServer.unregisterLeaveListener(LEAVE_CMD_ID)
}

// Dumb thing for the JS exports
function getManager(): EventManager {
  return eventManger
}
```