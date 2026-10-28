import 'reflect-metadata';
import { BusStatus, MaintenanceType } from '../../generated/prisma/enums.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateBusStatusDto } from './update-status.dto.js';

async function errorsFor(payload: unknown) {
  const classDto = plainToInstance(UpdateBusStatusDto, payload);
  return validate(classDto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

const failures = async (payload: unknown) =>
  (await errorsFor(payload)).flatMap((e) =>
    Object.keys(e.constraints ?? {})
      .map((c) => `${e.property}.${c}`)
      .sort(),
  );

describe('UpdateBusStatusDto', () => {
  it('Cambia a mantenimiento sin razón', async () => {
    expect(
      await failures({
        status: BusStatus.MAINTENANCE,
        type: MaintenanceType.CORRECTIVE,
        startedAt: new Date(),
      }),
    ).toEqual(['reason.isNotEmpty', 'reason.isString', 'reason.maxLength']);
  });

  it('Cambia a fuera de servicio sin razón', async () => {
    expect(
      await failures({
        status: BusStatus.OUT_OF_SERVICE,
      }),
    ).toEqual(['reason.isNotEmpty', 'reason.isString', 'reason.maxLength']);
  });

  it('Enviar reason vacia', async () => {
    expect(
      await failures({
        status: BusStatus.MAINTENANCE,
        type: MaintenanceType.CORRECTIVE,
        startedAt: new Date(),
        reason: '',
      }),
    ).toEqual(['reason.isNotEmpty']);
  });

  it('Enviar reason solo con espacios', async () => {
    expect(
      await failures({
        status: BusStatus.MAINTENANCE,
        type: MaintenanceType.CORRECTIVE,
        startedAt: new Date(),
        reason: '\t\n',
      }),
    ).toEqual(['reason.isNotEmpty']);
  });

  it('Enviando status con AVAILABLE sin reason', async () => {
    expect(
      await failures({
        status: BusStatus.AVAILABLE,
      }),
    ).toEqual([]);
  });

  it('Enviando status con ON_ROUTE sin reason', async () => {
    expect(
      await failures({
        status: BusStatus.ON_ROUTE,
      }),
    ).toEqual([]);
  });

  it('Cambiar a mantenimiento válido', async () => {
    expect(
      await failures({
        status: BusStatus.MAINTENANCE,
        type: MaintenanceType.CORRECTIVE,
        startedAt: new Date(),
        reason: 'Ajustes de motor',
      }),
    ).toEqual([]);
  });

  it('No enviar el status', async () => {
    expect(await failures({})).toEqual(['status.isEnum']);
  });

  it.each([
    ['status', 'STATUSFAKE'], // status no existente
  ])('Rechaza %s = %j', async (field, value) => {
    expect(
      await failures({
        [field]: value,
      }),
    ).toEqual([`${field}.isEnum`]);
  });
  it.each([
    ['reason', 123], // no admite numero
    ['reason', '        '], // solo taps
  ])('Rechaza %s = %j', async (field, value) => {
    expect(
      await failures({
        status: BusStatus.MAINTENANCE,
        type: MaintenanceType.PREVENTIVE,
        startedAt: new Date(),
        [field]: value,
      }),
    ).toEqual(
      value === 123 ? [`${field}.isString`, `${field}.maxLength`] : [`${field}.isNotEmpty`],
    );
  });

  it('Propiedad desconocida', async () => {
    expect(
      await failures({
        status: BusStatus.AVAILABLE,
        foo: 25,
      }),
    ).toEqual(['foo.whitelistValidation']);
  });

  it('Cambiar a mantenimiento sin type con reason', async () => {
    expect(
      await failures({
        status: BusStatus.MAINTENANCE,
        startedAt: new Date(),
        reason: 'Ajustes de motor',
      }),
    ).toEqual(['type.isEnum', 'type.isNotEmpty']);
  });

  it('Cambiar a disponible con reason', async () => {
    expect(
      await failures({
        status: BusStatus.AVAILABLE,
        reason: 'Ajustes de motor',
      }),
    ).toEqual([]);
  });

  it("startedAt: 'not-a-date' → startedAt.isDate", async () => {
    expect(
      await failures({
        status: BusStatus.MAINTENANCE,
        reason: 'Ajustes de motor',
        type: MaintenanceType.PREVENTIVE,
        startedAt: { x: 'jaja' },
      }),
    ).toEqual(['startedAt.isDate']);
  });
});
