import { ConflictException } from '@nestjs/common';

export const UnassignedCode = {
  OVERLAP: 'OVERLAP',
  LOCATION_MISMATCH: 'LOCATION_MISMATCH',
  ROTATION_NO_BUS: 'ROTATION_NO_BUS',
  BUS_OUT_OF_SERVICE: 'BUS_OUT_OF_SERVICE',
  DB_CONFLICT: 'DB_CONFLICT',
} as const;

export type UnassignedCode = (typeof UnassignedCode)[keyof typeof UnassignedCode];

export interface UnassignedReason {
  code: UnassignedCode;
  message: string;
  conflictTripId?: number;
}

export class BusAssignmentConflict extends ConflictException {
  constructor(
    message: string,
    readonly code: UnassignedCode,
    readonly conflictTripId?: number,
  ) {
    super(message);
  }

  toReason(): UnassignedReason {
    return {
      code: this.code,
      message: this.message,
      ...(this.conflictTripId && { conflictTripId: this.conflictTripId }),
    };
  }
}
