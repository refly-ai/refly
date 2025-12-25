class Ensurer<T> {
  constructor(
    private readonly condition: boolean,
    private readonly value?: T,
  ) {}

  orThrow(errorFactory: () => Error): T {
    if (!this.condition) {
      throw errorFactory();
    }
    return this.value as T;
  }

  orElse(defaultValue: T): T {
    return this.condition ? (this.value as T) : defaultValue;
  }

  orUndefined(): T | undefined {
    return this.condition ? (this.value as T) : undefined;
  }
}

export function ensure(condition: boolean): Ensurer<void> {
  return new Ensurer(condition);
}

ensure.nonNull = <T>(value: T | null | undefined): Ensurer<T> => {
  return new Ensurer(value !== null && value !== undefined, value as T);
};

ensure.defined = <T>(value: T | undefined): Ensurer<T> => {
  return new Ensurer(value !== undefined, value as T);
};

ensure.truthy = <T>(value: T): Ensurer<T> => {
  return new Ensurer(!!value, value);
};

ensure.nonEmpty = <T extends string | unknown[]>(value: T): Ensurer<T> => {
  return new Ensurer(value.length > 0, value);
};

ensure.inRange = (value: number, min: number, max: number): Ensurer<number> => {
  return new Ensurer(value >= min && value <= max, value);
};
