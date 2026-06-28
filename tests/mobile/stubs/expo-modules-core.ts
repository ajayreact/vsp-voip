export class EventEmitter {
  addListener() {
    return { remove: () => {} };
  }

  emit() {}
}

export const NativeModulesProxy = {};

export default {
  EventEmitter,
  NativeModulesProxy,
};
