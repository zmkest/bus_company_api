import {
  BusStatus,
  CrewPosition,
  CrewStatus,
  MaintenanceType,
  UserRole,
  Weekday,
} from '../../generated/prisma/enums.js';

export const DEMO_PASSWORD = 'Demo2026';

export const DEMO_USERS = [
  { key: 'admin', email: 'admin@transandina.ec', name: 'Lucía Paredes Mora', role: UserRole.ADMIN },
  {
    key: 'operator',
    email: 'operaciones@transandina.ec',
    name: 'Andrés Villacís Torres',
    role: UserRole.OPERATOR,
  },
  {
    key: 'seller',
    email: 'ventas.quitumbe@transandina.ec',
    name: 'María José Castillo',
    role: UserRole.SELLER,
  },
  {
    key: 'driver',
    email: 'jorge.guaman@transandina.ec',
    name: 'Jorge Guamán Quishpe',
    role: UserRole.DRIVER,
  },
  {
    key: 'passenger',
    email: 'daniela.cevallos@gmail.com',
    name: 'Daniela Cevallos Andrade',
    role: UserRole.PASSENGER,
  },
] as const;

export type DemoUserKey = (typeof DEMO_USERS)[number]['key'];

export const DEMO_TERMINALS = [
  {
    key: 'QUITUMBE',
    name: 'Terminal de Quitumbe',
    city: 'Quito',
    address: 'Av. Cóndor Ñan y Av. Mariscal Sucre',
  },
  {
    key: 'CARCELEN',
    name: 'Terminal Terrestre Carcelén',
    city: 'Quito',
    address: 'Av. Eloy Alfaro y Av. Galo Plaza Lasso',
  },
  {
    key: 'GUAYAQUIL',
    name: 'Terminal Terrestre Jaime Roldós Aguilera',
    city: 'Guayaquil',
    address: 'Av. Benjamín Rosales y Av. de las Américas',
  },
  {
    key: 'CUENCA',
    name: 'Terminal Terrestre de Cuenca',
    city: 'Cuenca',
    address: 'Av. España y Sebastián de Benalcázar',
  },
  {
    key: 'AMBATO',
    name: 'Terminal Terrestre de Ambato',
    city: 'Ambato',
    address: 'Av. de las Américas y Av. Colombia',
  },
  {
    key: 'RIOBAMBA',
    name: 'Terminal Terrestre de Riobamba',
    city: 'Riobamba',
    address: 'Av. Eloy Alfaro y Av. Daniel León Borja',
  },
  {
    key: 'LOJA',
    name: 'Terminal Terrestre Reina del Cisne',
    city: 'Loja',
    address: 'Av. 8 de Diciembre y Juan José Flores',
  },
  {
    key: 'IBARRA',
    name: 'Terminal Terrestre de Ibarra',
    city: 'Ibarra',
    address: 'Av. Teodoro Gómez de la Torre y Av. Eugenio Espejo',
  },
  {
    key: 'MANTA',
    name: 'Terminal Terrestre de Manta',
    city: 'Manta',
    address: 'Av. 4 de Noviembre y calle 304',
  },
  {
    key: 'SANTO_DOMINGO',
    name: 'Terminal Terrestre de Santo Domingo',
    city: 'Santo Domingo',
    address: 'Av. Abraham Calazacón y Av. Esmeraldas',
  },
] as const;

export type TerminalKey = (typeof DEMO_TERMINALS)[number]['key'];

/** Cada par se crea en ambos sentidos */
export const DEMO_ROUTES: { a: TerminalKey; b: TerminalKey; km: number; minutes: number }[] = [
  { a: 'QUITUMBE', b: 'GUAYAQUIL', km: 420, minutes: 480 },
  { a: 'QUITUMBE', b: 'CUENCA', km: 445, minutes: 570 },
  { a: 'GUAYAQUIL', b: 'CUENCA', km: 197, minutes: 240 },
  { a: 'QUITUMBE', b: 'AMBATO', km: 136, minutes: 150 },
  { a: 'AMBATO', b: 'RIOBAMBA', km: 54, minutes: 75 },
  { a: 'CUENCA', b: 'LOJA', km: 205, minutes: 300 },
  { a: 'CARCELEN', b: 'IBARRA', km: 115, minutes: 150 },
  { a: 'GUAYAQUIL', b: 'MANTA', km: 196, minutes: 240 },
  { a: 'QUITUMBE', b: 'SANTO_DOMINGO', km: 133, minutes: 180 },
];

const ALL_DAYS = Object.values(Weekday);
const MON_SAT = ALL_DAYS.filter((d) => d !== Weekday.SUNDAY);
const WEEKEND_PLUS = [Weekday.FRIDAY, Weekday.SATURDAY, Weekday.SUNDAY];

export interface FrequencySeed {
  key: string;
  from: TerminalKey;
  to: TerminalKey;
  time: string;
  weekdays: Weekday[];
  price: number;
  isActive?: boolean;
}

export const DEMO_FREQUENCIES: FrequencySeed[] = [
  {
    key: 'UIO-GYE-0700',
    from: 'QUITUMBE',
    to: 'GUAYAQUIL',
    time: '07:00',
    weekdays: ALL_DAYS,
    price: 12.5,
  },
  {
    key: 'GYE-UIO-2200',
    from: 'GUAYAQUIL',
    to: 'QUITUMBE',
    time: '22:00',
    weekdays: ALL_DAYS,
    price: 12.5,
  },
  {
    key: 'UIO-GYE-2330',
    from: 'QUITUMBE',
    to: 'GUAYAQUIL',
    time: '23:30',
    weekdays: WEEKEND_PLUS,
    price: 14,
  },
  {
    key: 'GYE-CUE-0600',
    from: 'GUAYAQUIL',
    to: 'CUENCA',
    time: '06:00',
    weekdays: ALL_DAYS,
    price: 8.5,
  },
  {
    key: 'CUE-GYE-1300',
    from: 'CUENCA',
    to: 'GUAYAQUIL',
    time: '13:00',
    weekdays: ALL_DAYS,
    price: 8.5,
  },
  {
    key: 'UIO-AMB-0800',
    from: 'QUITUMBE',
    to: 'AMBATO',
    time: '08:00',
    weekdays: ALL_DAYS,
    price: 4.5,
  },
  {
    key: 'AMB-RIO-1130',
    from: 'AMBATO',
    to: 'RIOBAMBA',
    time: '11:30',
    weekdays: ALL_DAYS,
    price: 2.25,
  },
  {
    key: 'RIO-AMB-1400',
    from: 'RIOBAMBA',
    to: 'AMBATO',
    time: '14:00',
    weekdays: ALL_DAYS,
    price: 2.25,
  },
  {
    key: 'AMB-UIO-1600',
    from: 'AMBATO',
    to: 'QUITUMBE',
    time: '16:00',
    weekdays: ALL_DAYS,
    price: 4.5,
  },
  { key: 'CUE-LOJ-0730', from: 'CUENCA', to: 'LOJA', time: '07:30', weekdays: MON_SAT, price: 7.5 },
  { key: 'LOJ-CUE-1430', from: 'LOJA', to: 'CUENCA', time: '14:30', weekdays: MON_SAT, price: 7.5 },
  {
    key: 'UIO-IBA-0630',
    from: 'CARCELEN',
    to: 'IBARRA',
    time: '06:30',
    weekdays: ALL_DAYS,
    price: 3,
  },
  {
    key: 'IBA-UIO-1000',
    from: 'IBARRA',
    to: 'CARCELEN',
    time: '10:00',
    weekdays: ALL_DAYS,
    price: 3,
  },
  {
    key: 'UIO-IBA-1400',
    from: 'CARCELEN',
    to: 'IBARRA',
    time: '14:00',
    weekdays: ALL_DAYS,
    price: 3,
  },
  {
    key: 'IBA-UIO-1730',
    from: 'IBARRA',
    to: 'CARCELEN',
    time: '17:30',
    weekdays: ALL_DAYS,
    price: 3,
  },
  {
    key: 'GYE-MEC-0800',
    from: 'GUAYAQUIL',
    to: 'MANTA',
    time: '08:00',
    weekdays: ALL_DAYS,
    price: 7,
  },
  {
    key: 'MEC-GYE-1500',
    from: 'MANTA',
    to: 'GUAYAQUIL',
    time: '15:00',
    weekdays: ALL_DAYS,
    price: 7,
  },
  {
    key: 'UIO-STD-0900',
    from: 'QUITUMBE',
    to: 'SANTO_DOMINGO',
    time: '09:00',
    weekdays: ALL_DAYS,
    price: 4,
  },
  {
    key: 'STD-UIO-1500',
    from: 'SANTO_DOMINGO',
    to: 'QUITUMBE',
    time: '15:00',
    weekdays: ALL_DAYS,
    price: 4,
  },
  {
    key: 'UIO-CUE-2100',
    from: 'QUITUMBE',
    to: 'CUENCA',
    time: '21:00',
    weekdays: ALL_DAYS,
    price: 13,
  },
  {
    key: 'CUE-UIO-2030',
    from: 'CUENCA',
    to: 'QUITUMBE',
    time: '20:30',
    weekdays: ALL_DAYS,
    price: 13,
  },
  {
    key: 'UIO-STD-1800',
    from: 'QUITUMBE',
    to: 'SANTO_DOMINGO',
    time: '18:00',
    weekdays: MON_SAT,
    price: 4,
    isActive: false,
  },
];

export const DEMO_BUSES = [
  {
    key: 'B1',
    plate: 'PDA-4521',
    model: 'Mercedes-Benz O500 RSD',
    year: 2021,
    odometerKm: 184_350,
    seats: 44,
    broken: [13],
  },
  {
    key: 'B2',
    plate: 'GBN-7810',
    model: 'Volvo B420R',
    year: 2022,
    odometerKm: 121_900,
    seats: 44,
    broken: [],
  },
  {
    key: 'B3',
    plate: 'TBC-3307',
    model: 'Scania K410 IB',
    year: 2019,
    odometerKm: 268_400,
    seats: 40,
    broken: [40],
  },
  {
    key: 'B4',
    plate: 'ACF-1192',
    model: 'Hino AK8JRSA',
    year: 2018,
    odometerKm: 301_220,
    seats: 40,
    broken: [],
  },
  {
    key: 'B5',
    plate: 'IBD-2045',
    model: 'Chevrolet NQR Busetón',
    year: 2020,
    odometerKm: 156_780,
    seats: 32,
    broken: [],
  },
  {
    key: 'B6',
    plate: 'MBB-6634',
    model: 'Mercedes-Benz OF 1721',
    year: 2017,
    odometerKm: 352_110,
    seats: 40,
    broken: [7, 8],
  },
  {
    key: 'B7',
    plate: 'PCE-9087',
    model: 'Volvo B450R',
    year: 2024,
    odometerKm: 38_640,
    seats: 46,
    broken: [],
  },
  {
    key: 'B8',
    plate: 'PBX-3410',
    model: 'Scania K360 IB',
    year: 2016,
    odometerKm: 398_050,
    seats: 40,
    broken: [],
  },
  {
    key: 'B9',
    plate: 'GSA-0573',
    model: 'Hino RK8JSKA',
    year: 2014,
    odometerKm: 512_300,
    seats: 42,
    broken: [],
  },
] as const;

export type BusKey = (typeof DEMO_BUSES)[number]['key'];

/** Estado final de los buses que no quedan disponibles */
export const BUS_FINAL_STATUS: Partial<Record<BusKey, BusStatus>> = {
  B8: BusStatus.MAINTENANCE,
  B9: BusStatus.OUT_OF_SERVICE,
};

export const DEMO_MAINTENANCES: {
  bus: BusKey;
  type: MaintenanceType;
  description: string;
  cost?: number;
  daysAgo: number;
  durationDays?: number;
  cancelled?: boolean;
}[] = [
  {
    bus: 'B1',
    type: MaintenanceType.PREVENTIVE,
    description: 'Cambio de aceite, filtros y revisión de frenos (180.000 km)',
    cost: 385.4,
    daysAgo: 40,
    durationDays: 1,
  },
  {
    bus: 'B3',
    type: MaintenanceType.CORRECTIVE,
    description: 'Reemplazo de compresor del aire acondicionado',
    cost: 1240,
    daysAgo: 25,
    durationDays: 3,
  },
  {
    bus: 'B4',
    type: MaintenanceType.PREVENTIVE,
    description: 'Alineación, balanceo y rotación de neumáticos',
    cost: 160,
    daysAgo: 18,
    durationDays: 1,
  },
  {
    bus: 'B6',
    type: MaintenanceType.CORRECTIVE,
    description: 'Revisión de caja de cambios: se descartó falla',
    daysAgo: 12,
    cancelled: true,
  },
  {
    bus: 'B9',
    type: MaintenanceType.CORRECTIVE,
    description: 'Rectificación de culata del motor',
    daysAgo: 30,
    durationDays: 6,
    cost: 2890,
  },
  {
    bus: 'B8',
    type: MaintenanceType.CORRECTIVE,
    description: 'Cambio de embrague y kit de clutch',
    daysAgo: 2,
  },
];

export interface RotationSeed {
  name: string;
  bus: BusKey | null;
  frequencies: string[];
  driver: string;
  assistant: string;
}

/** Cada día el bus vuelve a su terminal de origen, así el ciclo semanal cierra */
export const DEMO_ROTATIONS: RotationSeed[] = [
  {
    name: 'Quito – Guayaquil diario',
    bus: 'B1',
    frequencies: ['UIO-GYE-0700', 'GYE-UIO-2200'],
    driver: '1712345678',
    assistant: '1723456781',
  },
  {
    name: 'Guayaquil – Cuenca por El Cajas',
    bus: 'B2',
    frequencies: ['GYE-CUE-0600', 'CUE-GYE-1300'],
    driver: '0912345674',
    assistant: '0923456785',
  },
  {
    name: 'Corredor central Quito – Ambato – Riobamba',
    bus: 'B3',
    frequencies: ['UIO-AMB-0800', 'AMB-RIO-1130', 'RIO-AMB-1400', 'AMB-UIO-1600'],
    driver: '1803456782',
    assistant: '0603456785',
  },
  {
    name: 'Cuenca – Loja lunes a sábado',
    bus: 'B4',
    frequencies: ['CUE-LOJ-0730', 'LOJ-CUE-1430'],
    driver: '0103456787',
    assistant: '1103456783',
  },
  {
    name: 'Quito norte – Ibarra',
    bus: 'B5',
    frequencies: ['UIO-IBA-0630', 'IBA-UIO-1000', 'UIO-IBA-1400', 'IBA-UIO-1730'],
    driver: '1003456784',
    assistant: '1713456783',
  },
  {
    name: 'Guayaquil – Manta',
    bus: 'B6',
    frequencies: ['GYE-MEC-0800', 'MEC-GYE-1500'],
    driver: '1303456781',
    assistant: '0913456789',
  },
  {
    name: 'Quito – Santo Domingo (bus por asignar)',
    bus: null,
    frequencies: ['UIO-STD-0900', 'STD-UIO-1500'],
    driver: '',
    assistant: '',
  },
];

export interface CrewSeed {
  document: string;
  name: string;
  position: CrewPosition;
  licenseYearsLeft?: number;
  status?: CrewStatus;
  user?: DemoUserKey;
}

export const DEMO_CREW: CrewSeed[] = [
  {
    document: '1712345678',
    name: 'Jorge Guamán Quishpe',
    position: CrewPosition.DRIVER,
    licenseYearsLeft: 3,
    user: 'driver',
  },
  {
    document: '0912345674',
    name: 'Carlos Mendoza Vera',
    position: CrewPosition.DRIVER,
    licenseYearsLeft: 2,
  },
  {
    document: '1803456782',
    name: 'Luis Chicaiza Pilla',
    position: CrewPosition.DRIVER,
    licenseYearsLeft: 4,
  },
  {
    document: '0103456787',
    name: 'Fernando Ordóñez Sarmiento',
    position: CrewPosition.DRIVER,
    licenseYearsLeft: 1,
  },
  {
    document: '1003456784',
    name: 'Patricio Benalcázar Ruiz',
    position: CrewPosition.DRIVER,
    licenseYearsLeft: 5,
  },
  {
    document: '1303456781',
    name: 'Ramón Zambrano Cedeño',
    position: CrewPosition.DRIVER,
    licenseYearsLeft: 2,
  },
  {
    document: '1709876543',
    name: 'Wilson Tipán Llumiquinga',
    position: CrewPosition.DRIVER,
    licenseYearsLeft: -0.2,
  },
  {
    document: '0609876544',
    name: 'Héctor Yépez Naranjo',
    position: CrewPosition.DRIVER,
    licenseYearsLeft: 3,
    status: CrewStatus.SUSPENDED,
  },
  { document: '1723456781', name: 'Kevin Lema Toapanta', position: CrewPosition.ASSISTANT },
  { document: '0923456785', name: 'Joselyn Alvarado Franco', position: CrewPosition.ASSISTANT },
  { document: '0603456785', name: 'Darwin Guallpa Inga', position: CrewPosition.ASSISTANT },
  { document: '1103456783', name: 'Edison Jaramillo Ochoa', position: CrewPosition.ASSISTANT },
  { document: '1713456783', name: 'Mishell Pozo Salazar', position: CrewPosition.ASSISTANT },
  { document: '0913456789', name: 'Bryan Macías Loor', position: CrewPosition.ASSISTANT },
  {
    document: '1719876544',
    name: 'Cristian Andrango Farinango',
    position: CrewPosition.ASSISTANT,
    status: CrewStatus.INACTIVE,
  },
];

export const PASSENGER_NAMES = [
  'Daniela Cevallos Andrade',
  'Gabriela Vásquez Moreno',
  'Santiago Herrera Pazmiño',
  'Valentina Ríos Espinoza',
  'Mateo Salazar Cueva',
  'Camila Proaño Benítez',
  'Sebastián Guerrero Carrión',
  'Paula Jácome Rosero',
  'Diego Montalvo Arias',
  'Karla Intriago Mero',
  'José Luis Pincay Chóez',
  'Ana Belén Calle Peralta',
  'David Tenesaca Lojano',
  'Fernanda Ayala Suárez',
  'Ricardo Ponce Vélez',
  'Andrea Quinde Pesántez',
  'Marco Navarrete Bravo',
  'Nathaly Chávez Ortiz',
  'Esteban Coronel Romero',
  'Silvia Rivadeneira Gómez',
  'Javier Toapanta Chiluisa',
  'Doménica Ullauri Vintimilla',
  'Óscar Burbano Játiva',
  'Lorena Freire Altamirano',
  'Alexis Castro Plúas',
  'Rosa Elena Guzmán Tapia',
  'Pablo Encalada Matute',
  'Verónica Sánchez Alcívar',
  'Hugo Bermeo Cabrera',
  'Tatiana Mora Valarezo',
];
