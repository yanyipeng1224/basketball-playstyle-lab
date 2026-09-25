export function createAiProvider({ invokeExisting }) {
  if (typeof invokeExisting !== 'function') throw new TypeError('invokeExisting is required');

  return {
    invoke(type, data) {
      return invokeExisting(type, data);
    }
  };
}
