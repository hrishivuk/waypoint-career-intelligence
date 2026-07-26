export class InvalidProfileFactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProfileFactError";
  }
}

export class ProfileFactNotFoundError extends Error {
  constructor(factId: string) {
    super(`Profile fact ${factId} was not found for this candidate`);
    this.name = "ProfileFactNotFoundError";
  }
}

export class InvalidProfileFactTransitionError extends Error {
  constructor(status: string) {
    super(`A ${status} profile fact can no longer be reviewed`);
    this.name = "InvalidProfileFactTransitionError";
  }
}
