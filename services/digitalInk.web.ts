const unsupportedDigitalInk = () => {
  throw new Error("Digital Ink is not supported on Windows Desktop.");
};

export const NitroDigitalInk: any = new Proxy(
  {},
  {
    get(_target, property) {
      if (property === "__esModule") return false;
      return unsupportedDigitalInk;
    },
  },
);
