import Link from 'next/link';
import { Activity, Antenna, ArrowRight, BarChart3, BatteryCharging, BellRing, CloudCog, Database, Gauge, LockKeyhole, RadioTower, ShieldCheck, Thermometer, Waves, Wind } from 'lucide-react';
import { Logo } from '@/components/logo';
import { SamplingCalculator } from '@/components/sampling-calculator';

const variables = [
  { icon: Thermometer, title: 'Temperatura', text: 'Seguimiento térmico del nido de cría y comparación por estación y franja horaria.' },
  { icon: Wind, title: 'Humedad', text: 'Control higrométrico y cálculo de proximidad al punto de rocío en otoño-invierno.' },
  { icon: Activity, title: 'Actividad en piquera', text: 'Presencia de movimiento como variable contextual del comportamiento de la colonia.' },
  { icon: Waves, title: 'Actividad acústica', text: 'Energía de la señal acústica para detectar cambios respecto del comportamiento habitual.' },
  { icon: Gauge, title: 'Inclinación', text: 'Detección de cambios estructurales mediante el sensor inercial del Nodo Hijo.' }
];

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#070b0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a href="#tecnologia" className="hover:text-white">Tecnología</a>
            <a href="#monitoreo" className="hover:text-white">Monitoreo</a>
            <a href="#calculadora" className="hover:text-white">Calculadora</a>
            <a href="#acceso" className="hover:text-white">Acceso</a>
          </nav>
          <Link href="/auth" className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-200 transition hover:bg-amber-300/20">
            Iniciar sesión
          </Link>
        </div>
      </header>

      <section className="grid-noise relative min-h-screen pt-28">
        <div className="absolute left-1/2 top-28 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-amber-400/5 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pt-24">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
              <RadioTower className="h-3.5 w-3.5" /> Telemetría apícola IoT
            </div>
            <h1 className="max-w-4xl text-5xl font-black leading-[.95] tracking-[-.05em] text-white md:text-7xl">
              La colmena te habla.<br /><span className="text-amber-300">MELLIFERA la vuelve visible.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-400">
              Monitoreo remoto de colmenas con Nodos Hijo de bajo consumo, un Nodo Madre con conectividad celular y una plataforma web que transforma datos en decisiones simples.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/auth?mode=register" className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-black text-[#181109] transition hover:bg-amber-200">
                Activar mi sistema <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#calculadora" className="rounded-xl border border-white/10 bg-white/[.03] px-5 py-3 font-bold text-slate-200 transition hover:bg-white/[.06]">
                Calcular nodos necesarios
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-xs text-slate-500">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Plug & Play</span>
              <span className="flex items-center gap-2"><BatteryCharging className="h-4 w-4 text-emerald-300" /> Energía solar</span>
              <span className="flex items-center gap-2"><Antenna className="h-4 w-4 text-emerald-300" /> Un solo enlace celular por apiario</span>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="glass w-full max-w-xl rounded-[32px] p-4 shadow-glow md:p-5">
              <div className="rounded-[24px] border border-white/5 bg-[#091016] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[.18em] text-slate-500">Apiario principal</div>
                    <div className="mt-1 text-lg font-black">Estado general</div>
                  </div>
                  <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-300">● NORMAL</div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[['12','Colmenas'],['92%','Térmico'],['88%','Higrométrico'],['3 h','Última subida']].map(([v,l]) => (
                    <div key={l} className="rounded-2xl border border-white/5 bg-white/[.025] p-3">
                      <div className="text-2xl font-black">{v}</div><div className="mt-1 text-[11px] text-slate-500">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl border border-white/5 bg-white/[.02] p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500"><span>Temperatura promedio</span><span>Últimas 24 h</span></div>
                  <div className="mt-5 flex h-28 items-end gap-2">
                    {[45,58,50,64,72,67,78,74,83,75,81,88,79,85,82,90].map((h,i)=><div key={i} className="flex-1 rounded-t bg-gradient-to-t from-amber-500/50 to-amber-300" style={{height:`${h}%`}} />)}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-300/10 bg-amber-300/5 p-4 text-sm text-slate-300">
                  <BellRing className="h-5 w-5 text-amber-300" />
                  1 colmena requiere seguimiento. Tocá la advertencia para ver el detalle.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="tecnologia" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Arquitectura</div>
          <h2 className="mt-3 text-4xl font-black tracking-[-.04em] md:text-5xl">Una red simple en campo. Inteligencia en la plataforma.</h2>
          <p className="mt-5 text-lg leading-8 text-slate-400">Cada colmena instrumentada aporta su información al Nodo Madre. El Nodo Madre concentra, conserva y publica los datos hacia la nube sin obligar al productor a programar nada.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { icon: Activity, step: '01', title: 'Nodo Hijo', text: 'Adquiere temperatura, humedad, actividad en piquera, acústica e inclinación. Conserva registros ante fallos de enlace.' },
            { icon: Antenna, step: '02', title: 'Nodo Madre', text: 'Recibe los paquetes por BLE, almacena temporalmente y activa el enlace celular cada tres horas para publicar.' },
            { icon: CloudCog, step: '03', title: 'Plataforma', text: 'Asigna fecha y franja horaria, construye indicadores, estados Andon, históricos y alertas por colmena.' }
          ].map(({icon:Icon,step,title,text}) => (
            <div key={title} className="glass rounded-3xl p-7">
              <div className="flex items-center justify-between"><Icon className="h-7 w-7 text-amber-300"/><span className="text-xs font-black tracking-[.25em] text-slate-600">{step}</span></div>
              <h3 className="mt-8 text-2xl font-black">{title}</h3><p className="mt-3 leading-7 text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="monitoreo" className="border-y border-white/5 bg-white/[.015]">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
          <div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <div className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Qué vas a ver</div>
              <h2 className="mt-3 text-4xl font-black tracking-[-.04em]">Primero el estado. Después, el detalle.</h2>
              <p className="mt-5 leading-7 text-slate-400">La pantalla inicial usa un tablero Andon para priorizar. Verde indica comportamiento esperado, amarillo seguimiento, rojo inspección y blanco falta de datos suficientes. Desde cada estado se puede bajar a los valores e históricos de la colmena.</p>
              <div className="mt-7 rounded-2xl border border-red-300/15 bg-red-300/5 p-4 text-sm leading-6 text-slate-400">
                La plataforma no diagnostica enfermedades automáticamente. Detecta condiciones o combinaciones que justifican una inspección presencial.
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {variables.map(({icon:Icon,title,text}) => (
                <div key={title} className="rounded-2xl border border-white/5 bg-[#0b1116] p-5">
                  <Icon className="h-5 w-5 text-amber-300"/><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="calculadora" className="mx-auto max-w-5xl px-5 py-24 lg:px-8">
        <div className="text-center">
          <div className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Dimensionamiento</div>
          <h2 className="mt-3 text-4xl font-black tracking-[-.04em]">¿Cuántos Nodos Hijo necesitás?</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-400">Ingresá la cantidad de colmenas de tu apiario y obtené el tamaño mínimo de muestra preliminar definido en el proyecto.</p>
        </div>
        <div className="mt-10"><SamplingCalculator /></div>
      </section>

      <section id="acceso" className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
        <div className="relative overflow-hidden rounded-[36px] border border-amber-300/15 bg-gradient-to-br from-amber-300/[.08] via-[#0c1217] to-emerald-300/[.06] p-8 md:p-12">
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-amber-300"><LockKeyhole className="h-4 w-4"/> Acceso exclusivo para clientes</div>
              <h2 className="mt-4 text-4xl font-black tracking-[-.04em]">Compraste. Activás. Y desde ahí entrás siempre con tu cuenta.</h2>
              <p className="mt-4 max-w-3xl leading-7 text-slate-400">El número de pedido se usa una sola vez para habilitar la creación de la cuenta. Después podés iniciar sesión con Google o con tu correo y contraseña.</p>
            </div>
            <Link href="/auth?mode=register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-black text-[#0b1014]">Crear cuenta <ArrowRight className="h-4 w-4"/></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 text-sm text-slate-600 md:flex-row md:items-center md:justify-between lg:px-8">
          <Logo />
          <div className="flex flex-wrap gap-5"><span>Hardware IoT</span><span>Plataforma SaaS</span><span>Manufactura nacional</span></div>
        </div>
      </footer>
    </main>
  );
}
