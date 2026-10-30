import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsAfter(property: string, validationOpts?: ValidationOptions) {
  return (obj: object, propertyName: string) => {
    registerDecorator({
      name: 'isAfter',
      target: obj.constructor,
      propertyName,
      constraints: [property],
      options: validationOpts,
      validator: {
        validate(value: Date, validationArguments: ValidationArguments) {
          const [relatedPropertyName] = validationArguments.constraints;
          const relatedValue = (validationArguments.object as any)[relatedPropertyName];

          return (
            value instanceof Date &&
            relatedValue instanceof Date &&
            value.getTime() > relatedValue.getTime()
          );
        },
      },
    });
  };
}
