class Storage {
  private STORE_NAME: string;
  private _state: Record<string, unknown> = {};

  constructor(storeName: string) {
    this.STORE_NAME = storeName

    if (typeof localStorage !== 'undefined') {
      const savedState = localStorage.getItem(this.STORE_NAME);
      if (savedState) {
        let parsedData: Record<string, unknown> = {};
        try { parsedData = JSON.parse(savedState) } catch {/* no action */ };
        this._state = { ...this._state, ...parsedData };
      }
    }
  }

  public getState() { return this._state }

  public get<T>(key: string) {
    return this.getValue(key) as T;
  }

  public set<T = Record<string, unknown>>(key: string, value: T extends () => void ? never : T | ((_prev: T | undefined) => T)) {
    if (typeof value === 'function') {
      const prev = this.getValue(key) as T | undefined;
      this.setValue(key, value(prev));
    } else {
      this.setValue(key, value);
    }
    this.emit();
  }

  private emit() {
    if (typeof globalThis.window !== 'undefined') {
      const state = JSON.stringify(this._state);

      localStorage.setItem(this.STORE_NAME, state);
    }
  }

  private setValue = (path: string, value: unknown) => {
    let obj = this._state as unknown as Record<string, unknown>;
    const arr = path.split('.');
    const last = arr.pop();
    arr.forEach(key => {
      if (!obj[key]) obj[key] = {};
      obj = obj[key] as Record<string, unknown>;
    });
    if (last) obj[last] = value;
  };

  private getValue = (path: string): unknown => {
    return path
      .split('.')
      .reduce<Record<string, unknown> | undefined>(
        (obj, key) => (obj && obj[key] !== undefined ? (obj[key] as Record<string, unknown>) : undefined),
        { ...this._state }
      );
  };
}

export const storage = new Storage('EtherWallet')
