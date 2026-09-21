export abstract class DomainError extends Error {
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class EntityNotFoundError extends DomainError {
  readonly statusCode = 404;

  constructor(entidad: string, id?: string | number) {
    super(id === undefined ? `${entidad} no encontrado/a` : `${entidad} con id ${id} no encontrado/a`);
  }
}

export class ConflictError extends DomainError {
  readonly statusCode = 409;
}

export class AuthenticationError extends DomainError {
  readonly statusCode = 401;
}

export class AuthorizationError extends DomainError {
  readonly statusCode = 403;
}

export class ValidationError extends DomainError {
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}
