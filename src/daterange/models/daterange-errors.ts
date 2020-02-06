export function createMissingDateImplError(provider: string) {
  return Error(
      `Daterange: No provider found for ${provider}. You must import one of the following ` +
      `modules at your application root: MatNativeDateModule, MatMomentDateModule, or provide a ` +
      `custom implementation.`);
}
