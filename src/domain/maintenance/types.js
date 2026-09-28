export const causes = { MO: 'Mano de obra', MAT: 'Materiales', Acc: 'Accidental', CAP: 'Capacidad instalada', GES: 'Productividad', PENDIENTE: 'Por confirmar' };
export const systems = ['Motor diésel', 'Sistema neumático', 'Sistema eléctrico', 'Bogie', 'Carpintería', 'Equipos de a bordo', 'Varios sistemas', 'Otro', 'Por confirmar'];
export const staffOptions = ['Turno fijo', 'Turno rotativo', 'Otro sector', 'Por confirmar'];
export const periods = ['Mañana', 'Tarde', 'Mañana y tarde', 'Noche (alistamiento)', 'Día completo', 'Período por confirmar'];
export const wholeLocomotive = { system: 'Varios sistemas', component: 'Locomotora completa', staff: 'Turno rotativo' };
export const durations = { E: 1, A: 2, AB: 3, ABC: 6 };
export const fleet = [...Array.from({ length: 21 }, (_, i) => `E${701 + i}`), '7754', '7763', '7746', '7774', 'EM01', 'EM02'];
export function normalizeUnit(value) {
    const name = value.trim().toUpperCase().replaceAll(' ', '');
    if (name === 'EMO1')
        return 'EM01';
    if (name === 'EMO2')
        return 'EM02';
    if (/^7(0[1-9]|1[0-9]|2[01])$/.test(name))
        return 'E' + name;
    return name;
}
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function dateLabel(d) { return d ? d.split('-').reverse().join('/') : 'Por confirmar'; }
export function shiftDay(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
export function monday(d) { const day = new Date(d + 'T12:00:00Z').getUTCDay(); return shiftDay(d, -((day + 6) % 7)); }
