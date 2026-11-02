/**
 * Moteur de simulation commun — ligne de production en série à stocks finis.
 *
 * Simulation à pas de temps fixe (dt = 1 s) avec report exact des fins
 * d'opération à l'intérieur du pas (pas de biais d'arrondi sur les temps de cycle).
 * Hypothèses détaillées : docs/HYPOTHESES.md.
 */
import { Rng, deriveSeed } from './random'
import { cycleTimeFactor, sampleParams, sampleY, setpointsOf } from './processModel'
import type { Product, Scenario, SimResults, StationState, StationStats, TimePoint } from './types'

const STATES: StationState[] = ['processing', 'starved', 'blocked', 'down', 'changeover', 'break']

interface Server {
  product: Product | null
  remaining: number
  held: Product | null
  credit: number
}

interface StationRt {
  servers: Server[]
  queue: Product[]
  rng: Rng
  /** Flux dédié aux défauts : préserve les nombres aléatoires communs entre scénarios. */
  defRng: Rng
  down: number
  ttf: number
  changeover: number
  pendingBatch: number
  lastBatch: number
  sinceChangeover: number
  batchOffset: number
  time: Record<StationState, number>
  processed: number
  scrapped: number
  failures: number
  changeovers: number
  queueArea: number
  maxQueue: number
  ctSum: number
  nominalCT: number
  mtbf: number
}

interface Transit {
  product: Product
  arriveAt: number
  to: number
}

export interface Snapshot {
  t: number
  inBreak: boolean
  stations: {
    queue: number
    states: StationState[]
    progress: number[]
    productIds: (number | null)[]
  }[]
  transit: { id: number; to: number; progress: number }[]
  fg: number
  good: number
  scrap: number
  shipped: number
  released: number
}

export class LineSimulation {
  readonly sc: Scenario
  readonly dt = 1
  t = 0
  readonly openTime: number
  readonly plannedTime: number
  readonly taktTime: number
  private st: StationRt[]
  private transit: Transit[] = []
  private products: Product[] = []
  private nextId = 1
  private released = 0
  private fg = 0
  private shipped = 0
  private good = 0
  private scrap = 0
  private shipClock = 0
  private dueShipments = 0
  private operatingElapsed = 0
  private wipArea = 0
  private series: TimePoint[] = []
  private qRng: Rng
  private qualityIndex: number
  private transportDistance = 0

  constructor(sc: Scenario) {
    this.sc = sc
    this.openTime = sc.shift.duration * 60
    const breaks = sc.shift.breaks.reduce((s, b) => s + b.duration, 0) * 60
    this.plannedTime = this.openTime - breaks
    this.taktTime = sc.demand > 0 ? this.plannedTime / sc.demand : Infinity
    this.qRng = new Rng(deriveSeed(sc.seed, 'process'))
    this.qualityIndex = sc.stations.findIndex((s) => s.id === sc.process.stationId)
    const speed = sc.process.params.find((p) => p.key === 'speed')?.setpoint ?? 1
    this.st = sc.stations.map((s, i) => {
      const rng = new Rng(deriveSeed(sc.seed, `station-${i}`))
      const A = Math.min(Math.max(s.availability, 0.01), 1)
      const mtbf = A >= 0.9999 ? Infinity : (s.mttr * 60 * A) / (1 - A)
      const nominalCT = s.cycleTime * (i === this.qualityIndex ? cycleTimeFactor(sc.process, speed) : 1)
      return {
        servers: Array.from({ length: Math.max(1, Math.round(s.capacity)) }, () => ({ product: null, remaining: 0, held: null, credit: 0 })),
        queue: [],
        rng,
        defRng: new Rng(deriveSeed(sc.seed, `defects-${i}`)),
        down: 0,
        ttf: Number.isFinite(mtbf) ? rng.exponential(mtbf) : Infinity,
        changeover: 0,
        pendingBatch: 0,
        lastBatch: 1,
        sinceChangeover: 0,
        batchOffset: 0,
        time: { processing: 0, starved: 0, blocked: 0, down: 0, changeover: 0, break: 0 },
        processed: 0,
        scrapped: 0,
        failures: 0,
        changeovers: 0,
        queueArea: 0,
        maxQueue: 0,
        ctSum: 0,
        nominalCT,
        mtbf,
      }
    })
    if (this.qualityIndex >= 0) this.st[this.qualityIndex].batchOffset = this.qRng.normal(0, sc.process.batchSd)
    // Stocks intermédiaires initiaux (en-cours de la veille, lot n°1 en cours)
    sc.stations.forEach((s, i) => {
      if (i === sc.stations.length - 1) {
        this.fg = Math.max(0, Math.round(s.initialWip))
        return
      }
      for (let k = 0; k < Math.min(s.initialWip, s.bufferCapacity); k++) {
        const p = this.newProduct(1, true)
        // Pièces déjà passées par les postes amont : historique non simulé
        this.st[i + 1].queue.push(p)
        p.history.push({ stationId: sc.stations[i + 1].id, arrive: 0, start: NaN, end: NaN })
      }
    })
    if (sc.warmup) {
      this.advanceTo(this.openTime)
      this.startNewDay()
    } else this.record()
  }

  /**
   * Termine la journée de mise en régime : l'état physique de la ligne (stocks, pièces
   * en cours, pannes en cours) est conservé, les compteurs statistiques sont remis à zéro
   * et les horodatages décalés pour que la journée mesurée commence à t = 0.
   */
  private startNewDay(): void {
    const shift = this.openTime
    this.products = this.products.filter((p) => p.status === 'wip')
    for (const p of this.products) {
      p.preloaded = true
      p.release -= shift
      for (const h of p.history) {
        h.arrive -= shift
        h.start -= shift
        h.end -= shift
      }
    }
    for (const x of this.transit) x.arriveAt -= shift
    for (const rt of this.st) {
      rt.time = { processing: 0, starved: 0, blocked: 0, down: 0, changeover: 0, break: 0 }
      rt.processed = 0
      rt.scrapped = 0
      rt.failures = 0
      rt.changeovers = 0
      rt.queueArea = 0
      rt.maxQueue = rt.queue.length
      rt.ctSum = 0
    }
    this.t = 0
    this.released = 0
    this.good = 0
    this.scrap = 0
    this.shipped = 0
    this.dueShipments = 0
    this.shipClock = 0
    this.operatingElapsed = 0
    this.wipArea = 0
    this.series = []
    this.transportDistance = 0
    this.record()
  }

  get finished(): boolean {
    return this.t >= this.openTime
  }

  private newProduct(batch: number, preloaded: boolean, release = 0): Product {
    const id = this.nextId++
    const p: Product = {
      id,
      code: `P-${String(id).padStart(5, '0')}`,
      batch,
      release,
      status: 'wip',
      preloaded,
      history: [],
      transportTime: 0,
    }
    this.products.push(p)
    return p
  }

  inBreak(t: number): boolean {
    const m = t / 60
    return this.sc.shift.breaks.some((b) => m >= b.start && m < b.start + b.duration)
  }

  private downstreamCount(i: number): number {
    if (i === this.st.length - 1) return this.fg
    return this.st[i + 1].queue.length + this.transit.filter((x) => x.to === i + 1).length
  }

  private canAccept(i: number): boolean {
    if (i === this.st.length - 1) return this.sc.releasePolicy === 'push' || this.fg < this.sc.finishedGoodsCap
    return this.downstreamCount(i) < this.sc.stations[i].bufferCapacity
  }

  private push(i: number, p: Product, time: number): boolean {
    if (!this.canAccept(i)) return false
    if (i === this.st.length - 1) {
      this.fg++
      this.good++
      p.status = 'good'
      p.exit = time
      return true
    }
    const d = this.sc.stations[i].distanceToNext
    const speed = Math.max(this.sc.transportSpeed, 0.01)
    this.transportDistance += d
    if (d > 0) {
      const tt = d / speed
      p.transportTime += tt
      this.transit.push({ product: p, arriveAt: time + tt, to: i + 1 })
    } else {
      this.st[i + 1].queue.push(p)
      p.history.push({ stationId: this.sc.stations[i + 1].id, arrive: time, start: NaN, end: NaN })
    }
    return true
  }

  private batchOf(n: number): number {
    return Math.floor(n / Math.max(1, this.sc.batchSize)) + 1
  }

  /** Démarre une pièce sur un serveur (le crédit de temps du pas courant est imputé). */
  private start(i: number, s: Server, p: Product, startTime: number): void {
    const sc = this.sc
    const rt = this.st[i]
    const station = sc.stations[i]
    let h = p.history[p.history.length - 1]
    if (!h || h.stationId !== station.id) {
      h = { stationId: station.id, arrive: startTime, start: startTime, end: NaN }
      p.history.push(h)
    }
    h.start = startTime
    const dur = rt.rng.lognormal(rt.nominalCT, station.cycleTimeCV)
    if (i === this.qualityIndex) {
      const x = sampleParams(sc.process, this.qRng)
      p.params = x
      p.dimension = sampleY(sc.process, x, rt.batchOffset, rt.sinceChangeover, this.qRng)
      rt.sinceChangeover++
    }
    s.product = p
    s.remaining = dur - s.credit
    s.credit = 0
  }

  private complete(i: number, s: Server, endTime: number): void {
    const sc = this.sc
    const rt = this.st[i]
    const station = sc.stations[i]
    const p = s.product!
    s.product = null
    const h = p.history[p.history.length - 1]
    h.end = endTime
    rt.processed++
    rt.ctSum += h.end - h.start
    let defect: string | null = null
    if (i === this.qualityIndex && p.dimension !== undefined) {
      const c = sc.process.characteristic
      if (p.dimension > c.usl) defect = `${c.name} hors tolérance (haute)`
      else if (p.dimension < c.lsl) defect = `${c.name} hors tolérance (basse)`
    }
    // Deux tirages systématiques (même consommation quel que soit le résultat)
    const u1 = rt.defRng.next()
    const u2 = rt.defRng.next()
    if (!defect && u1 < station.defectRate) {
      defect = station.defectTypes.length ? station.defectTypes[Math.floor(u2 * station.defectTypes.length)] : 'Défaut divers'
    }
    if (defect) {
      p.status = 'scrap'
      p.exit = endTime
      p.defect = { type: defect, stationId: station.id, time: endTime }
      rt.scrapped++
      this.scrap++
      return
    }
    if (!this.push(i, p, endTime)) s.held = p
  }

  /** Avance la simulation jusqu'à l'instant `until` (s), borné à la fin du poste. */
  advanceTo(until: number): void {
    const end = Math.min(until, this.openTime)
    while (this.t < end - 1e-9) this.tick()
  }

  run(): SimResults {
    this.advanceTo(this.openTime)
    return this.results()
  }

  private tick(): void {
    const dt = this.dt
    const tEnd = this.t + dt
    const n = this.st.length
    if (this.inBreak(this.t)) {
      for (const rt of this.st) rt.time.break += dt
      this.accumulate(dt)
      this.t = tEnd
      if (Math.round(this.t) % 60 === 0) this.record()
      return
    }
    // Arrivées des manutentions
    if (this.transit.length) {
      const arrived = this.transit.filter((x) => x.arriveAt <= tEnd)
      if (arrived.length) {
        this.transit = this.transit.filter((x) => x.arriveAt > tEnd)
        arrived.sort((a, b) => a.arriveAt - b.arriveAt)
        for (const a of arrived) {
          this.st[a.to].queue.push(a.product)
          a.product.history.push({ stationId: this.sc.stations[a.to].id, arrive: a.arriveAt, start: NaN, end: NaN })
        }
      }
    }
    // Postes, de l'aval vers l'amont (libère la place avant que l'amont ne pousse)
    for (let i = n - 1; i >= 0; i--) {
      const rt = this.st[i]
      const station = this.sc.stations[i]
      const share = dt / rt.servers.length
      if (rt.down > 0) {
        rt.down -= dt
        rt.time.down += dt
        // Les pièces terminées en attente de place continuent d'être évacuées
        for (const s of rt.servers) if (s.held && this.push(i, s.held, tEnd)) s.held = null
        continue
      }
      if (rt.changeover > 0) {
        rt.changeover -= dt
        rt.time.changeover += dt
        if (rt.changeover <= 0) {
          rt.changeover = 0
          rt.lastBatch = rt.pendingBatch
          rt.sinceChangeover = 0
          rt.changeovers++
          if (i === this.qualityIndex) rt.batchOffset = this.qRng.normal(0, this.sc.process.batchSd)
        }
        continue
      }
      let anyProcessing = false
      for (const s of rt.servers) {
        if (s.held) {
          if (this.push(i, s.held, tEnd)) s.held = null
          else {
            rt.time.blocked += share
            continue
          }
        }
        if (s.product) {
          s.remaining -= dt
          anyProcessing = true
          if (s.remaining > 0) {
            rt.time.processing += share
            continue
          }
          const leftover = -s.remaining
          rt.time.processing += (share * (dt - leftover)) / dt
          this.complete(i, s, tEnd - leftover)
          if (s.held) {
            rt.time.blocked += (share * leftover) / dt
            continue
          }
          s.credit = leftover
        } else s.credit = dt
        // Serveur libre pendant `s.credit` secondes en fin de pas : chercher la pièce suivante
        let state: StationState = 'starved'
        const nextBatch = i === 0 ? this.batchOf(this.released) : rt.queue[0]?.batch
        if (nextBatch !== undefined) {
          if (nextBatch !== rt.lastBatch && nextBatch > 0 && station.changeoverTime > 0) {
            // Changement de série : démarre quand toutes les machines du poste sont vides
            if (!rt.servers.some((x) => x.product)) {
              rt.changeover = station.changeoverTime * 60
              rt.pendingBatch = nextBatch
            }
            state = 'changeover'
          } else {
            rt.lastBatch = nextBatch
            const startTime = tEnd - s.credit
            let p: Product
            if (i === 0) {
              p = this.newProduct(nextBatch, false, startTime)
              this.released++
            } else p = rt.queue.shift()!
            rt.time.processing += (share * s.credit) / dt
            this.start(i, s, p, startTime)
            anyProcessing = true
            continue
          }
        }
        rt.time[state] += (share * s.credit) / dt
        s.credit = 0
      }
      if (anyProcessing && Number.isFinite(rt.ttf)) {
        rt.ttf -= dt
        if (rt.ttf <= 0) {
          rt.failures++
          rt.down = rt.rng.exponential(station.mttr * 60)
          rt.ttf = rt.rng.exponential(rt.mtbf)
        }
      }
    }
    // Expéditions client au rythme du takt (pendant le temps d'ouverture hors pauses)
    this.operatingElapsed += dt
    if (Number.isFinite(this.taktTime)) {
      this.shipClock += dt
      while (this.shipClock >= this.taktTime && this.dueShipments < this.sc.demand) {
        this.shipClock -= this.taktTime
        this.dueShipments++
      }
      while (this.fg > 0 && this.shipped < this.dueShipments) {
        this.fg--
        this.shipped++
      }
    }
    this.accumulate(dt)
    this.t = tEnd
    if (Math.round(this.t) % 60 === 0) this.record()
  }

  private wipNow(): number {
    let w = this.transit.length
    for (const rt of this.st) {
      w += rt.queue.length
      for (const s of rt.servers) if (s.product || s.held) w++
    }
    return w
  }

  private accumulate(dt: number) {
    this.wipArea += this.wipNow() * dt
    for (const rt of this.st) {
      rt.queueArea += rt.queue.length * dt
      rt.maxQueue = Math.max(rt.maxQueue, rt.queue.length)
    }
  }

  private record() {
    this.series.push({
      t: this.t,
      wip: this.wipNow(),
      buffers: this.st.map((_, i) => (i === this.st.length - 1 ? this.fg : this.st[i + 1].queue.length + this.transit.filter((x) => x.to === i + 1).length)),
      good: this.good,
      scrap: this.scrap,
      fg: this.fg,
      shipped: this.shipped,
    })
  }

  snapshot(): Snapshot {
    const inBreak = this.inBreak(this.t)
    return {
      t: this.t,
      inBreak,
      stations: this.st.map((rt) => ({
        queue: rt.queue.length,
        states: rt.servers.map((s) =>
          inBreak ? 'break' : rt.down > 0 ? 'down' : rt.changeover > 0 ? 'changeover' : s.held ? 'blocked' : s.product ? 'processing' : 'starved',
        ),
        progress: rt.servers.map((s) => (s.product ? 1 - s.remaining / Math.max(rt.nominalCT, 1) : 0)),
        productIds: rt.servers.map((s) => s.product?.id ?? s.held?.id ?? null),
      })),
      transit: this.transit.map((x) => {
        const d = this.sc.stations[x.to - 1].distanceToNext / Math.max(this.sc.transportSpeed, 0.01)
        return { id: x.product.id, to: x.to, progress: d > 0 ? 1 - (x.arriveAt - this.t) / d : 1 }
      }),
      fg: this.fg,
      good: this.good,
      scrap: this.scrap,
      shipped: this.shipped,
      released: this.released,
    }
  }

  results(): SimResults {
    const P = this.plannedTime
    const elapsed = Math.max(1, Math.min(this.t, this.openTime))
    const breaksElapsed = this.st[0]?.time.break ?? 0
    const plannedElapsed = Math.max(1, elapsed - breaksElapsed)
    const stations: StationStats[] = this.st.map((rt, i) => {
      const s = this.sc.stations[i]
      const runTime = Math.max(1, plannedElapsed - rt.time.down - rt.time.changeover)
      const availability = runTime / plannedElapsed
      const performance = Math.min(1, (rt.processed * rt.nominalCT) / rt.servers.length / runTime)
      const quality = rt.processed ? (rt.processed - rt.scrapped) / rt.processed : 1
      const time = { ...rt.time }
      return {
        id: s.id,
        name: s.name,
        time,
        processed: rt.processed,
        scrapped: rt.scrapped,
        failures: rt.failures,
        changeovers: rt.changeovers,
        activeRatio: (time.processing + time.down + time.changeover) / plannedElapsed,
        oee: { availability, performance, quality, oee: availability * performance * quality },
        avgQueue: rt.queueArea / elapsed,
        maxQueue: rt.maxQueue,
        avgCycleTime: rt.processed ? rt.ctSum / rt.processed : 0,
        nominalCycleTime: rt.nominalCT,
      }
    })
    let bottleneckIndex = 0
    stations.forEach((s, i) => {
      if (s.activeRatio > stations[bottleneckIndex].activeRatio) bottleneckIndex = i
    })
    return {
      scenarioId: this.sc.id,
      seed: this.sc.seed,
      plannedTime: P,
      openTime: this.openTime,
      taktTime: this.taktTime,
      stations,
      products: this.products,
      good: this.good,
      scrap: this.scrap,
      released: this.released,
      shipped: this.shipped,
      backlog: Math.max(0, this.sc.demand - this.shipped),
      fgStock: this.fg,
      wipEnd: this.wipNow(),
      avgWip: this.wipArea / elapsed,
      timeSeries: this.series,
      bottleneckIndex,
      transportDistance: this.transportDistance,
    }
  }
}

export function simulate(sc: Scenario): SimResults {
  return new LineSimulation(sc).run()
}

/** Réplications indépendantes (graines différentes) pour estimer la variabilité des résultats. */
export function replicate(sc: Scenario, n: number): SimResults[] {
  return Array.from({ length: n }, (_, k) => simulate({ ...sc, seed: deriveSeed(sc.seed, `rep-${k}`) }))
}

export { STATES }
export { setpointsOf }
