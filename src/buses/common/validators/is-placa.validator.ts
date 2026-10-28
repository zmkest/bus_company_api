import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";

export const PLATE_REGEX = /^([A-Z]{3}-?\d{3,4}|[A-Z]{2}-?\d{3}[A-Z])$/;

@ValidatorConstraint({ name: 'IsPlate', async: false })
export class IsPlateConstraint implements ValidatorConstraintInterface {

    validate(value: any): Promise<boolean> | boolean {
        return typeof value === 'string' && PLATE_REGEX.test(value);
    }

    defaultMessage?(): string {
        return 'La placa no tiene un formato válido (ej. ABC-1234)';
    }

}

export function IsPlate(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsPlateConstraint,
    });
  };
}