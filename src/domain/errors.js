export class DomainError extends Error {
  /**
   * @param {string} code - Machine-readable error code (e.g., VALIDATION, NOT_FOUND, SOLD_OUT, CONFLICT)
   * @param {string} message - Human-readable explanation
   */
  constructor(code, message) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}