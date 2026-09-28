export interface Config {
  nerv?: {
    releaseBot?: {
      /**
       * Fine-grained token with Contents read/write on central-dogma. Copied into
       * new service repositories as DOGMA_DISPATCH_TOKEN.
       * @visibility secret
       */
      dispatchToken?: string;
    };
  };
}
